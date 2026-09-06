import { createHash, randomUUID } from "node:crypto";
import type { GoalsApplicationApi, GoalsQueryApi, GoalRecord, RiskRecord, ImpactAccess } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceApplicationApi, RewireRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { LegacyProposalApplicationApi } from "./legacy-proposal-contract.js";

/** Apply/reject the historical Rewire without changing its separate user decision. */
export class LegacyRewireDecisionApplication implements Pick<LegacyProposalApplicationApi, "confirmRewire"> {
  constructor(private readonly ports: {
    goals: Pick<GoalsApplicationApi, "lifecycle" | "commands" | "impacts"> & { query: Pick<GoalsQueryApi, "getGoal"> };
    governance: Pick<GovernanceApplicationApi, "query" | "records">;
    clock: () => Date; errorFactory: (code: string, message: string) => Error;
  }) {}
  confirmRewire(input: Parameters<LegacyProposalApplicationApi["confirmRewire"]>[0]): { rewire: RewireRecord; replayed: boolean; observed_event_cursor: number } {
    if (input.actor_kind !== "user") {
      throw this.ports.errorFactory("rewire.user_confirmation_required", "只有用户可以决定 Goal Spine 线路变更");
    }
    const decision = input.decision ?? "confirmed";
    if (decision !== "confirmed" && decision !== "rejected") {
      throw this.ports.errorFactory("rewire.decision_invalid", "Rewire 决定必须是 confirmed 或 rejected");
    }
    const hash = requestHash(input);
    return this.ports.governance.records.executeRewireDecision({
      board_id: input.board_id, actor_id: input.actor_id, idempotency_key: input.idempotency_key, request_hash: hash,
    }, () => {
      const pendingRewire = this.ports.governance.query.getRewire(input.board_id, input.rewire_id);
      if (!pendingRewire) throw this.ports.errorFactory("rewire.not_found", "Rewire 不存在");
      if (pendingRewire.state !== "pending") {
        throw this.ports.errorFactory("rewire.not_pending", "Rewire 已经做过决定");
      }
      const proposal = pendingRewire.proposal;
      const formalGoalId = String(proposal.formal_goal_id ?? "");
      if (formalGoalId) this.requireGoalOnBoard(input.board_id, formalGoalId);
      const now = this.ports.clock().toISOString();
      if (decision === "rejected") {
        if (formalGoalId) {
          this.ports.goals.lifecycle.reconcileRewireGoalValidity(input.board_id, formalGoalId, [], now);
        }
        const previousImpact = pendingRewire.impact;
        const rejectedImpact = {
          ...previousImpact,
          proposed_changes_applied: false,
          rejection_reason: input.reason,
        };
        this.ports.governance.records.transitionRewire(
          input.board_id,
          input.rewire_id,
          "rejected",
          { impact: rejectedImpact },
          now,
        );
        const cursor = this.ports.governance.records.recordRewireDecision({
          board_id: input.board_id, rewire_id: input.rewire_id, actor_id: input.actor_id,
          reason: input.reason, formal_goal_id: formalGoalId, at: now, state: "rejected",
        });
        const rewire = this.readRewire(input.board_id, input.rewire_id);
        const outcome = { rewire, observed_event_cursor: cursor };
        return { value: outcome, at: now };
      }
      const relationChanges = this.ports.goals.commands.applyAcceptedRewireRelations({
        board_id: input.board_id, rewire_id: input.rewire_id, formal_goal_id: formalGoalId, actor_id: input.actor_id, at: now,
        relations: (proposal.relations ?? []).map(relation => ({
          from_goal_id: String(relation.from_goal_id ?? formalGoalId).replace("$new_goal", formalGoalId),
          to_goal_id: String(relation.to_goal_id ?? "").replace("$new_goal", formalGoalId),
          type: String(relation.type ?? "part_of"), action: String(relation.action ?? "add"),
          reason: String(relation.reason ?? input.reason),
        })),
      });
      const addedRelations = relationChanges.added_relation_ids;
      const deactivatedRelations = relationChanges.deactivated_relation_ids;
      const revalidatedGoals = relationChanges.revalidated_goal_ids;
      for (const impact of proposal.impacts ?? []) {
        const surface = String(impact.surface ?? "").trim();
        const access = String(impact.access ?? "read");
        if (!surface || !["read", "write", "decide", "exclusive"].includes(access)) continue;
        this.ports.goals.impacts.registerAccepted(input.board_id, {
          binding_id: `impact-${randomUUID()}`,
          goal_id: String(impact.goal_id ?? formalGoalId).replace("$new_goal", formalGoalId),
          surface, access: access as ImpactAccess,
          input_snapshot: (impact.input_snapshot ?? null) as string | null, reason: String(impact.reason ?? input.reason),
        }, input.actor_id, now);
      }
      const addedRiskIds: string[] = [];
      const validTreatments = new Set(["accept", "mitigate", "avoid", "defer"]);
      const validBlockingModes = new Set(["none", "claim", "completion", "invalidate_on_trigger"]);
      for (const risk of proposal.risks ?? []) {
        const description = String(risk.description ?? "").trim();
        const probability = String(risk.probability ?? "").trim();
        const impact = String(risk.impact ?? "").trim();
        const trigger = String(risk.trigger ?? "").trim();
        const treatment = String(risk.treatment ?? "");
        const treatmentPlan = String(risk.treatment_plan ?? "").trim();
        const blockingMode = String(risk.blocking_mode ?? "none");
        const revisitCondition = String(risk.revisit_condition ?? "").trim();
        const owner = String(risk.owner ?? input.actor_id).trim();
        if (
          !description ||
          !probability ||
          !impact ||
          !trigger ||
          !revisitCondition ||
          !owner ||
          !validTreatments.has(treatment) ||
          !validBlockingModes.has(blockingMode)
        ) {
          throw this.ports.errorFactory("rewire.risk_invalid", "Rewire 中的 Risk 字段不完整或取值无效");
        }
        const riskId = String(risk.risk_id ?? `risk-${randomUUID()}`);
        const goalIds = ((risk.goal_ids as unknown[]) ?? [formalGoalId]).map((goalId) =>
          String(goalId).replace("$new_goal", formalGoalId),
        );
        if (goalIds.length === 0) {
          throw this.ports.errorFactory("rewire.risk_invalid", "Rewire 中的 Risk 必须关联至少一个 Goal");
        }
        for (const goalId of goalIds) this.requireGoalOnBoard(input.board_id, goalId);
        this.ports.goals.commands.registerAcceptedRewireRisk({
          board_id: input.board_id, risk_id: riskId, goal_ids: [...new Set(goalIds)], description, probability, impact,
          affected_surfaces: (risk.affected_surfaces as string[]) ?? [], trigger,
          treatment: treatment as RiskRecord["treatment"], treatment_plan: treatmentPlan,
          blocking_mode: blockingMode as RiskRecord["blocking_mode"], revisit_condition: revisitCondition, owner,
        }, input.actor_id, now);
        addedRiskIds.push(riskId);

      }
      this.ports.goals.lifecycle.reconcileRewireGoalValidity(
        input.board_id, formalGoalId, [...revalidatedGoals], now,
      );
      const previousImpact = pendingRewire.impact;
      const appliedImpact = {
        ...previousImpact,
        proposed_changes_applied: true,
        added_relation_ids: addedRelations,
        deactivated_relation_ids: deactivatedRelations,
        added_risk_ids: addedRiskIds,
        goals_needing_revalidation: [...revalidatedGoals].sort(),
      };
      this.ports.governance.records.transitionRewire(
        input.board_id,
        input.rewire_id,
        "applied",
        { impact: appliedImpact },
        now,
      );
      const cursor = this.ports.governance.records.recordRewireDecision({
        board_id: input.board_id, rewire_id: input.rewire_id, actor_id: input.actor_id,
        reason: input.reason, formal_goal_id: formalGoalId, at: now, state: "applied",
        added_relation_ids: addedRelations, deactivated_relation_ids: deactivatedRelations,
        added_risk_ids: addedRiskIds, goals_needing_revalidation: [...revalidatedGoals].sort(),
      });
      const rewire = this.readRewire(input.board_id, input.rewire_id);
      const outcome = { rewire, observed_event_cursor: cursor };
      return { value: outcome, at: now };
    });
  }

  private requireGoalOnBoard(boardId: string, goalId: string): GoalRecord {
    const goal = this.ports.goals.query.getGoal(boardId, goalId);
    if (!goal) throw this.ports.errorFactory("goal.not_found", `Goal 不存在: ${goalId}`);
    return goal;
  }
  private readRewire(boardId: string, rewireId: string): RewireRecord {
    const rewire = this.ports.governance.query.getRewire(boardId, rewireId);
    if (!rewire) throw new Error(`Rewire 写入后无法读取: ${rewireId}`);
    return rewire;
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
