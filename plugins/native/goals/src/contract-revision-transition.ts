import type { GoalRevisionDependentTransition } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionCommandApi } from "@adeptify/goalboard-contracts/modules/execution";
import type { GovernanceReviewApi } from "@adeptify/goalboard-contracts/modules/governance-collaboration";

/** Preserve Execution transitions before retiring the old review obligations. */
export function transitionGoalRevisionDependents(ports: {
  execution: Pick<ExecutionCommandApi, "transitionGoalContractRevision">;
  governance: Pick<GovernanceReviewApi, "waivePendingObligationsForRevision">;
}, input: GoalRevisionDependentTransition): void {
  ports.execution.transitionGoalContractRevision(input);
  if (input.effect !== "metadata") {
    ports.governance.waivePendingObligationsForRevision(input.goal_id, input.previous_contract_revision);
  }
}
