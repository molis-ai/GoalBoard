import type { GoalPolicy } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceApplicationApi } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { BoardSnapshot } from "./goal-entry-contract.js";
import { compatibleContractRevisions } from "./contract-revisions.js";
/** Translate effective Goal policy and criterion ownership into Governance obligations. */
export function ensureGoalReviewObligations(
  governance: GovernanceApplicationApi["reviews"],
  snapshot: BoardSnapshot,
    boardId: string,
    goalId: string,
    policy: GoalPolicy,
    at: string,
  ): void {
    const currentGoal = snapshot.goals.find((goal) => goal.goal_id === goalId) ?? null;
    const criteria = currentGoal?.acceptance_criteria ?? [];
    const contractRevision = currentGoal?.current_contract_revision ?? 1;
    const compatibleRevisions = currentGoal
      ? compatibleContractRevisions(currentGoal, snapshot)
      : new Set([contractRevision]);
    const runtimeCriterionIds = criteria
      .filter((criterion) => criterion.decision_method !== "human_decision")
      .map((criterion) => criterion.criterion_id);
    const humanCriterionIds = criteria
      .filter((criterion) => criterion.decision_method === "human_decision")
      .map((criterion) => criterion.criterion_id);
    const allCriterionIds = criteria.map((criterion) => criterion.criterion_id);
    const obligations: Array<{
      role: "self_verifier" | "cross_reviewer" | "adversarial_reviewer" | "human_approver";
      count: number;
      independence: string;
      criterionIds: string[];
    }> = [];
    if (policy.self_verification && runtimeCriterionIds.length > 0) {
      obligations.push({
        role: "self_verifier",
        count: 1,
        independence: "executor_allowed",
        criterionIds: runtimeCriterionIds,
      });
    }
    if (policy.cross_reviewers > 0 && runtimeCriterionIds.length > 0) {
      obligations.push({
        role: "cross_reviewer",
        count: policy.cross_reviewers,
        independence: "actor_must_differ_from_executor",
        criterionIds: runtimeCriterionIds,
      });
    }
    if (policy.adversarial_reviewers > 0 && runtimeCriterionIds.length > 0) {
      obligations.push({
        role: "adversarial_reviewer",
        count: policy.adversarial_reviewers,
        independence: "actor_must_differ_from_executor",
        criterionIds: runtimeCriterionIds,
      });
    }
    if (policy.human_approval || humanCriterionIds.length > 0) {
      obligations.push({
        role: "human_approver",
        count: 1,
        independence: "user_authority",
        criterionIds: policy.human_approval ? allCriterionIds : humanCriterionIds,
      });
    }

    governance.reconcileObligations({
      board_id: boardId,
      goal_id: goalId,
      contract_revision: contractRevision,
      compatible_contract_revisions: [...compatibleRevisions],
      created_at: at,
      desired: obligations.map((obligation) => ({
        role: obligation.role,
        required_count: obligation.count,
        independence_rule: obligation.independence,
        criterion_scope: obligation.criterionIds,
      })),
    });
  }
