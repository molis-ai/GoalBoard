import type { GoalsDocumentView, GoalsDecisionEvent } from "@adeptify/goalboard-plugin-goals";
import { EXECUTION_EVIDENCE_KIND_LABELS as EVIDENCE_KIND_LABELS, EXECUTION_EVIDENCE_RESULT_LABELS as EVIDENCE_RESULT_LABELS } from "./execution-validation-ui.js";
export const GOAL_EVENT_PAGE_SIZE = 40;
export interface GoalRecordsPrimitives {
  translate(text: string, values?: Record<string, string | number>): string;
  escapeHtml(value: unknown): string;
  formatDate(value: string): string;
  currentLocale(): string;
}
export function createWorkbenchGoalRecordsRenderer({ translate: L, escapeHtml, formatDate, currentLocale }: GoalRecordsPrimitives) {
function renderHistory(item: GoalsDocumentView): string {
  if (!item.events.length) return '<p class="empty-row">暂无事件记录</p>';
  return `<ol class="history-list">${item.events
    .slice(0, 12)
    .map(
      (event) =>
        `<li><time>${formatDate(event.at)}</time><span><strong>${escapeHtml(event.reason || event.type)}</strong><small>${escapeHtml(event.actor_id)} · ${escapeHtml(event.type)} · #${event.seq}</small></span></li>`,
    )
    .join("")}</ol>`;
}

function renderEventPayload(payload: unknown): string {
  if (payload == null) return L("无结构化详情");
  try {
    return JSON.stringify(payload, null, 2) ?? L("无结构化详情");
  } catch {
    return String(payload);
  }
}


function renderEventLedgerItems(events: GoalsDecisionEvent[]): string {
  return events.map((event) => `<li data-goal-event-seq="${event.seq}"><details><summary><time>${formatDate(event.at)}</time><span><strong>${escapeHtml(event.type)}</strong><small>${escapeHtml(event.actor_id)} · ${escapeHtml(event.object_type)} · ${escapeHtml(event.object_id)} · #${event.seq}</small></span></summary><dl><div><dt>${L("事件 ID")}</dt><dd>${escapeHtml(event.event_id)}</dd></div><div><dt>${L("理由")}</dt><dd>${escapeHtml(event.reason || L("未记录"))}</dd></div></dl><pre>${escapeHtml(renderEventPayload(event.payload))}</pre></details></li>`).join("");
}

function renderEventLedgerPagination(total: number, shown: number): string {
  if (total === 0) return "";
  const hasMore = shown < total;
  return `<footer class="event-ledger-pagination" data-goal-event-pagination data-total="${total}" data-next-offset="${shown}"><span data-goal-event-progress>${L("已显示 {shown}/{total} 条事件", { shown, total })}</span>${hasMore ? `<button type="button" data-load-more-goal-events>${L("加载更早记录")}</button>` : ""}<p data-goal-event-error role="alert" hidden></p></footer>`;
}

