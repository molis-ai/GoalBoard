import type { GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ContractProposalRecord, GoalTreeProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { ExecutionRunRecord } from "@adeptify/goalboard-contracts/modules/execution";
import type { GoalWorkState } from "./execution-validation-contract.js";
import type { GoalPresentationState } from "./tree-order.js";
import { requiresParentCompletionConfirmation, type ParentCompletionSnapshot } from "./parent-completion.js";

export interface GoalPresentationSnapshot extends ParentCompletionSnapshot {
  contract_proposals: readonly Pick<ContractProposalRecord, "goal_id" | "state">[];
  goal_tree_proposals: readonly (Pick<GoalTreeProposalRecord, "origin" | "state" | "root_goal_id" | "discovered_in_run_id"> & { items: readonly { state: string }[] })[];
  runs: readonly Pick<ExecutionRunRecord, "run_id" | "goal_id">[];
}
function proposalStillNeedsDecision(state: string, itemStates: readonly string[]): boolean {
  return (state === "pending" || state === "partially_applied") &&
    itemStates.some((itemState) => itemState === "pending" || itemState === "conflict");
}

export function goalPresentationState(
  workState: GoalWorkState,
  goal: Pick<GoalRecord, "goal_id" | "definition_state" | "decomposition_state" | "fulfillment_state">,
  snapshot: GoalPresentationSnapshot,
  _reasons: readonly { code: string }[] = [],
): GoalPresentationState {
  const isClarificationState = ["clarification_pending", "clarifying", "clarification_blocked"].includes(workState);
  if (isClarificationState && goal.definition_state === "draft") {
    const hasContractDecision = snapshot.contract_proposals.some(
      (proposal) => proposal.goal_id === goal.goal_id && proposal.state === "pending",
    );
    const hasGoalTreeDecision = snapshot.goal_tree_proposals.some((proposal) => {
      if (
        proposal.origin !== "native" ||
        !proposalStillNeedsDecision(proposal.state, proposal.items.map((item) => item.state))
      ) {
        return false;
      }
      if (proposal.root_goal_id === goal.goal_id) return true;
      if (!proposal.discovered_in_run_id) return false;
      return snapshot.runs.some(
        (run) => run.run_id === proposal.discovered_in_run_id && run.goal_id === goal.goal_id,
      );
    });
    if (hasContractDecision || hasGoalTreeDecision) return "clarification_decision_pending";
  }

  if (
    workState === "clarification_pending" &&
    requiresParentCompletionConfirmation(goal, snapshot)
  ) {
    return "compound_closure_pending";
  }

  return workState;
}
