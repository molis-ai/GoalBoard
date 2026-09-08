import { isRuntimeMcpTool, isRuntimeContextMcpTool, type McpToolCallContext } from "@adeptify/goalboard-app-mcp";
import { GoalBoardV1Error } from "@adeptify/goalboard-plugin-goals";
import type { GoalBoardRuntimeConnection, GoalBoardRuntimeContextHost } from "@adeptify/goalboard-contracts/platform/app-host";
import type { RuntimeProjectConnection } from "./runtime-project-connection.js";

type GoalBoardMcpToolCallContext = McpToolCallContext;
export interface McpAuthorityState {
  audience: "runtime" | "management";
  connectionState: RuntimeProjectConnection;
  runtimeConnection: GoalBoardRuntimeConnection | null;
  runtimeContextHost: GoalBoardRuntimeContextHost | null;
}
const EMPTY_TOOL_CALL_CONTEXT: McpToolCallContext = { runtimeSessionId: null, runtimeSessionIdSource: null };

export function assertMcpToolAllowed(
  state: McpAuthorityState,
  name: string,
  arguments_: Record<string, unknown>,
  callContext: GoalBoardMcpToolCallContext,
): void {
  if (state.audience === "management") return;
  if (!isRuntimeMcpTool(name)) {
    throw new GoalBoardV1Error(
      "mcp.authority_denied",
      `MCP 权限拒绝：${name} 只允许用户或管理入口调用；Runtime 应提交 Candidate 或把决定交给用户`,
    );
  }
  if (name === "goalboard_v1_review_submit") {
    const payload = (arguments_.payload as Record<string, unknown> | undefined) ?? {};
    if (payload.actor_kind === "user") {
      throw new GoalBoardV1Error(
        "mcp.user_impersonation_denied",
        "MCP 权限拒绝：Runtime 不能声明 actor_kind=user 或代替用户提交 human approval Review",
      );
    }
  }
  if (arguments_.database_path != null || arguments_.web_base_url != null) {
    throw new GoalBoardV1Error(
      "mcp.connection_override_denied",
      "MCP 连接拒绝：Runtime 不能覆盖宿主固定的 SQLite 或 goal_url",
    );
  }
  if (isRuntimeContextMcpTool(name)) {
    requireMcpRuntimeContextHost(state, callContext);
    return;
  }
  if (!state.connectionState.explicit) {
    const host = requireMcpRuntimeContextHost(state, callContext);
    if (state.connectionState.observe(host.runtimeContext) === "refresh_required") {
      throw new GoalBoardV1Error(
        "mcp.context_refresh_required",
        "MCP 当前调用的 Session 身份与已解析的项目连接不连续。请只读调用 goalboard_v1_context_resolve；若返回 bound，请使用原 idempotency_key 原样重试失败调用。不要调用 context_bind，也不要再次询问用户；若未返回 bound，则按 context_resolve 的 next_action 处理。",
        {
          next_action: "context_resolve_then_retry",
          requires_bind: false,
          requires_user_confirmation: false,
          retry_same_idempotency_key: true,
          retry_when_context_status: "bound",
        },
      );
    }
  }
  if (!state.runtimeConnection) {
    throw new GoalBoardV1Error(
      "mcp.connection_incomplete",
      "MCP 尚未连接项目：请先由统一 GoalBoard Skill 调用 goalboard_v1_context_resolve，或由宿主提供固定连接",
    );
  }
  if (arguments_.board_id !== state.runtimeConnection.boardId) {
    throw new GoalBoardV1Error(
      "mcp.board_mismatch",
      `MCP 连接拒绝：Runtime 必须使用宿主固定的 board_id ${state.runtimeConnection.boardId}`,
    );
  }
}

export function requireMcpRuntimeContextHost(
  state: Pick<McpAuthorityState, "runtimeContextHost">,
  callContext: GoalBoardMcpToolCallContext = EMPTY_TOOL_CALL_CONTEXT,
): GoalBoardRuntimeContextHost {
  if (!state.runtimeContextHost) {
    throw new GoalBoardV1Error(
      "mcp.context_host_missing",
      "MCP 宿主没有提供 Runtime 标识；无法解析 Session 或项目目录关联",
    );
  }
  if (!callContext.runtimeSessionId) return state.runtimeContextHost;
  return {
    ...state.runtimeContextHost,
    nativeRuntimeSessionId: callContext.runtimeSessionId,
    runtimeContext: {
      ...state.runtimeContextHost.runtimeContext,
      stable_work_context_id: callContext.runtimeSessionId,
      host_declares_stable: true,
    },
  };
}
