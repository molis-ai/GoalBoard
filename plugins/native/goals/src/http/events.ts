import { randomUUID } from "node:crypto";
import { findHistoryIndexItem, listGoalDocumentHistory } from "../event-document-model.js";
import { renderHistoryItemBody } from "../event-history-body.js";
import type { GoalsHttpContext } from "./types.js";

const WEB_ACTOR = "web-user";

export async function handleGoalEventHttp(context: GoalsHttpContext): Promise<boolean> {
  const goalMatch = context.pathname.match(/^\/api\/goals\/([^/]+)\/(event-state|event-timeline|event-configure|event-report|event-progress|event-concern|event-decision-request|event-agree|event-close|event-resume|event-continue|event-note)$/);
  const eventMatch = context.pathname.match(/^\/api\/goals\/([^/]+)\/events\/([^/]+)$/);
  const historyMatch = context.pathname.match(/^\/api\/goals\/([^/]+)\/history\/([^/]+)$/);
  if (!goalMatch && !eventMatch && !historyMatch) return false;
  const goalId = decodeURIComponent((goalMatch ?? eventMatch ?? historyMatch)![1]!);
  const boardId = context.options.boardId;
  try {
    if (historyMatch && context.method === "GET") {
      const itemId = decodeURIComponent(historyMatch[2]!);
      const snapshot = context.snapshot();
      const item = findHistoryIndexItem({
        boardId, goalId, ports: context.goalEvents, snapshot, events: context.journalEvents(),
      }, itemId);
      if (!item) {
        context.respond(404, { error: "历史记录不存在", code: "event.not_found" });
        return true;
      }
      const html = renderHistoryItemBody(item, lookupsFor(item, boardId, goalId, context), {
        translate: (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => String(values?.[key] ?? "")),
        escapeHtml,
      });
      context.respond(200, { item, html });
      return true;
    }
    if (eventMatch && context.method === "GET") {
      context.respond(200, context.goalEvents.readEvent(boardId, goalId, decodeURIComponent(eventMatch[2]!)));
      return true;
    }
    if (!goalMatch) return false;
    const action = goalMatch[2]!;
    if (context.method === "GET" && action === "event-state") {
      context.respond(200, context.goalEvents.readState(boardId, goalId));
      return true;
    }
    if (context.method === "GET" && action === "event-timeline") {
      const snapshot = context.snapshot();
      context.respond(200, listGoalDocumentHistory({
        boardId,
        goalId,
        ports: context.goalEvents,
        snapshot,
        events: context.journalEvents(),
        query: readTimelineQuery(context),
      }));
      return true;
    }
    if (context.method !== "POST") return false;
    const body = await context.readBody();
    const idempotencyKey = String(body.idempotency_key ?? context.idempotencyHeader ?? `${action}-${randomUUID()}`);
    const actor = { board_id: boardId, goal_id: goalId, actor_id: WEB_ACTOR, actor_kind: "user" as const, idempotency_key: idempotencyKey };
    if (action === "event-configure") {
      return writeOk(context, context.goalEvents.configure({
        ...actor,
        expected_version: Number(body.expected_version),
        types: Array.isArray(body.types) ? body.types as never : undefined,
        adopted_planning: Array.isArray(body.adopted_planning) ? body.adopted_planning as never : undefined,
        adopt_default_requirement_ids: Array.isArray(body.adopt_default_requirement_ids)
          ? body.adopt_default_requirement_ids.map((value) => String(value))
          : undefined,
        requirement_bindings: Array.isArray(body.requirement_bindings) ? body.requirement_bindings as never : undefined,
        new_requirements: Array.isArray(body.new_requirements) ? body.new_requirements as never : undefined,
      }));
    }
    if (action === "event-report") {
      return writeOk(context, context.goalEvents.report({
        ...actor,
        events: Array.isArray(body.events) ? body.events as never : [],
      }));
    }
    if (action === "event-progress") {
      return writeOk(context, context.goalEvents.recordProgress({
        ...actor,
        based_on_cursor: Number(body.based_on_cursor),
        summary: String(body.summary ?? ""),
        next_step: optionalText(body.next_step),
        next_actor: optionalText(body.next_actor),
      }));
    }
    if (action === "event-concern") {
      return writeOk(context, context.goalEvents.applyConcern({
        ...actor,
        action: body.action as never,
        concern_id: optionalText(body.concern_id),
        title: optionalText(body.title),
        statement: optionalText(body.statement),
        scope: body.scope && typeof body.scope === "object" ? body.scope as never : undefined,
        blocks_closure: body.blocks_closure === true ? true : body.blocks_closure === false ? false : undefined,
        reason: optionalText(body.reason),
        supporting_event_ids: Array.isArray(body.supporting_event_ids) ? body.supporting_event_ids.map((value) => String(value)) : undefined,
        cited_decision_id: optionalText(body.cited_decision_id),
      }));
    }
    if (action === "event-decision-request") {
      return writeOk(context, context.goalEvents.requestDecision({
        ...actor,
        question: String(body.question ?? ""),
        options: Array.isArray(body.options) ? body.options as never : [],
        scope: body.scope && typeof body.scope === "object" ? body.scope as never : undefined,
      }));
    }
    if (action === "event-agree") {
      return writeOk(context, context.goalEvents.setAgreement({
        ...actor,
        expected_agreement_version: requiredInt(body.expected_agreement_version, "expected_agreement_version"),
        expected_config_version: requiredInt(body.expected_config_version, "expected_config_version"),
        outcome: optionalText(body.outcome),
        new_requirements: Array.isArray(body.new_requirements) ? body.new_requirements as never : undefined,
      }));
    }
    if (action === "event-close") {
      if (body.kind !== "complete" && body.kind !== "cancel") {
        context.respond(400, { error: "收尾类型只能是 complete 或 cancel", code: "event_closure.invalid_kind" });
        return true;
      }
      return writeOk(context, context.goalEvents.submitClosure({
        ...actor,
        kind: body.kind,
        result: optionalText(body.result),
        reason: String(body.reason ?? ""),
        expected_config_version: requiredInt(body.expected_config_version, "expected_config_version"),
        expected_agreement_version: requiredInt(body.expected_agreement_version, "expected_agreement_version"),
      }));
    }
    if (action === "event-note") {
      return writeOk(context, context.goalEvents.recordNote({
        ...actor,
        body: String(body.body ?? body.note ?? ""),
      }));
    }
    if (action === "event-resume") {
      const resumeKind = String(body.resume_kind ?? "");
      const resumeInput = { ...actor, reason: String(body.reason ?? "") };
      if (resumeKind === "resume_cancelled") {
        return writeOk(context, context.goalEvents.resumeWork(resumeInput));
      }
      if (resumeKind === "reopen_event_completed") {
        return writeOk(context, context.goalEvents.reopenCompletedEventWork(resumeInput));
      }
      const status = context.goalEvents.readState(boardId, goalId).work_status;
      if (status === "cancelled") return writeOk(context, context.goalEvents.resumeWork(resumeInput));
      if (status === "completed") return writeOk(context, context.goalEvents.reopenCompletedEventWork(resumeInput));
      try {
        return writeOk(context, context.goalEvents.reopenCompletedEventWork(resumeInput));
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
        if (code === "event_reopen.not_completed") return writeOk(context, context.goalEvents.resumeWork(resumeInput));
        throw error;
      }
    }
    if (action === "event-continue") {
      return writeOk(context, context.goalEvents.continueWithEventWork({
        ...actor,
        reopen_completed: body.reopen_completed === true,
      }));
    }
    return false;
  } catch (error) {
    const responded = respondGoalEventError(context, error);
    return responded;
  }
}

