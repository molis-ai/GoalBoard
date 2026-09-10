import { GoalBoardV1Error } from "@adeptify/goalboard-plugin-goals";
import type { GoalBoardRuntimeContextHost } from "@adeptify/goalboard-contracts/platform/app-host";
import type { McpToolCallContext } from "@adeptify/goalboard-app-mcp";

export const GOAL_EVENT_WRITE_TOOLS = new Set([
  "goalboard_v1_goal_intent_create",
  "goalboard_v1_event_configure",
  "goalboard_v1_event_report",
  "goalboard_v1_event_progress",
  "goalboard_v1_event_concern",
  "goalboard_v1_event_decision_request",
  "goalboard_v1_event_cite_decision",
  "goalboard_v1_event_agree",
  "goalboard_v1_event_close",
  "goalboard_v1_event_resume",
]);

export const GOAL_EVENT_TOOLS = new Set([
  ...GOAL_EVENT_WRITE_TOOLS,
  "goalboard_v1_goal_state",
  "goalboard_v1_event_list",
  "goalboard_v1_event_read",
  "goalboard_v1_event_decide",
]);

const FORBIDDEN_RUNTIME_FIELDS = [
  "actor_id",
  "actor_kind",
  "authority",
  "user_approval",
  "user_approved",
  "user_confirmed",
] as const;

export function assertRuntimeGoalEventToolInput(
  name: string,
  arguments_: Record<string, unknown>,
): void {
  if (!GOAL_EVENT_TOOLS.has(name)) return;
  const forged = FORBIDDEN_RUNTIME_FIELDS.filter((field) => Object.hasOwn(arguments_, field));
  if (forged.length) {
    throw new GoalBoardV1Error(
      "mcp.user_impersonation_denied",
      `MCP 权限拒绝：Runtime 不能通过 ${forged.join("、")} 自填用户身份、批准或权威来源`,
      { fields: forged },
    );
  }
}

export function runtimeEventActor(
  host: GoalBoardRuntimeContextHost | null,
  callContext: McpToolCallContext,
): { actor_id: string; actor_kind: "runtime" } {
  const runtimeId = host?.runtimeContext.runtime_id?.trim();
  if (!host || !runtimeId) {
    throw new GoalBoardV1Error(
      "mcp.runtime_identity_missing",
      "MCP 宿主没有可信 Runtime 身份。请重新连接 GoalBoard MCP，由宿主提供 runtime_id 与稳定 Session；不要在工具参数里填用户身份。",
    );
  }
  const sessionId = stableRuntimeSessionId(host, callContext);
  if (!sessionId) {
    throw new GoalBoardV1Error(
      "mcp.runtime_identity_missing",
      "MCP 宿主没有稳定 Session 身份。请重新连接 GoalBoard MCP，由宿主提供 runtime_id 以及稳定 Session（会话元数据、nativeRuntimeSessionId 或已声明的 stable_work_context_id）；不要在工具参数里填用户身份。",
    );
  }
  return {
    actor_id: `runtime:${runtimeId}:${sessionId}`,
    actor_kind: "runtime",
  };
}

function stableRuntimeSessionId(
  host: GoalBoardRuntimeContextHost,
  callContext: McpToolCallContext,
): string | null {
  const fromCall = callContext.runtimeSessionId?.trim();
  if (fromCall) return fromCall;
  const fromNative = host.nativeRuntimeSessionId?.trim();
  if (fromNative) return fromNative;
  if (host.runtimeContext.host_declares_stable) {
    const stable = host.runtimeContext.stable_work_context_id?.trim();
    if (stable) return stable;
  }
  return null;
}

export function injectRuntimeEventActor(
  name: string,
  arguments_: Record<string, unknown>,
  host: GoalBoardRuntimeContextHost | null,
  callContext: McpToolCallContext,
): Record<string, unknown> {
  if (!GOAL_EVENT_WRITE_TOOLS.has(name)) return arguments_;
  const actor = runtimeEventActor(host, callContext);
  return { ...arguments_, actor_id: actor.actor_id, actor_kind: actor.actor_kind };
}
