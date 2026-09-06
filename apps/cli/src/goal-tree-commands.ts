import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { GoalTreeApplicationApi } from "@adeptify/goalboard-plugin-goals";

/** Wire conversion only; the application retains validation and transaction ownership. */
export function createCliGoalTreeHandlers(application: GoalTreeApplicationApi | AsyncApplicationMethods<GoalTreeApplicationApi>) {
  return {
    "goal-tree-propose": async (input: Record<string, unknown>) =>
      application.submitGoalTreeProposal(input as unknown as Parameters<GoalTreeApplicationApi["submitGoalTreeProposal"]>[0]),
    "goal-tree-read": async (input: Record<string, unknown>) =>
      application.listGoalTreeProposals(input as unknown as Parameters<GoalTreeApplicationApi["listGoalTreeProposals"]>[0]),
    "goal-tree-check": async (input: Record<string, unknown>) =>
      application.checkGoalTreeProposal(input as unknown as Parameters<GoalTreeApplicationApi["checkGoalTreeProposal"]>[0]),
    "goal-tree-decide": async (input: Record<string, unknown>) =>
      application.decideGoalTreeProposal(input as unknown as Parameters<GoalTreeApplicationApi["decideGoalTreeProposal"]>[0]),
  };
}