function readTimelineQuery(context: GoalsHttpContext): { before_cursor?: string; limit?: number } {
  const before = context.search.get("before_cursor");
  const limit = context.search.get("limit");
  return {
    before_cursor: before == null || before === "" ? undefined : before,
    limit: limit == null || limit === "" ? undefined : Number(limit),
  };
}

function lookupsFor(
  item: { source: string; original_id: string; event_id: string | null },
  boardId: string,
  goalId: string,
  context: GoalsHttpContext,
) {
  const snapshot = context.snapshot();
  const requirementNames = Object.fromEntries(
    context.goalEvents.readState(boardId, goalId).requirements.map((row) => [row.requirement_id, row.statement]),
  );
  if (item.source === "event_work" && item.event_id) {
    return { workEvent: context.goalEvents.readEvent(boardId, goalId, item.event_id), requirementNames };
  }
  return {
    run: snapshot.runs.find((row) => row.run_id === item.original_id) ?? null,
    evidence: snapshot.evidence.find((row) => row.evidence_id === item.original_id) ?? null,
    review: snapshot.reviews.find((row) => row.review_id === item.original_id) ?? null,
    journal: context.journalEvents().find((row) => row.event_id === item.original_id) ?? null,
    requirementNames,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || undefined;
}

function requiredInt(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isInteger(number)) throw Object.assign(new Error(`${name} 必须是整数`), { code: "event_http.invalid_version" });
  return number;
}

function writeOk(context: GoalsHttpContext, body: unknown): true {
  context.changed();
  context.respond(200, body);
  return true;
}

function respondGoalEventError(context: GoalsHttpContext, error: unknown): true {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  const details = error && typeof error === "object" && "details" in error ? (error as { details: unknown }).details : undefined;
  const conflict = /version_conflict|stale_version|already_adopted|completed_requires/.test(code);
  context.respond(conflict ? 409 : 400, {
    error: error instanceof Error ? error.message : String(error),
    ...(code ? { code } : {}),
    ...(details !== undefined ? { details } : {}),
  });
  return true;
}
