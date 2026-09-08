import { randomUUID } from "node:crypto";
import type { GoalsHttpContext } from "./types.js";
import { uniqueTextArray } from "./input.js";

export async function handleGoalVerificationHttp(context: GoalsHttpContext): Promise<boolean> {
  const humanReviewMatch = context.pathname.match(
    /^\/api\/goals\/([^/]+)\/review-obligations\/([^/]+)\/review$/,
  );
  if (context.method === "POST" && humanReviewMatch) {
    const body = await context.readBody();
    const verdict = String(body.verdict ?? "");
    if (!["pass", "needs_changes"].includes(verdict)) {
      context.respond( 400, {
        error: "用户验收结论必须是 pass 或 needs_changes",
      });
      return true;
    }
    try {
      const goalId = decodeURIComponent(humanReviewMatch[1]);
      const obligationId = decodeURIComponent(humanReviewMatch[2]);
      const reasoning = String(body.reasoning ?? "").trim();
      const headerIdempotencyKey = context.idempotencyHeader;
      const idempotencyKey = String(
        body.idempotency_key ??
        (typeof headerIdempotencyKey === "string" ? headerIdempotencyKey : `web-human-review-${randomUUID()}`),
      );
      const result = context.executionCommands.submitHumanReview({
        board_id: context.options.boardId,
        goal_id: goalId,
        obligation_id: obligationId,
        attention_token: String(body.attention_token ?? ""),
        verdict: verdict === "pass" ? "approve" : "request_changes",
        user_id: "web-user",
        session_id: `web:${context.options.boardId}`,
        message_id: idempotencyKey,
        exact_user_quote: reasoning,
        idempotency_key: idempotencyKey,
      });
      context.changed();
      context.respond( 200, result);
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  const goalEvidenceMatch = context.pathname.match(/^\/api\/goals\/([^/]+)\/evidence$/);
  if (context.method === "POST" && goalEvidenceMatch) {
    const body = await context.readBody();
    const criterionIds = uniqueTextArray(body.criterion_ids);
    const kind = String(body.kind ?? "attestation");
    const result = String(body.result ?? "passed");
    const locator = String(body.locator ?? "").trim();
    const digest = typeof body.digest === "string" ? body.digest.trim() : "";
    if (!criterionIds.length) {
      context.respond( 400, { error: "至少选择一条验收条件" });
      return true;
    }
    if (![
      "test",
      "measurement",
      "artifact",
      "inspection",
      "attestation",
      "human_verdict",
    ].includes(kind)) {
      context.respond( 400, { error: "Evidence 类型无效" });
      return true;
    }
    if (!["passed", "failed", "inconclusive"].includes(result)) {
      context.respond( 400, { error: "Evidence 结果必须是 passed、failed 或 inconclusive" });
      return true;
    }
    if (!locator || locator.length > 4_000) {
      context.respond( 400, { error: "Evidence 定位引用不能为空且不能超过 4000 个字符" });
      return true;
    }
    if (digest.length > 16_000) {
      context.respond( 400, { error: "Evidence 摘要不能超过 16000 个字符" });
      return true;
    }
    try {
      const resultValue = context.executionCommands.submitEvidence({
        board_id: context.options.boardId,
        goal_id: decodeURIComponent(goalEvidenceMatch[1]),
        actor_id: "web-user",
        criterion_ids: criterionIds,
        kind: kind as Parameters<typeof context.executionCommands.submitEvidence>[0]["kind"],
        locator,
        locator_context: { project_root: context.options.projectRoot ?? null },
        digest: digest || null,
        result: result as Parameters<typeof context.executionCommands.submitEvidence>[0]["result"],
        contract_revision: Number.isInteger(body.contract_revision) ? Number(body.contract_revision) : undefined,
        action_token: typeof body.action_token === "string" ? body.action_token : undefined,
        idempotency_key: String(body.idempotency_key ?? `web-evidence-${randomUUID()}`),
      });
      context.respond( 201, resultValue);
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  return false;
}
