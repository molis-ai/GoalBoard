import type { McpToolDefinition } from "./protocol.js";
import { V1_TOOLS } from "./goal-tools.js";
import { EVENT_TOOLS } from "./goal-event-tools.js";
import { CONTEXT_TOOLS } from "./context-tools.js";

const SERVER_INFO = { name: "goalboard-mcp", version: "1.0.0" };

const TOOLS: McpToolDefinition[] = [...V1_TOOLS, ...EVENT_TOOLS, ...CONTEXT_TOOLS];

const RUNTIME_V1_TOOL_NAMES = new Set([
  "goalboard_v1_project_guidance_get",
  "goalboard_v1_project_guidance_add",
  "goalboard_v1_project_guidance_update",
  "goalboard_v1_planning_methods",
  "goalboard_v1_planning_method_save",
  "goalboard_v1_planning_analyze_change",
  "goalboard_v1_planning_graph_check",
  "goalboard_v1_goal_intent_create",
  "goalboard_v1_goal_state",
  "goalboard_v1_event_configure",
  "goalboard_v1_event_note",
  "goalboard_v1_event_report",
  "goalboard_v1_event_list",
  "goalboard_v1_event_read",
  "goalboard_v1_event_progress",
  "goalboard_v1_event_concern",
  "goalboard_v1_event_decision_request",
  "goalboard_v1_event_cite_decision",
  "goalboard_v1_event_agree",
  "goalboard_v1_event_close",
  "goalboard_v1_event_resume",
  "goalboard_v1_goal_list",
  "goalboard_v1_goal_tree_propose",
  "goalboard_v1_goal_tree_read",
  "goalboard_v1_goal_tree_check",
  "goalboard_v1_goal_trash",
  "goalboard_v1_goal_trash_list",
  "goalboard_v1_goal_restore",
]);

const RUNTIME_CONTEXT_TOOL_NAMES = new Set([
  "goalboard_v1_context_resolve",
  "goalboard_v1_context_list_projects",
  "goalboard_v1_context_reject_suggestion",
  "goalboard_v1_context_bind",
  "goalboard_v1_context_unbind",
  "goalboard_v1_context_create_and_bind",
  "goalboard_v1_project_delete",
]);

const RUNTIME_TOOL_NAMES = new Set([...RUNTIME_V1_TOOL_NAMES, ...RUNTIME_CONTEXT_TOOL_NAMES]);

const RUNTIME_STRIPPED_FIELDS = [
  "board_id",
  "database_path",
  "web_base_url",
  "actor_id",
  "actor_kind",
  "runtime_actor_id",
  "submitted_session_id",
] as const;

function runtimeToolDefinition(tool: McpToolDefinition): McpToolDefinition {
  const clone = structuredClone(tool);
  if (!isRuntimeContextMcpTool(tool.name)) {
    const inputProperties = clone.inputSchema.properties as Record<string, unknown>;
    for (const field of RUNTIME_STRIPPED_FIELDS) delete inputProperties[field];
    const required = clone.inputSchema.required as string[] | undefined;
    if (required) {
      clone.inputSchema.required = required.filter((field) =>
        !(RUNTIME_STRIPPED_FIELDS as readonly string[]).includes(field),
      );
    }
  }
  return clone;
}

const RUNTIME_TOOLS = TOOLS
  .filter((tool) => RUNTIME_TOOL_NAMES.has(tool.name))
  .map(runtimeToolDefinition);


/** Classify the same tool audience used by discovery before host execution. */
export function isRuntimeMcpTool(name: string): boolean {
  return RUNTIME_TOOL_NAMES.has(name);
}

/** Connection tools run before a project has been resolved. */
export function isRuntimeContextMcpTool(name: string): boolean {
  return RUNTIME_CONTEXT_TOOL_NAMES.has(name);
}

export { TOOLS as MCP_TOOLS, RUNTIME_TOOLS as RUNTIME_MCP_TOOLS, SERVER_INFO as MCP_SERVER_INFO };
