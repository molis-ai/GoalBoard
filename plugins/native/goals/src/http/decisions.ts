import type { GoalsHttpContext } from "./types.js";

export async function handleGoalDecisionsHttp(context: GoalsHttpContext): Promise<boolean> {
  const goalTreeProposalMatch = context.pathname.match(
    /^\/api\/goal-tree-proposals\/([^/]+)\/decision$/,
  );
  if (context.method === "POST" && goalTreeProposalMatch) {
    const body = await context.readBody();
    if (Array.isArray(body.risk_repairs)) {
      context.respond(400, {
        error: "结构提案不再接受风险修订。历史风险条目仍可阅读；新结构只提交 goal/create 与 relation/create|deactivate。",
        code: "goal_tree_proposal.kind_retired",
      });
      return true;
    }
    if (body.decisions != null && !Array.isArray(body.decisions)) {
      context.respond( 400, { error: "decisions 必须是条目决定列表" });
      return true;
    }
    try {
      const proposalId = decodeURIComponent(goalTreeProposalMatch[1]);
      const confirmsWholeProposal = body.confirm_all_pending === true;
      const { decisions, decisionReason } = context.goalTreeWebInput.prepareDecision(context.options.boardId, proposalId, body);
      const idempotencyKey = String(body.idempotency_key ?? context.idempotencyHeader ?? "");
      const result = context.goalTreeDecision.decideGoalTreeProposal({
        board_id: context.options.boardId,
        proposal_id: proposalId,
        authority: {
          actor_id: "web-user",
          actor_kind: "user",
          authority_source: "web",
          conversation_ref: `web:${context.options.boardId}`,
          message_ref: `web-decision:${idempotencyKey}`,
          whole_confirmation_prompted: confirmsWholeProposal,
        },
        decisions,
        reason: decisionReason || undefined,
        confirm_all_pending: confirmsWholeProposal,
        idempotency_key: idempotencyKey,
      });
      context.respond( 200, result);
    } catch (error) {
      context.respond( 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }
  return false;
}
