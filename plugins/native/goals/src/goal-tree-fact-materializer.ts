import { randomUUID } from "node:crypto";
import type { GoalsApplicationApi, GoalsQueryApi, RiskRecord, GoalRecord, CreateGoalInput } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalTreeProposalItemRecord, ProposalAffectedObject, GovernanceApplicationApi } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { GoalTreeInputReader } from "./goal-tree-inputs.js";

/** Convert confirmed proposal payloads; Goals retains rules, events and persistence. */
export class GoalTreeFactMaterializer {
  constructor(private readonly goals: Pick<GoalsApplicationApi, "commands" | "planning" | "lifecycle"> & { query: Pick<GoalsQueryApi, "getGoal"> },
    private readonly governance: Pick<GovernanceApplicationApi, "records" | "clarification">,
    private readonly inputs: GoalTreeInputReader,
    private readonly errorFactory: (code: string, message: string, details?: Record<string, unknown>) => Error) {}

  materializeGoalTreeRelations(
    boardId: string,
    item: GoalTreeProposalItemRecord,
    actorId: string,
    reasonText: string,
    at: string,
  ): ProposalAffectedObject[] {
    return this.goals.commands.applyConfirmedRelations({
      board_id: boardId, actor_id: actorId, reason: reasonText, at, source_item_id: item.item_id,
      relations: this.inputs.goalTreeRelationEntries(item).map(raw => this.inputs.normalizeGoalTreeRelation(item, raw)),
    }).map(relation => ({ object_type: "relation", object_id: relation.relation_id }));
  }

  materializeGoalTreePolicy(
    boardId: string,
    item: GoalTreeProposalItemRecord,
    actorId: string,
    reasonText: string,
    at: string,
  ): ProposalAffectedObject {
    const payload = this.inputs.goalTreePayloadRecord(item.payload, "Policy 条目");
    const context = { board_id: boardId, actor_id: actorId, reason: reasonText, at, source_item_id: item.item_id };
    if (item.operation === "deactivate") {
      const result = this.goals.commands.applyConfirmedPolicy({ ...context, operation: "deactivate",
        policy_binding_id: String(payload.policy_binding_id ?? "").trim() });
      return { object_type: "policy", object_id: result.policy_binding_id };
    }
    const flatPolicy = Object.fromEntries([
      "goal_mode", "required_capabilities", "self_verification", "cross_reviewers",
      "adversarial_reviewers", "human_approval", "max_lease_seconds",
    ].filter(field => payload[field] != null).map(field => [field, payload[field]]));
    const policy = this.inputs.goalTreePayloadRecord(payload.policy ?? flatPolicy, "Goal Policy");
    const result = this.goals.commands.applyConfirmedPolicy({ ...context, operation: "replace", policy,
      goal_id: String(payload.goal_id ?? "").trim() || null,
      policy_binding_id: String(payload.policy_binding_id ?? "").trim() || undefined });
    return { object_type: "policy", object_id: result.policy_binding_id };
  }

  materializeGoalTreeRisk(
    boardId: string,
    item: GoalTreeProposalItemRecord,
    actorId: string,
    reasonText: string,
    at: string,
  ): ProposalAffectedObject {
    const payload = this.inputs.goalTreePayloadRecord(item.payload, "Risk 条目");
    const riskId = String(payload.risk_id ?? "").trim() || `risk-${randomUUID()}`;
    const context = { board_id: boardId, risk_id: riskId, actor_id: actorId, reason: reasonText, at, source_item_id: item.item_id };
    if (item.operation === "deactivate") {
      this.goals.commands.applyConfirmedRisk({ ...context, operation: "deactivate" });
    } else {
      const rawBasis = payload.resolution_basis && typeof payload.resolution_basis === "object" && !Array.isArray(payload.resolution_basis)
        ? payload.resolution_basis as Record<string, unknown> : null;
      this.goals.commands.applyConfirmedRisk({ ...context, operation: item.operation === "create" ? "create" : "update",
        facts: {
          goal_ids: this.inputs.goalTreeStringArray(payload.goal_ids), description: String(payload.description ?? ""),
          probability: String(payload.probability ?? ""), impact: String(payload.impact ?? ""),
          affected_surfaces: this.inputs.goalTreeStringArray(payload.affected_surfaces), trigger: String(payload.trigger ?? ""),
          treatment: String(payload.treatment ?? "") as RiskRecord["treatment"], treatment_plan: String(payload.treatment_plan ?? ""),
          blocking_mode: String(payload.blocking_mode ?? "") as RiskRecord["blocking_mode"],
          revisit_condition: String(payload.revisit_condition ?? ""), owner: String(payload.owner ?? ""),
        },
        requested_state: String(payload.state ?? "").trim(),
        resolution_basis: rawBasis ? { summary: String(rawBasis.summary ?? ""), evidence_refs: this.inputs.goalTreeStringArray(rawBasis.evidence_refs),
          ...(Array.isArray(rawBasis.residual_gaps) ? { residual_gaps: this.inputs.goalTreeStringArray(rawBasis.residual_gaps) } : {}) } : null,
      });
    }
    return { object_type: "risk", object_id: riskId };
  }

