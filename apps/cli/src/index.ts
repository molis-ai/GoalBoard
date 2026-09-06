export { createCliDraftDialogueHandlers } from "./draft-dialogue-commands.js";
export { createCliGoalTreeHandlers } from "./goal-tree-commands.js";
export { createCliLegacyProposalHandlers } from "./legacy-proposal-commands.js";
import type { GoalsApplicationApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionValidationApplicationApi } from "@adeptify/goalboard-plugin-goals";
export { createCliExecutionCommandHandlers } from "./execution-commands.js";
export { createCliGoalCommandHandlers } from "./goal-commands.js";
export { createCliAvailabilityQueryHandlers } from "./availability-queries.js";

export {
  DEFAULT_CLI_DATABASE,
  cliFlagValue,
  readCliJsonPayload,
  printCliJson,
  cliGoalUrl,
  printV1Help,
} from "./protocol.js";

export const packageDescriptor = {
  packageName: "@adeptify/goalboard-app-cli",
  packagePath: "apps/cli",
  kind: "app",
  maturity: "partial",
  contract: "@adeptify/goalboard-contracts/platform/app-host",
  migrationGoals: ["goal-reorg-f2", "goal-reorg-dv1", "goal-reorg-gw4", "goal-reorg-ex4"],
  ssot: "docs/SSOT-MATRIX.md",
  capabilities: ["cli.goals-command-adapter.v1", "cli.execution-validation-adapter.v1"],
} as const;

export type GoalBoardPackageDescriptor = typeof packageDescriptor;

export type CliGoalsAdapter<TTransition = unknown> = GoalsApplicationApi<TTransition>;

/** Bind CLI operations to the public Goals Contract without copying Module rules. */
export function createCliGoalsAdapter<TTransition>(
  goals: GoalsApplicationApi<TTransition>,
): CliGoalsAdapter<TTransition> {
  return {
    impacts: goals.impacts,
    commands: goals.commands,
    lifecycle: goals.lifecycle,
    planning: goals.planning,
  };
}

export type CliExecutionValidationAdapter<TSnapshot = unknown> =
  ExecutionValidationApplicationApi<TSnapshot>;

/** Bind CLI execution and review commands to the native Goals Plugin application port. */
export function createCliExecutionValidationAdapter<TSnapshot>(
  application: ExecutionValidationApplicationApi<TSnapshot>,
): CliExecutionValidationAdapter<TSnapshot> {
  return { query: application.query, commands: application.commands };
}
