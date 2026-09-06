import { createHash, randomUUID } from "node:crypto";
import type { GoalsApplicationApi, GoalsQueryApi, GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceApplicationApi, ContractProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { DecideContractProposalInput, LegacyProposalApplicationApi } from "./legacy-proposal-contract.js";
import type { LegacyContractProposalValidator } from "./legacy-contract-validation.js";

/** Historical Draft approval keeps its original decision, records and atomic materialization. */
export class LegacyContractDecisionApplication implements Pick<LegacyProposalApplicationApi, "decideContractProposal"> {
  constructor(private readonly ports: {
    goals: Pick<GoalsApplicationApi, "lifecycle" | "commands" | "impacts"> & { query: Pick<GoalsQueryApi, "getGoal"> };
    governance: Pick<GovernanceApplicationApi, "query" | "records" | "clarification">;
    validator: LegacyContractProposalValidator; clock: () => Date;
    errorFactory: (code: string, message: string) => Error;
  }) {}
  decideContractProposal(input: DecideContractProposalInput): {
    proposal: ContractProposalRecord;
    goal: GoalRecord;
    replayed: boolean;
    observed_event_cursor: number;
  } {
    if (input.actor_kind !== "user") {
      throw this.ports.errorFactory(
        "contract_proposal.user_decision_required",
        "Runtime 可以补全 Draft，但只有用户可以确认它成为正式 Contract",
      );
    }
    if (input.decision !== "approved" && input.decision !== "rejected") {
      throw this.ports.errorFactory(
        "contract_proposal.decision_invalid",
        "Contract Proposal 决定必须是 approved 或 rejected",
      );
    }
    if (!input.reason.trim()) {
      throw this.ports.errorFactory(
        "contract_proposal.reason_required",
        "用户决定需要说明原因",
      );
    }
    const hash = requestHash(input);
    return this.ports.governance.records.executeContractProposalDecision({
      board_id: input.board_id, actor_id: input.actor_id, idempotency_key: input.idempotency_key, request_hash: hash,
    }, () => {

      const pendingProposal = this.ports.governance.query.getContractProposal(input.board_id, input.proposal_id);
      if (!pendingProposal) {
        throw this.ports.errorFactory(
          "contract_proposal.not_found",
          "Contract Proposal 不存在",
        );
      }
      if (pendingProposal.state !== "pending") {
        throw this.ports.errorFactory(
          "contract_proposal.already_decided",
          "Contract Proposal 已经做过决定",
        );
      }
      const goalId = pendingProposal.goal_id;
      const goal = this.requireGoalOnBoard(input.board_id, goalId);
      if (goal.definition_state !== "draft") {
        throw this.ports.errorFactory(
          "contract_proposal.goal_not_draft",
          "这个 Goal 已经不是 Draft，不能再用补全提案改写",
        );
      }
      const now = this.ports.clock().toISOString();
      if (input.decision === "rejected") {
        this.ports.governance.records.transitionContractProposal(
          input.board_id,
          input.proposal_id,
          "rejected",
          { reason: input.reason, decided_by: input.actor_id },
          now,
        );
        const cursor = this.ports.governance.records.recordContractProposalDecision({
          board_id: input.board_id, proposal_id: input.proposal_id, goal_id: goalId, actor_id: input.actor_id,
          reason: input.reason, at: now, decision: "rejected",
        });
        const proposal = this.readContractProposal(input.board_id, input.proposal_id);
        const unchangedGoal = this.requireGoalOnBoard(input.board_id, goalId);
        const outcome = { proposal, goal: unchangedGoal, observed_event_cursor: cursor };
        return { value: outcome, at: now };
      }

      const proposedGoal = pendingProposal.proposed_goal;
      const fieldSources = pendingProposal.field_sources;
      const reviewPolicy = pendingProposal.review_policy;
      const proposedImpacts = pendingProposal.proposed_impacts;
      const proposedRisks = pendingProposal.proposed_risks;
      const dependencyRewireIds = pendingProposal.dependency_rewire_ids;
      this.ports.validator.validate(
        input.board_id,
        goalId,
        proposedGoal,
        fieldSources,
        reviewPolicy,
        proposedImpacts,
        proposedRisks,
        dependencyRewireIds,
        true,
      );

      this.ports.goals.lifecycle.acceptDraft({
        board_id: input.board_id,
        goal_id: goalId,
        proposed_goal: {
          ...proposedGoal,
          goal_id: goalId,
          definition_state: "accepted",
          decomposition_state: "closed_leaf",
          decomposition_review: undefined,
          priority: proposedGoal.priority ?? goal.priority,
        },
        actor_id: input.actor_id,
        accepted_at: now,
      });

      const policyBindingId = `policy-${randomUUID()}`;
      this.ports.goals.commands.registerAcceptedPolicy({
        board_id: input.board_id, goal_id: goalId, policy_binding_id: policyBindingId,
        policy: reviewPolicy, actor_id: input.actor_id,
        reason: `用户批准 Contract Proposal ${input.proposal_id}`, at: now,
      });

      const impactBindingIds: string[] = [];
      for (const impact of proposedImpacts) {
        const bindingId = `impact-${randomUUID()}`;
        this.ports.goals.impacts.registerAccepted(input.board_id, {
          binding_id: bindingId, goal_id: goalId, surface: impact.surface.trim(), access: impact.access,
          input_snapshot: impact.input_snapshot ?? null, reason: impact.reason.trim(),
        }, input.actor_id, now);
        impactBindingIds.push(bindingId);
      }

      const riskIds: string[] = [];
      for (const risk of proposedRisks) {
        this.ports.goals.commands.registerAcceptedRisk({
          board_id: input.board_id, risk_id: risk.risk_id.trim(), goal_ids: [goalId],
          description: risk.description.trim(), probability: risk.probability.trim(), impact: risk.impact.trim(),
          affected_surfaces: risk.affected_surfaces, trigger: risk.trigger.trim(), treatment: risk.treatment,
          treatment_plan: risk.treatment_plan?.trim() ?? "", blocking_mode: risk.blocking_mode,
          revisit_condition: risk.revisit_condition.trim(), owner: risk.owner.trim(),
        }, now);
        riskIds.push(risk.risk_id.trim());
      }

      const confirmedFields = [...new Set(fieldSources.map((source) => source.field))].sort();
      this.ports.governance.records.transitionContractProposal(
        input.board_id,
        input.proposal_id,
        "approved",
        {
            reason: input.reason,
            decided_by: input.actor_id,
            confirmed_fields: confirmedFields,
            policy_binding_id: policyBindingId,
            impact_binding_ids: impactBindingIds,
            risk_ids: riskIds,
            dependency_rewire_ids: dependencyRewireIds,
        },
        now,
      );
      this.ports.governance.clarification.closeAccepted(
        input.board_id,
        goalId,
        input.actor_id,
        `用户批准 Contract Proposal ${input.proposal_id}，Draft 澄清结束`,
        now,
      );
      const cursor = this.ports.governance.records.recordContractProposalDecision({
        board_id: input.board_id, proposal_id: input.proposal_id, goal_id: goalId, actor_id: input.actor_id,
        reason: input.reason, at: now, decision: "approved", confirmed_fields: confirmedFields,
      });
      const proposal = this.readContractProposal(input.board_id, input.proposal_id);
      const acceptedGoal = this.requireGoalOnBoard(input.board_id, goalId);
      const outcome = { proposal, goal: acceptedGoal, observed_event_cursor: cursor };
      return { value: outcome, at: now };
    });
  }

  private requireGoalOnBoard(boardId: string, goalId: string): GoalRecord {
    const goal = this.ports.goals.query.getGoal(boardId, goalId);
    if (!goal) throw this.ports.errorFactory("goal.not_found", `Goal 不存在: ${goalId}`);
    return goal;
  }
  private readContractProposal(boardId: string, proposalId: string): ContractProposalRecord {
    const proposal = this.ports.governance.query.getContractProposal(boardId, proposalId);
    if (!proposal) throw new Error(`Contract Proposal 写入后无法读取: ${proposalId}`);
    return proposal;
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
