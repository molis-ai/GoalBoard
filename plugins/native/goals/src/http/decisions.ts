import { randomUUID } from "node:crypto";
import type { GoalsHttpContext } from "./types.js";

export async function handleGoalDecisionsHttp(context: GoalsHttpContext): Promise<boolean> {
  const contractProposalMatch = context.pathname.match(
    /^\/api\/contract-proposals\/([^/]+)\/decision$/,
  );
  const goalTreeProposalMatch = context.pathname.match(
    /^\/api\/goal-tree-proposals\/([^/]+)\/decision$/,
  );
  if (context.method === "POST" && goalTreeProposalMatch) {
    const body = await context.readBody();
    if (Array.isArray(body.risk_repairs)) {
      if (body.decisions != null || body.confirm_all_pending === true) {
        context.respond( 400, { error: "风险修订不能同时提交采用或退回决定" });
        return true;
      }
      const proposalId = decodeURIComponent(goalTreeProposalMatch[1]);
      const prepared = context.goalTreeWebInput.prepareRiskRepair(context.options.boardId, proposalId, {
        risk_repairs: body.risk_repairs, reason: body.reason,
      });
      if ("error" in prepared) {
        context.respond( 400, { error: prepared.error });
        return true;
      }
      const { decisions: revisionDecisions, reason } = prepared;
      try {
        const result = context.goalTreeDecision.decideGoalTreeProposal({
          board_id: context.options.boardId,
          proposal_id: proposalId,
          authority: {
            actor_id: "web-user",
            actor_kind: "user",
            authority_source: "web",
            conversation_ref: `web:${context.options.boardId}`,
            message_ref: `web-risk-repair:${randomUUID()}`,
          },
          decisions: revisionDecisions,
          reason,
          idempotency_key: String(body.idempotency_key ?? `web-risk-repair-${randomUUID()}`),
        });
        context.respond( 200, result);
      } catch (error) {
        context.respond( 400, { error: error instanceof Error ? error.message : String(error) });
      }
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
      const result = context.goalTreeDecision.decideGoalTreeProposal({
        board_id: context.options.boardId,
        proposal_id: proposalId,
        authority: {
          actor_id: "web-user",
          actor_kind: "user",
          authority_source: "web",
          conversation_ref: `web:${context.options.boardId}`,
          message_ref: `web-decision:${randomUUID()}`,
          whole_confirmation_prompted: confirmsWholeProposal,
        },
        decisions,
        reason: decisionReason || undefined,
        confirm_all_pending: confirmsWholeProposal,
        idempotency_key: String(body.idempotency_key ?? `web-goal-tree-decision-${randomUUID()}`),
      });
      context.respond( 200, result);
    } catch (error) {
      context.respond( 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }
  if (context.method === "POST" && contractProposalMatch) {
    const body = await context.readBody();
    const decision = String(body.decision);
    if (decision !== "approved" && decision !== "rejected") {
      context.respond( 400, { error: "decision 必须是 approved 或 rejected" });
      return true;
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      context.respond( 400, { error: "请填写决定理由或修改意见" });
      return true;
    }
    const result = context.legacyContractDecision.decideContractProposal({
      board_id: context.options.boardId,
      proposal_id: decodeURIComponent(contractProposalMatch[1]),
      actor_id: "web-user",
      actor_kind: "user",
      decision,
      reason,
      idempotency_key: String(body.idempotency_key ?? `web-${randomUUID()}`),
    });
    context.respond( 200, result);
    return true;
  }
  const candidateMatch = context.pathname.match(/^\/api\/candidates\/([^/]+)\/decision$/);
  if (context.method === "POST" && candidateMatch) {
    const body = await context.readBody();
    const decision = String(body.decision);
    if (decision !== "approved" && decision !== "rejected") {
      context.respond( 400, { error: "decision 必须是 approved 或 rejected" });
      return true;
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      context.respond( 400, { error: "请填写决定理由或修改意见" });
      return true;
    }
    const result = context.legacyCandidateDecision.decideCandidate({
      board_id: context.options.boardId,
      candidate_id: decodeURIComponent(candidateMatch[1]),
      actor_id: "web-user",
      actor_kind: "user",
      decision,
      reason,
      idempotency_key: String(body.idempotency_key ?? `web-${randomUUID()}`),
    });
    context.respond( 200, result);
    return true;
  }
  const rewireMatch = context.pathname.match(/^\/api\/rewires\/([^/]+)\/(?:decision|confirm)$/);
  if (context.method === "POST" && rewireMatch) {
    const body = await context.readBody();
    const decision = String(body.decision ?? "confirmed");
    if (decision !== "confirmed" && decision !== "rejected") {
      context.respond( 400, { error: "decision 必须是 confirmed 或 rejected" });
      return true;
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      context.respond( 400, { error: "请填写决定理由或修改意见" });
      return true;
    }
    const result = context.legacyRewireDecision.confirmRewire({
      board_id: context.options.boardId,
      rewire_id: decodeURIComponent(rewireMatch[1]),
      actor_id: "web-user",
      actor_kind: "user",
      decision,
      reason,
      idempotency_key: String(body.idempotency_key ?? `web-${randomUUID()}`),
    });
    context.respond( 200, result);
    return true;
  }
  return false;
}
