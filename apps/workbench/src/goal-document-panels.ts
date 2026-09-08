import { displayedPassedCriterionIds, type GoalsDocumentView as WebGoalView } from "@adeptify/goalboard-plugin-goals";
import type { ExecutionRunRecord as RunRecord } from "@adeptify/goalboard-contracts/modules/execution";
import type { GoalBoardIcon } from "@adeptify/goalboard-design-system";
import type { GoalBoardWebView } from "./page-view.js";
import type { createWorkbenchFocusSections } from "./focus-sections.js";
import { latestWorkbenchRun, type WorkbenchExecutionValidationRenderer } from "./execution-validation-ui.js";
import type { createWorkbenchGoalRecordsRenderer } from "./goal-records-renderer.js";
import type { createWorkbenchGoalsContextRenderer, createWorkbenchGoalsSafetyRenderer, createWorkbenchGoalsPolicyRenderer, createWorkbenchGoalsRelationRenderer } from "./ui-composition.js";

export interface GoalDocumentPanelOwners {
  L(text: string, values?: Record<string, string | number>): string;
  escapeHtml(value: unknown): string;
  icon(name: GoalBoardIcon): string;
  renderFocusSectionDeck: ReturnType<typeof createWorkbenchFocusSections>["renderFocusSectionDeck"];
  execution: Pick<WorkbenchExecutionValidationRenderer, "renderClaimCell" | "renderRunCell" | "renderEvidenceCell" | "renderReviewCell" | "renderEvidenceForm">;
  context: Pick<ReturnType<typeof createWorkbenchGoalsContextRenderer>, "renderGoalRecordBasics" | "renderGoalRecordRelations">;
  safety: Pick<ReturnType<typeof createWorkbenchGoalsSafetyRenderer>, "renderSafety" | "renderQuickRiskForm" | "renderQuickImpactForm" | "renderProgressRiskSummary">;
  policy: Pick<ReturnType<typeof createWorkbenchGoalsPolicyRenderer>, "renderPolicyEditor" | "renderProgressCheckSummary">;
  records: Pick<ReturnType<typeof createWorkbenchGoalRecordsRenderer>, "renderHistory" | "renderFullRecords">;
  renderRelationForm: ReturnType<typeof createWorkbenchGoalsRelationRenderer>["renderRelationForm"];
  renderRelations(item: WebGoalView, view: GoalBoardWebView, editable?: boolean): string;
}

