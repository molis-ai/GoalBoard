import type { ExecutionQueryApi } from "@adeptify/goalboard-contracts/modules/execution";

/** Proposal submission authority, using the canonical Run/Claim pair. */
export function requireActiveGoalTreeProposalRun(ports: {
  execution: Pick<ExecutionQueryApi, "getRunWithClaim">;
  clock: () => Date;
  errorFactory: (code: string, message: string, details?: Record<string, unknown>) => Error;
}, boardId: string, runId: string, actorId: string, goalId: string | null = null): {
  goal_id: string; role: "clarifier" | "executor" | "revalidator";
} {
    const recovery = {
      next_action: "draft_dialogue_resume",
      tool: "goalboard_v1_draft_dialogue_resume",
      ...(goalId == null ? {} : { goal_id: goalId }),
      retry_tool: "goalboard_v1_goal_tree_propose",
      retry_with: "returned run.run_id",
      rejected_run_id: runId,
    };
    const pair = ports.execution.getRunWithClaim(boardId, runId);
    if (!pair) {
      throw ports.errorFactory(
        "goal_tree_proposal.run_not_found",
        "找不到提交 Goal Tree 提案所引用的澄清 Run。请先调用 goalboard_v1_draft_dialogue_resume 恢复同一 Draft 的澄清生命周期，再用返回的新 run_id 重试 goalboard_v1_goal_tree_propose。",
        recovery,
      );
    }
    if (pair.run.actor_id !== actorId || pair.claim.actor_id !== actorId) {
      throw ports.errorFactory(
        "goal_tree_proposal.run_not_owner",
        "只有当前澄清 Runtime 可以提交这份 Goal Tree 提案",
      );
    }
    const role = pair.run.role;
    if ((role !== "clarifier" && role !== "executor" && role !== "revalidator") || pair.run.state !== "started") {
      throw ports.errorFactory(
        "goal_tree_proposal.active_run_required",
        "Goal Tree 提案必须来自正在进行中的 clarifier Run，或来自同一 Goal 上只提交 Risk 生命周期结果的 executor / revalidator Run",
        recovery,
      );
    }
    if (pair.claim.state !== "active" || pair.claim.expires_at <= ports.clock().toISOString()) {
      throw ports.errorFactory(
        "goal_tree_proposal.claim_not_active",
        "澄清 Claim 已释放、撤销或过期。请先调用 goalboard_v1_draft_dialogue_resume 恢复同一 Draft，再用返回的新 run_id 重试。",
        recovery,
      );
    }
    return { goal_id: pair.run.goal_id, role };
  }
