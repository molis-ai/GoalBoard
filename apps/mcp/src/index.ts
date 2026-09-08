export { createMcpContextPresenter } from "./context-presentation.js";
export type { McpContextPresentationPorts } from "./context-presentation.js";
export { createMcpGoalTrashHandlers } from "./goal-trash-commands.js";
export { mcpWebUrl, mcpGoalContractResponse } from "./goal-presentation.js";
export { createMcpDraftDialogueHandlers } from "./draft-dialogue-commands.js";
export { createMcpGoalTreeHandlers, runtimeGoalTreeDecisionInput } from "./goal-tree-commands.js";
export { createMcpLegacyProposalHandlers } from "./legacy-proposal-commands.js";
import type { GoalsApplicationApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionValidationApplicationApi } from "@adeptify/goalboard-plugin-goals";

export { handleMcpMessage } from "./protocol.js";
export { mcpRuntimeSessionActivity } from "./session-activity.js";
export { createMcpRuntimeContextHandlers } from "./runtime-context-tools.js";
export type { McpRuntimeContextPorts } from "./runtime-context-tools.js";
export { planningMethodResponse, availableResponse, draftDialogueHistoryOptions, draftDialogueResponse } from "./query-presentation.js";
export type { McpPresentationErrorFactory, DraftDialogueHistoryOptions } from "./query-presentation.js";
export { createMcpExecutionToolHandlers } from "./execution-commands.js";
export { createMcpGoalToolHandlers } from "./goal-commands.js";
export { createMcpAvailabilityToolHandlers } from "./availability-queries.js";
export { mcpBoardPayload } from "./payload.js";
export { buildMcpResumeView } from "./resume-view.js";
export type { McpResumeFacts } from "./resume-view.js";
export {
  MCP_TOOLS,
  RUNTIME_MCP_TOOLS,
  MCP_SERVER_INFO,
  isRuntimeMcpTool,
  isRuntimeContextMcpTool,
} from "./tool-catalog.js";
export type { McpProtocolPorts, McpToolCallContext, McpToolDefinition } from "./protocol.js";

export const packageDescriptor = {
  packageName: "@adeptify/goalboard-app-mcp",
  packagePath: "apps/mcp",
  kind: "app",
  maturity: "partial",
  contract: "@adeptify/goalboard-contracts/platform/app-host",
  migrationGoals: ["goal-reorg-f2", "goal-reorg-dv1", "goal-reorg-dv2", "goal-reorg-gw4", "goal-reorg-ex4"],
  ssot: "docs/SSOT-MATRIX.md",
  capabilities: ["mcp.goals-command-adapter.v1", "mcp.execution-validation-adapter.v1"],
} as const;

export type GoalBoardPackageDescriptor = typeof packageDescriptor;

export type McpGoalsAdapter<TTransition = unknown> = GoalsApplicationApi<TTransition>;

/** Bind MCP tools to the public Goals Contract without copying Module rules. */
export function createMcpGoalsAdapter<TTransition>(
  goals: GoalsApplicationApi<TTransition>,
): McpGoalsAdapter<TTransition> {
  return {
    impacts: goals.impacts,
    commands: goals.commands,
    lifecycle: goals.lifecycle,
    planning: goals.planning,
  };
}

export type McpExecutionValidationAdapter<TSnapshot = unknown> =
  ExecutionValidationApplicationApi<TSnapshot>;

/** Bind MCP tools to the transport-neutral execution and review application port. */
export function createMcpExecutionValidationAdapter<TSnapshot>(
  application: ExecutionValidationApplicationApi<TSnapshot>,
): McpExecutionValidationAdapter<TSnapshot> {
  return { query: application.query, commands: application.commands };
}
export { validateGoalBoardMcpLauncher } from "./launcher-validation.js";
export type { McpLauncherValidationContext } from "./launcher-validation.js";
export { dispatchMcpProjectTool } from "./tool-dispatch.js";
export type { McpToolDispatchPorts } from "./tool-dispatch.js";