/** Compose the registered owner renderers; no Module facts or execution permissions are written here. */
export function createWorkbenchGoalDocumentPanels(owners: GoalDocumentPanelOwners) {
  const { L, escapeHtml, icon, renderFocusSectionDeck, renderRelationForm, renderRelations } = owners;
  const { renderClaimCell, renderRunCell, renderEvidenceCell, renderReviewCell, renderEvidenceForm } = owners.execution;
  const { renderGoalRecordBasics, renderGoalRecordRelations } = owners.context;
  const { renderSafety, renderQuickRiskForm, renderQuickImpactForm, renderProgressRiskSummary } = owners.safety;
  const { renderPolicyEditor, renderProgressCheckSummary } = owners.policy;
  const { renderHistory, renderFullRecords } = owners.records;
function renderReasons(item: WebGoalView): string {
  const blockers = item.reasons.filter((reason) => reason.severity === "blocker");
  if (!blockers.length) {
    return `<p class="clear-row"><span class="check-box is-checked">${icon("check")}</span>${L("当前没有阻塞项")}</p>`;
  }
  return `<ul class="blocker-list">${blockers
    .map(
      (reason) =>
        `<li>${icon("blocked")}<span><strong>${escapeHtml(reason.message)}</strong>${
          reason.remediation ? `<small>${L("建议：")}${escapeHtml(reason.remediation)}</small>` : ""
        }</span></li>`,
    )
    .join("")}</ul>`;
}

function renderCompanionRuntime(item: WebGoalView): string {
  const claim = item.active_claim;
  const lease = item.active_claim_lease;
  const run = [...item.runs].reverse().find((candidate) => candidate.state === "started" || candidate.state === "blocked") ?? item.runs.at(-1);
  const total = item.goal.acceptance_criteria.length;
  const passed = displayedPassedCriterionIds(item).length;
  const progress = total ? Math.round((passed / total) * 100) : 0;
  const runtime = claim?.actor_id ?? run?.actor_id ?? L("执行会话");
  const state = claim
    ? run?.state === "blocked" ? L("执行受阻") : L("正在推进")
    : run ? L("最近有进展") : L("尚未绑定");
  const leaseNotice = lease
    ? `<p class="companion-runtime-lease${lease.renew_recommended ? " is-warning" : ""}">${icon("clock")}<span>${L("租约还剩 {count} 分钟", { count: Math.max(1, Math.ceil(lease.remaining_seconds / 60)) })} · ${L("到期前续租可保持当前 Claim 和 Run")}</span></p>`
    : "";
  return `<section class="companion-runtime" data-companion-runtime aria-labelledby="companion-runtime-${escapeHtml(item.goal.goal_id)}">
    <header><div><small>Runtime</small><h2 id="companion-runtime-${escapeHtml(item.goal.goal_id)}">${escapeHtml(runtime)}</h2></div><span class="companion-runtime-state${claim ? " is-active" : ""}"><i aria-hidden="true"></i>${escapeHtml(state)}</span></header>
    <p>${escapeHtml(plainRunState(run))}</p>
    ${leaseNotice}
    <div class="companion-runtime-progress" aria-label="${L("完成标准进度 {passed}/{total}", { passed, total })}"><i><b style="--companion-progress:${progress}%"></b></i><span>${passed}/${total}</span></div>
    <dl><div><dt>${L("完成依据")}</dt><dd>${L("{count} 条", { count: item.evidence.length })}</dd></div><div><dt>${L("执行记录")}</dt><dd>${escapeHtml(run?.state ?? L("未开始"))}</dd></div></dl>
    <button type="button" data-companion-runtime-open>${L("在 Runtime 查看会话")}${icon("chevron-right")}</button>
  </section>`;
}

function plainRunState(run: RunRecord | undefined): string {
  if (!run) return L("还没有开始推进。")
  if (run.state === "started") return L("最近一次推进正在进行。")
  if (run.state === "blocked") return L("最近一次推进被挡住了。")
  if (run.state === "completed") return L("最近一次推进已经结束并提交了结果。")
  if (run.state === "failed") return L("最近一次推进失败了，需要查看原因后再试。")
  return L("最近一次推进已经停止。")
}

function renderProgressOverview(item: WebGoalView): string {
  const latestRun = latestWorkbenchRun(item.runs);
  const latestRunIsCurrent = latestRun != null &&
    item.active_claim?.claim_id === latestRun.claim_id &&
    (latestRun.state === "started" || latestRun.state === "blocked");
  const latestBlocker = latestRun?.block_reason
    ? latestRunIsCurrent
      ? `<small>${L("当前阻塞：{reason}", { reason: latestRun.block_reason })}</small>`
      : `<small>${L("当时记录：{reason}。这不是当前阻塞；当前状态以“当前阻塞”页为准。", { reason: latestRun.block_reason })}</small>`
    : "";
  const activeRisks = item.risks.filter((risk) => risk.state === "open" || risk.state === "triggered");
  const pendingReviews = item.review_obligations.filter((review) => review.state === "pending").length;
  const stateBody = `<dl class="progress-facts">
      <div><dt>${L("谁在推进")}</dt><dd>${escapeHtml(item.active_claim_actor ? L("{name} 正在推进", { name: item.active_claim_actor }) : L("现在还没有人或工具在推进"))}</dd></div>
      <div><dt>${L("最近进展")}</dt><dd>${escapeHtml(plainRunState(latestRun))}${latestBlocker}</dd></div>
      <div><dt>${L("完成依据")}</dt><dd>${L("已有 {evidence} 条依据，{passed}/{total} 条完成标准通过", { evidence: item.evidence.length, passed: displayedPassedCriterionIds(item).length, total: item.goal.acceptance_criteria.length })}</dd></div>
      <div><dt>${L("还要检查")}</dt><dd>${pendingReviews ? L("还有 {count} 项检查没有完成", { count: pendingReviews }) : L("当前没有未完成的检查")}</dd></div>
    </dl>`;
  const blockerBody = `<div class="progress-blockers"><h3>${L("当前有什么会挡住它")}</h3>${renderReasons(item)}</div>`;
  const riskBody = renderProgressRiskSummary(item.risks);
  const ruleBody = renderProgressCheckSummary(item.resolved_policy);
  return renderFocusSectionDeck([
    { key: "state", iconName: "activity", title: L("推进状态"), description: L("负责人、最近进展、完成依据和待检查项"), body: stateBody, active: true },
    { key: "blockers", iconName: "blocked", title: L("当前阻塞"), description: L("仍会挡住推进或完成的事实"), body: blockerBody },
    { key: "risks", iconName: "risk", title: L("开放风险"), description: L("仍可能改变推进结果的风险"), body: riskBody, count: activeRisks.length },
    { key: "checks", iconName: "check", title: L("完成检查"), description: L("完成前仍需通过的检查规则"), body: ruleBody },
  ], L("进展与阻塞"), "focus-section-deck--progress progress-overview");
}

function renderQuickRecordDialog(item: WebGoalView, view: GoalBoardWebView): string {
  const goalId = escapeHtml(item.goal.goal_id);
  const choices = [
    ["evidence", "evidence", L("完成依据"), L("记录能证明完成标准是否达到的事实")],
    ["risk", "risk", L("风险"), L("记录可能影响推进或完成的情况")],
    ["impact", "impact", L("影响范围"), L("记录会读取、修改或决定的区域")],
    ["relation", "link", L("Goal 关系"), L("记录层级、依赖或其他 Goal 关联")],
  ] as const;
  return `<dialog class="create-dialog quick-record-dialog" data-quick-record-dialog data-goal-id="${goalId}" aria-labelledby="quick-record-title-${goalId}">
    <div class="dialog-shell">
      <header><div><span class="dialog-icon">${icon("plus")}</span><div><h2 id="quick-record-title-${goalId}" data-quick-record-title>${L("快速记录")}</h2><p>${L("所有内容都会绑定到当前 Goal：{name}", { name: item.goal.title })}</p></div></div><button class="icon-button" type="button" data-close-quick-record aria-label="${L("关闭")}">${icon("x")}</button></header>
      <div class="dialog-body quick-record-body">
        <div class="quick-record-choices" data-quick-record-choices>
          <p>${L("你要补充哪类事实？")}</p>
          <div>${choices.map(([key, iconName, title, description]) => `<button type="button" data-quick-record-type="${key}">${icon(iconName)}<span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span>${icon("chevron-right")}</button>`).join("")}</div>
        </div>
        <section class="quick-record-panel" data-quick-record-panel="evidence" hidden><button class="quick-record-back" type="button" data-quick-record-back>${icon("chevron-right")}${L("换一种记录")}</button>${renderEvidenceForm(item, "quick")}</section>
        <section class="quick-record-panel" data-quick-record-panel="risk" hidden><button class="quick-record-back" type="button" data-quick-record-back>${icon("chevron-right")}${L("换一种记录")}</button>${renderQuickRiskForm(item, view)}</section>
        <section class="quick-record-panel" data-quick-record-panel="impact" hidden><button class="quick-record-back" type="button" data-quick-record-back>${icon("chevron-right")}${L("换一种记录")}</button>${renderQuickImpactForm(item)}</section>
        <section class="quick-record-panel" data-quick-record-panel="relation" hidden><button class="quick-record-back" type="button" data-quick-record-back>${icon("chevron-right")}${L("换一种记录")}</button>${renderRelationForm(item, view, "quick")}</section>
      </div>
    </div>
  </dialog>`;
}

function renderGoalTechnicalDetails(item: WebGoalView, view: GoalBoardWebView): string {
  const goal = item.goal;
  const basics = renderGoalRecordBasics(item);
  const execution = `<div id="execution-${escapeHtml(goal.goal_id)}"><div class="runtime-grid"><section><h3>${L("领取记录")} <span>${L("谁领取了工作")}</span></h3>${renderClaimCell(item)}</section><section><h3>${L("推进记录")} <span>${L("每次推进")}</span></h3>${renderRunCell(item)}</section><section><h3>${L("完成依据")}</h3>${renderEvidenceCell(item, false)}</section><section><h3>${L("检查记录")}</h3>${renderReviewCell(item)}</section></div></div>`;
  const history = `${renderHistory(item)}${renderFullRecords(item)}`;
  const relationships = renderGoalRecordRelations({
    relationsHtml: renderRelations(item, view, false),
    safetyHtml: renderSafety(item, view, false),
    policyHtml: renderPolicyEditor(item, { editGoal: false, editProject: false }),
  });
  return `<section class="goal-technical" data-goal-section="technical">
    <header><span>${icon("history")}</span><span><strong>${L("完整记录")}</strong><small>${L("只读查看这条 Goal 的原始事实和变更历史；修改请去对应功能区。")}</small></span></header>
    <div class="goal-technical-body">${renderFocusSectionDeck([
      { key: "basics", iconName: "clipboard", title: L("基础信息"), description: L("目标标识、负责人、时间、状态和完整工作边界"), body: basics, active: true, cardClass: "goal-record-section" },
      { key: "execution", iconName: "activity", title: L("执行与检查"), description: L("领取、推进、完成依据和检查记录"), body: execution, cardClass: "goal-record-section" },
      { key: "history", iconName: "history", title: L("变更历史"), description: L("按时间查看发生过什么、由谁修改"), body: history, cardClass: "goal-record-section" },
      { key: "rules", iconName: "link", title: L("关联与规则记录"), description: L("关系、风险、影响范围和生效规则的只读记录"), body: relationships, cardClass: "goal-record-section" },
    ], L("完整记录"), "focus-section-deck--records")}</div>
  </section>`;
}

function renderGoalProgressPanel(item: WebGoalView): string {
  return `<section class="focus-panel" data-goal-section="progress" id="progress-${escapeHtml(item.goal.goal_id)}">
    <header class="focus-panel-heading">${icon("workflow")}<div><h2>${L("进展与阻塞")}</h2><p>${L("执行情况、依据、检查、阻塞和风险。")}</p></div></header>
    ${renderProgressOverview(item)}
  </section>`;
}


  return { renderCompanionRuntime, renderQuickRecordDialog, renderGoalTechnicalDetails, renderGoalProgressPanel };
}
