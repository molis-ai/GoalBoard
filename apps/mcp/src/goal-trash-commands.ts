import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { GoalTrashResult } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalEntryCompositionApi, GoalWorkStateView } from "@adeptify/goalboard-plugin-goals";
import { mcpBoardPayload } from "./payload.js";
import type { McpPresentationErrorFactory } from "./query-presentation.js";

/** Only adapts the user's request and the owner's result; the lifecycle owns all transitions. */
export function createMcpGoalTrashHandlers(
  application: Pick<GoalEntryCompositionApi, "setTrashedWithWorkState"> | AsyncApplicationMethods<Pick<GoalEntryCompositionApi, "setTrashedWithWorkState">>,
  createError: McpPresentationErrorFactory,
) {
  async function setTrashed(args: Record<string, unknown>, trashed: boolean) {
    const payload = mcpBoardPayload<{
      board_id: string; goal_id: string; actor_id: string;
      user_confirmed: boolean; reason: string; idempotency_key: string;
    }>(args);
    if (!payload.user_confirmed) {
      const action = trashed ? "移入回收站" : "恢复";
      throw createError("mcp.user_confirmation_required",
        `当前 Runtime 只有在用户明确要求${action}指定 Goal 后才能调用；请先在当前对话确认。`);
    }
    const { result, work_state } = await application.setTrashedWithWorkState(
      payload.board_id,
      { goal_id: payload.goal_id, trashed, reason: payload.reason },
      { actor_id: payload.actor_id, idempotency_key: payload.idempotency_key },
    );
    return presentGoalTrashResult(result, work_state);
  }
  return {
    goalboard_v1_goal_trash: (args: Record<string, unknown>) => setTrashed(args, true),
    goalboard_v1_goal_restore: (args: Record<string, unknown>) => setTrashed(args, false),
  };
}

function presentGoalTrashResult<T extends GoalTrashResult>(
  result: T,
  workState: GoalWorkStateView,
): T & {
  work_state: GoalWorkStateView;
  next_action: { kind: string; message: string } | null;
} {
  if (result.status === "blocked") {
    return {
      ...result,
      work_state: workState,
      next_action: {
        kind: "finish_active_work",
        message: "这条 Goal 仍有有效 Claim 或未结束 Run；先在当前工作流结束或释放它，再由用户重新确认删除。",
      },
    };
  }
  if (result.pending_relation_ids.length > 0) {
    return {
      ...result,
      work_state: workState,
      next_action: {
        kind: "restore_related_goal",
        message: "关联 Goal 仍在回收站，相关 Relation 会保持停用；恢复另一端后再查看结果。",
      },
    };
  }
  if (result.status === "trashed") {
    return {
      ...result,
      work_state: workState,
      next_action: {
        kind: "report_recoverable_trash",
        message: "Goal 已移入回收站，历史仍被保留；用户可在当前对话随时请求恢复。",
      },
    };
  }
  if (result.status === "restored") {
    return {
      ...result,
      work_state: workState,
      next_action: {
        kind: "read_goal_contract",
        message: "Goal 已恢复；读取其 Contract 或 Available，继续当前状态允许的工作。",
      },
    };
  }
  return { ...result, work_state: workState, next_action: null };
}