  materializeGoalTreeGoal(
    boardId: string,
    item: GoalTreeProposalItemRecord,
    actorId: string,
    reasonText: string,
    at: string,
  ): ProposalAffectedObject {
    const goal = this.inputs.goalTreeGoalInput(item);
    const goalId = this.inputs.goalTreeTargetGoalId(item, goal);
    const existing = this.goals.query.getGoal(boardId, goalId);
    if (item.operation === "create") {
      this.goals.commands.createConfirmedGoal({ board_id: boardId, goal_id: goalId, goal,
        actor_id: actorId, reason: reasonText, at, source_proposal_id: item.proposal_id, source_item_id: item.item_id });
      return { object_type: "goal", object_id: goalId };
    }
    if (!existing) throw this.errorFactory("goal_tree_proposal.goal_not_found", `找不到 Goal: ${goalId}`);
    if (existing.definition_state === "accepted") {
      if (item.kind === "contract" && item.operation === "update") {
        if (this.goals.planning.contracts.isCompoundClosure(existing, goal)) {
          const conflict = this.goals.planning.contracts.compoundClosureConflict(boardId, item.operation, existing, goal, goalId);
          if (conflict) {
            throw this.errorFactory(String(conflict.code), String(conflict.message), conflict);
          }
          this.goals.lifecycle.closeAcceptedCompound({
            board_id: boardId,
            goal_id: goalId,
            decomposition_review: goal.decomposition_review,
            actor_id: actorId,
            reason: reasonText,
            source_item_id: item.item_id,
            at,
          });
          return { object_type: "goal", object_id: goalId };
        }
        const structuralConflict = this.goals.planning.contracts.revisionStructureConflict(boardId, existing, goal);
        if (structuralConflict) {
          throw this.errorFactory(
            String(structuralConflict.code),
            String(structuralConflict.message),
            structuralConflict,
          );
        }
        return this.materializeAcceptedGoalContractRevision(
          boardId,
          item,
          existing,
          goal,
          actorId,
          reasonText,
          at,
        );
      }
      const conflict = this.goals.planning.contracts.compoundClosureConflict(boardId, item.operation, existing, goal, goalId);
      if (conflict) {
        throw this.errorFactory(String(conflict.code), String(conflict.message));
      }
      this.goals.lifecycle.closeAcceptedCompound({
        board_id: boardId,
        goal_id: goalId,
        decomposition_review: goal.decomposition_review,
        actor_id: actorId,
        reason: reasonText,
        source_item_id: item.item_id,
        at,
      });
      return { object_type: "goal", object_id: goalId };
    }
    const updated = this.goals.commands.updateConfirmedDraft({
      board_id: boardId, goal_id: goalId, goal, actor_id: actorId, at,
    });
    const definitionState = updated.definition_state;
    this.governance.records.supersedePendingContractProposals(
      boardId,
      goalId,
      at,
      { reason: "用户通过统一 Goal Tree 决定确认了更新后的 Contract", decided_by: actorId },
    );
    if (definitionState === "accepted") {
      this.governance.clarification.closeAccepted(
        boardId,
        goalId,
        actorId,
        `用户通过 Goal Tree Proposal ${item.proposal_id} 接受了 Draft Goal`,
        at,
      );
    }
    this.goals.commands.recordConfirmedDraftUpdate({
      board_id: boardId, goal_id: goalId, actor_id: actorId, reason: reasonText,
      source_item_id: item.item_id, at,
    });
    return { object_type: "goal", object_id: goalId };
  }

  private materializeAcceptedGoalContractRevision(
    boardId: string,
    item: GoalTreeProposalItemRecord,
    existing: GoalRecord,
    proposed: CreateGoalInput,
    actorId: string,
    reasonText: string,
    at: string,
  ): ProposalAffectedObject {
    const applied = this.goals.lifecycle.applyAcceptedContractRevision({
      board_id: boardId,
      goal_id: existing.goal_id,
      proposed_goal: proposed,
      source_proposal_id: item.proposal_id,
      source_item_id: item.item_id,
      actor_id: actorId,
      reason: reasonText,
      applied_at: at,
    });
    return { object_type: "goal", object_id: applied.goal.goal_id };
  }
}