function renderFullRecords(item: GoalsDocumentView): string {
  const events = item.events.slice().sort((left, right) => right.seq - left.seq);
  const initialEvents = events.slice(0, GOAL_EVENT_PAGE_SIZE);
  return `<details class="full-records"><summary>${L("查看完整事实记录与事件账本 ")}<span>${L("{count} 条事件", { count: events.length })}</span></summary><div class="record-grid">
    <section><h3>${L("Claim 历史")}</h3>${
      item.claims.length
        ? item.claims.map((claim) => `<p><strong>${escapeHtml(claim.actor_id)}</strong><small>${escapeHtml(claim.claim_id)} · ${escapeHtml(claim.role)} · ${escapeHtml(claim.state)} · ${formatDate(claim.claimed_at)}${claim.release_reason ? ` · ${escapeHtml(claim.release_reason)}` : ""}</small></p>`).join("")
        : `<p class="empty-row">${L("暂无 Claim")}</p>`
    }</section>
    <section><h3>${L("Run 历史")}</h3>${
      item.runs.length
        ? item.runs.map((run) => `<p><strong>${escapeHtml(run.run_id)}</strong><small>${escapeHtml(run.state)} · ${escapeHtml(run.actor_id)} · ${formatDate(run.started_at)}${run.block_reason ? ` · ${escapeHtml(run.block_reason)}` : ""}</small></p>`).join("")
        : `<p class="empty-row">${L("暂无 Run")}</p>`
    }</section>
    <section><h3>${L("Evidence 记录")}</h3>${
      item.evidence.length
        ? item.evidence.map((evidence) => `<p><strong>${escapeHtml(evidence.evidence_id)}</strong><small>${escapeHtml(L(EVIDENCE_KIND_LABELS[evidence.kind]))} · ${escapeHtml(L(EVIDENCE_RESULT_LABELS[evidence.result]))} · ${escapeHtml(evidence.lifecycle_state === "effective" ? L("当前有效") : evidence.lifecycle_state === "superseded" ? L("已被替代") : L("已撤销"))} · ${escapeHtml(evidence.locator_status === "verified" ? L("已验证") : "UNVERIFIED")} · ${escapeHtml(evidence.criterion_ids.join(currentLocale() === "en" ? ", " : "、"))} · ${escapeHtml(evidence.producer_actor_id)}${evidence.correction ? ` · ${escapeHtml(evidence.correction.reason)}` : ""}</small></p>`).join("")
        : `<p class="empty-row">${L("暂无 Evidence")}</p>`
    }</section>
    <section><h3>${L("Review 记录")}</h3>${
      item.reviews.length
        ? item.reviews.map((review) => `<p><strong>${escapeHtml(review.verdict)}</strong><small>${escapeHtml(review.review_id)} · ${escapeHtml(review.actor_id)} · ${escapeHtml(review.reasoning)}${review.evidence_refs.length ? ` · ${escapeHtml(review.evidence_refs.join(currentLocale() === "en" ? ", " : "、"))}` : ""}</small></p>`).join("")
        : `<p class="empty-row">${L("暂无 Review")}</p>`
    }</section>
    <section><h3>${L("策略绑定")}</h3>${
      item.policy_bindings.length
        ? item.policy_bindings.map((binding) => `<p><strong>${escapeHtml(binding.scope)}</strong><small>${escapeHtml(binding.state)} · ${escapeHtml(binding.reason)} · ${escapeHtml(JSON.stringify(binding.policy))}</small></p>`).join("")
        : `<p class="empty-row">${L("使用默认策略")}</p>`
    }</section>
  </div><section class="event-ledger"><header><h3>${L("完整事件账本")}</h3><p>${L("按时间倒序保留 Claim、Run、Evidence、Review、Policy、Risk、Relation、Candidate、Rewire、Contract/Goal Tree Proposal 和澄清相关事件。")}</p></header>${events.length ? `<ol data-goal-event-list>${renderEventLedgerItems(initialEvents)}</ol>${renderEventLedgerPagination(events.length, initialEvents.length)}` : `<p class="empty-row">${L("暂无与这条 Goal 关联的事件")}</p>`}</section></details>`;
}

function renderGoalEventPage(item: GoalsDocumentView, offset: number): string {
  const events = item.events.slice().sort((left, right) => right.seq - left.seq);
  const safeOffset = Math.max(0, Math.trunc(offset));
  const page = events.slice(safeOffset, safeOffset + GOAL_EVENT_PAGE_SIZE);
  const nextOffset = safeOffset + page.length;
  return `<div data-goal-event-page data-next-offset="${nextOffset}" data-total="${events.length}" data-has-more="${nextOffset < events.length}"><ol>${renderEventLedgerItems(page)}</ol></div>`;
}


  return { renderHistory, renderFullRecords, renderGoalEventPage };
}
