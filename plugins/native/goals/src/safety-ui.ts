import { createRiskDecisionRenderer } from "./risk-decision-ui.js";
import type { ImpactBindingRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { UiContribution } from "@adeptify/goalboard-contracts/platform/ui";
import type { GoalsSafetyItem, GoalsSafetyView, GoalsSafetyRisk, GoalsSafetyUiPrimitives } from "./safety-ui-model.js";
import { RISK_STATE_LABELS, RISK_TREATMENT_LABELS, RISK_BLOCKING_LABELS, goalRiskStateEffect, goalRiskHasUserAction } from "./risk-presentation.js";
import { sortGoalTreeItems } from "./tree-order.js";

export const GOALS_SAFETY_UI_CONTRIBUTION_ID = "io.goalboard.native.goals.safety.v1";

function createSafetyRenderer(primitives: GoalsSafetyUiPrimitives) {
  const { translate: L, escapeHtml, formatDate, icon, currentLocale, renderReference, renderList } = primitives;
  const riskStateEffect = (blocking: GoalsSafetyRisk["blocking_mode"], state: GoalsSafetyRisk["state"]) => goalRiskStateEffect(L, blocking, state);
function riskSelectOptions<T extends string>(
  values: Array<[T, string]>,
  selected: T | null,
  placeholder?: string,
): string {
  const options = values
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(L(label))}</option>`)
    .join("");
  return placeholder
    ? `<option value="" disabled${selected == null ? " selected" : ""}>${escapeHtml(L(placeholder))}</option>${options}`
    : options;
}

function renderRiskGoalPicker(
  view: GoalsSafetyView,
  selectedGoalIds: string[],
  label: string,
  key: string,
): string {
  const selected = new Set(selectedGoalIds);
  const goals = sortGoalTreeItems([...view.goals, ...view.archived_goals]);
  return `<details class="risk-goal-picker" data-persist-open="${escapeHtml(key)}">
    <summary><span><strong>${L("受影响 Goal")}</strong><small>${L("{count} 个已选择 · 至少选择一个", { count: selected.size })}</small></span>${icon("chevron-down")}</summary>
    <div><label class="risk-goal-search">${icon("search")}<input type="search" data-risk-goal-filter placeholder="${L("按名称或 ID 筛选")}" aria-label="${escapeHtml(L("筛选{label}的受影响 Goal", { label }))}"></label>
      <div class="risk-goal-options">${goals.map((item) => `<label data-risk-goal-option data-search="${escapeHtml(`${item.goal.title} ${item.goal.goal_id}`.toLocaleLowerCase())}"><input type="checkbox" name="goal_ids" value="${escapeHtml(item.goal.goal_id)}"${selected.has(item.goal.goal_id) ? " checked" : ""}><span><strong>${escapeHtml(item.goal.title)}</strong><small>${escapeHtml(item.goal.goal_id)}${item.goal.archived_at ? L(" · 已归档") : ""}</small></span></label>`).join("")}</div>
    </div>
  </details>`;
}

function renderRiskFactsForm(
  risk: GoalsSafetyRisk | null,
  currentGoalId: string,
  view: GoalsSafetyView,
): string {
  const treatment = risk?.treatment ?? null;
  const blockingMode = risk?.blocking_mode ?? null;
  const formKey = risk?.risk_id ?? `new-${currentGoalId}`;
  return `<label class="risk-form-wide"><span>${L("可能发生什么")}</span><textarea name="description" rows="2" required placeholder="${L("用一句话写清可能出现的问题")}">${escapeHtml(risk?.description ?? "")}</textarea></label>
    <label class="risk-form-wide"><span>${L("会造成什么影响")}</span><textarea name="impact" rows="2" required placeholder="${L("例如：无法按时完成、结果不可信或会影响其他 Goal")}">${escapeHtml(risk?.impact ?? "")}</textarea></label>
    <details class="factor-advanced risk-form-wide" data-progressive-fields>
      <summary><span><strong>${L("补充判断、处理与责任")}</strong><small>${L("保存前还需要说明触发与复查条件，并选择负责人和它是否阻塞 Goal")}</small></span>${icon("chevron-down")}</summary>
      <div class="factor-advanced-grid">
        <label class="risk-form-wide"><span>${L("什么时候算已经发生")}</span><textarea name="trigger" rows="2" required placeholder="${L("写一个可以观察到的触发条件")}">${escapeHtml(risk?.trigger ?? "")}</textarea></label>
        <label class="risk-form-wide"><span>${L("什么时候重新判断")}</span><textarea name="revisit_condition" rows="2" required placeholder="${L("例如：方案确认后、开始执行前或某个结果出现时")}">${escapeHtml(risk?.revisit_condition ?? "")}</textarea></label>
        <label><span>${L("发生概率")}</span><input name="probability" required value="${escapeHtml(risk?.probability ?? "")}" placeholder="${L("低 / 中 / 高，或量化概率")}"></label>
        <label><span>${L("负责人")}</span><input name="owner" required value="${escapeHtml(risk?.owner ?? "")}" placeholder="${L("谁负责持续关注或处理")}"></label>
        <label><span>${L("准备怎么处理")}</span><select name="treatment" required>${riskSelectOptions([["mitigate", "降低发生概率或影响"], ["avoid", "改变方案以避开"], ["defer", "延后处理并继续观察"], ["accept", "接受风险"]], treatment, "请选择处理方式")}</select></label>
        <label><span>${L("它会阻止什么")}</span><select name="blocking_mode" data-risk-blocking-mode required>${riskSelectOptions([["none", "不直接阻塞"], ["claim", "阻止开始执行"], ["completion", "阻止标记完成"], ["invalidate_on_trigger", "发生后使 Goal 失效"]], blockingMode, "请选择对 Goal 的影响")}</select></label>
        <label class="risk-form-wide"><span>${L("具体准备怎么做")} <small>${L("可选")}</small></span><textarea name="treatment_plan" rows="3" placeholder="${L("例如：先限制导入范围，让用户逐条确认，再允许同步到其他执行工具")}">${escapeHtml(risk?.treatment_plan ?? "")}</textarea></label>
        <label class="risk-form-wide"><span>${L("受影响区域 ")}<small>${L("可选，每行一项")}</small></span><textarea name="affected_surfaces" rows="2" placeholder="${L("可以是流程、文档、系统、团队或代码区域")}">${escapeHtml(risk?.affected_surfaces.join("\n") ?? "")}</textarea></label>
        ${renderRiskGoalPicker(view, risk?.goal_ids ?? [currentGoalId], risk?.description ?? L("新风险"), `risk-goals-${formKey}`)}
      </div>
    </details>`;
}

function renderRiskGoalLinks(risk: GoalsSafetyRisk, view: GoalsSafetyView): string {
  const goals = risk.goal_ids
    .map((goalId) => [...view.goals, ...view.archived_goals].find((item) => item.goal.goal_id === goalId))
    .filter((item): item is GoalsSafetyItem => Boolean(item));
  return goals.length
    ? `<div class="risk-linked-goals">${goals.map((item) => `<a href="${item.goal.archived_at ? "/archive/goals/" : "/goals/"}${encodeURIComponent(item.goal.goal_id)}"><strong>${escapeHtml(item.goal.title)}</strong><small>${escapeHtml(item.goal.goal_id)}</small></a>`).join("")}</div>`
    : '<span class="empty-row">未关联 Goal</span>';
}

function renderRiskRecord(
  risk: GoalsSafetyRisk,
  item: GoalsSafetyItem,
  view: GoalsSafetyView,
  readOnly = Boolean(item.goal.archived_at),
  idPrefix = "risk",
): string {
  const resolutionBasis = risk.state === "resolved"
    ? risk.resolution_basis == null
      ? `<div class="risk-resolution risk-resolution--unrecorded"><strong>${L("解决依据")}</strong><p>${L("未记录解决依据（历史数据）；这条状态不会被自动改写。")}</p></div>`
      : `<div class="risk-resolution"><strong>${L("解决依据")}</strong><p>${escapeHtml(risk.resolution_basis.summary)}</p><dl><div><dt>${L("证据引用")}</dt><dd>${risk.resolution_basis.evidence_refs.map((reference) => renderReference(reference)).join("")}</dd></div><div><dt>${L("剩余缺口")}</dt><dd>${risk.resolution_basis.residual_gaps.length ? renderList(risk.resolution_basis.residual_gaps, "") : L("没有已知剩余缺口")}</dd></div></dl></div>`
    : "";
  return `<article class="risk-record" id="${escapeHtml(idPrefix)}-${escapeHtml(risk.risk_id)}">
    <header><span class="risk-record-icon">${icon("risk")}</span><div><span class="risk-state risk-state--${escapeHtml(risk.state)}">${escapeHtml(L(RISK_STATE_LABELS[risk.state]))}</span><h4>${escapeHtml(risk.description)}</h4><small>${escapeHtml(risk.risk_id)} · 更新于 ${formatDate(risk.updated_at)}</small></div></header>
    <dl class="risk-facts">
      <div><dt>${L("概率 / 影响")}</dt><dd>${escapeHtml(risk.probability)} / ${escapeHtml(risk.impact)}</dd></div>
      <div><dt>${L("处理方式 / 对 Goal 的影响")}</dt><dd>${escapeHtml(L(RISK_TREATMENT_LABELS[risk.treatment]))} / ${escapeHtml(L(RISK_BLOCKING_LABELS[risk.blocking_mode]))}</dd></div>
      ${risk.treatment_plan ? `<div class="risk-fact-wide"><dt>${L("具体措施")}</dt><dd>${escapeHtml(risk.treatment_plan)}</dd></div>` : ""}
      <div class="risk-fact-wide"><dt>${L("触发条件")}</dt><dd>${escapeHtml(risk.trigger)}</dd></div>
      <div class="risk-fact-wide"><dt>${L("复查条件")}</dt><dd>${escapeHtml(risk.revisit_condition)}</dd></div>
      <div><dt>${L("负责人")}</dt><dd>${escapeHtml(risk.owner)}</dd></div>
      <div><dt>${L("受影响区域")}</dt><dd>${risk.affected_surfaces.length ? escapeHtml(risk.affected_surfaces.join(currentLocale() === "en" ? ", " : "、")) : "未单独标记"}</dd></div>
      <div class="risk-fact-wide"><dt>${L("受影响 Goal")}</dt><dd>${renderRiskGoalLinks(risk, view)}</dd></div>
    </dl>
    ${resolutionBasis}
    <p class="risk-effect risk-effect--${escapeHtml(risk.state)}">${icon(risk.state === "triggered" ? "blocked" : "info")}<span><strong>${L("当前影响")}</strong>${escapeHtml(riskStateEffect(risk.blocking_mode, risk.state))}</span></p>
    ${readOnly ? `<p class="risk-readonly">${L("这是一条只读记录；请到“关联与约束 → 风险”修改当前事实。")}</p>` : `<div class="risk-actions">
      <details data-persist-open="risk-edit-${escapeHtml(risk.risk_id)}"><summary><span>${icon("settings")}<strong>${L("修改风险信息")}</strong></span>${icon("chevron-down")}</summary>
        <form class="risk-form" data-risk-edit-form data-live-form="risk-edit-${escapeHtml(risk.risk_id)}" data-risk-id="${escapeHtml(risk.risk_id)}" novalidate>
          ${renderRiskFactsForm(risk, item.goal.goal_id, view)}
          <label class="risk-form-wide"><span>${L("修改原因")}</span><textarea name="reason" rows="2" required placeholder="${L("为什么需要更新这项风险或它关联的 Goal")}"></textarea></label>
          <p class="form-error risk-form-wide" data-risk-error role="alert" hidden></p>
          <footer class="risk-form-wide"><span>${L("修改风险事实不会同时改变处理状态。")}</span><button class="button-primary" type="submit">${L("保存风险信息")}</button></footer>
        </form>
      </details>
      ${goalRiskHasUserAction(risk, view) ? `<a class="risk-decision-link" href="/decisions#decision-goal-${encodeURIComponent(item.goal.goal_id)}">${icon("user")}<span><strong>${L("去待决定处理这个风险")}</strong><small>${L("只有必须由你接受或拒绝的风险才会出现在待决定中。")}</small></span>${icon("chevron-right")}</a>` : ""}
    </div>`}
  </article>`;
}

const IMPACT_ACCESS_LABELS: Record<ImpactBindingRecord["access"], string> = {
  read: "只读取",
  write: "会修改",
  decide: "会作出决定",
  exclusive: "执行时独占",
};

const IMPACT_STATE_LABELS: Record<ImpactBindingRecord["state"], string> = {
  proposed: "提议中",
  confirmed: "已确认",
  inactive: "已停用",
};

function impactStateEffect(impact: ImpactBindingRecord): string {
  if (impact.state === "inactive") return L("这条记录只作为历史保留，不再参与工作冲突判断。");
  if (impact.state === "proposed") return L("这条记录尚未确认，不会阻止其他工作开始。");
  if (impact.access === "exclusive") return L("当前 Goal 独占该区域；其他正在进行的 Goal 不能同时读取、修改或作出决定。");
  if (impact.access === "decide") return L("当前 Goal 会在该区域作出决定；其他正在进行的 Goal 如果也读取、修改或决策，会发生冲突。");
  if (impact.access === "write") return L("当前 Goal 会写入该区域；其他写入会冲突，读取方必须固定输入快照。");
  return impact.input_snapshot
    ? L("当前 Goal 只读取该区域，并已固定输入快照，可与写入方并行推进。")
    : L("当前 Goal 只读取该区域，但未固定输入版本；同一区域正在进行的修改会阻止领取。");
}

function renderImpactFactsForm(
  impact: ImpactBindingRecord | null,
  goalId: string,
): string {
  const access = impact?.access ?? null;
  const state = impact == null ? null : impact.state === "proposed" ? "proposed" : "confirmed";
  return `<input type="hidden" name="goal_id" value="${escapeHtml(goalId)}">
    <label class="impact-form-wide"><span>${L("会影响哪里")}</span><input name="surface" required value="${escapeHtml(impact?.surface ?? "")}" placeholder="${L("可以是流程、文档、系统、团队、数据或代码区域")}"></label>
    <label class="impact-form-wide"><span>${L("为什么会影响这里")}</span><textarea name="reason" rows="2" required placeholder="${L("说明这条 Goal 会在这里做什么，以及为什么需要记录")}">${escapeHtml(impact?.reason ?? "")}</textarea></label>
    <details class="factor-advanced impact-form-wide" data-progressive-fields>
      <summary><span><strong>${L("补充影响方式")}</strong><small>${L("保存前需要明确会读取、修改、决策还是独占")}</small></span>${icon("chevron-down")}</summary>
      <div class="factor-advanced-grid">
        <label><span>${L("会怎么影响")}</span><select name="access" required>${riskSelectOptions([["read", "只读取或参考"], ["write", "会修改内容"], ["decide", "会在这里作出决定"], ["exclusive", "执行期间需要独占"]], access, "请选择影响方式")}</select></label>
        <label><span>${L("这条记录是否已确认")}</span><select name="state" required>${riskSelectOptions([["confirmed", "已确认，立即参与冲突判断"], ["proposed", "暂未确认，只保留记录"]], state, "请选择记录状态")}</select></label>
        <label class="impact-form-wide"><span>${L("固定的输入版本 ")}<small>${L("可选；只读取时可用文件版本或事实引用固定输入")}</small></span><input name="input_snapshot" value="${escapeHtml(impact?.input_snapshot ?? "")}" placeholder="${L("例如 commit://abc123、文档版本或 Goal 引用")}"></label>
      </div>
    </details>`;
}

function renderImpactRecord(
  impact: ImpactBindingRecord,
  item: GoalsSafetyItem,
  readOnly = Boolean(item.goal.archived_at),
  idPrefix = "impact",
): string {
  const inactive = impact.state === "inactive";
  return `<article class="impact-record${inactive ? " impact-record--inactive" : ""}" id="${escapeHtml(idPrefix)}-${escapeHtml(impact.binding_id)}">
    <header><span class="impact-record-icon">${icon("impact")}</span><div><span class="impact-access impact-access--${escapeHtml(impact.access)}">${escapeHtml(L(IMPACT_ACCESS_LABELS[impact.access]))}</span><h4>${escapeHtml(impact.surface)}</h4><small>${escapeHtml(impact.binding_id)} · ${inactive ? `停用于 ${formatDate(impact.deactivated_at ?? impact.updated_at)}` : `更新于 ${formatDate(impact.updated_at)}`}</small></div><span class="impact-state impact-state--${escapeHtml(impact.state)}">${escapeHtml(L(IMPACT_STATE_LABELS[impact.state]))}</span></header>
    <dl class="impact-facts">
      <div><dt>${L("访问 / 状态")}</dt><dd>${escapeHtml(L(IMPACT_ACCESS_LABELS[impact.access]))} / ${escapeHtml(L(IMPACT_STATE_LABELS[impact.state]))}</dd></div>
      <div><dt>${L("创建者")}</dt><dd>${escapeHtml(impact.created_by)} · ${formatDate(impact.created_at)}</dd></div>
      <div class="impact-fact-wide"><dt>${L("输入快照")}</dt><dd>${impact.input_snapshot ? renderReference(impact.input_snapshot, "输入快照") : "未固定"}</dd></div>
      <div class="impact-fact-wide"><dt>${L("绑定理由")}</dt><dd>${escapeHtml(impact.reason)}</dd></div>
      ${inactive ? `<div class="impact-fact-wide"><dt>停用原因</dt><dd>${escapeHtml(impact.deactivation_reason ?? L("未记录"))}</dd></div>` : ""}
    </dl>
    <p class="impact-effect impact-effect--${escapeHtml(impact.state)}">${icon(inactive ? "history" : "info")}<span><strong>${L("当前影响")}</strong>${escapeHtml(impactStateEffect(impact))}</span></p>
    ${readOnly || inactive ? (readOnly && !inactive ? `<p class="impact-readonly">${L("这是一条只读记录；请到“关联与约束 → 影响范围”修改当前事实。")}</p>` : "") : `<div class="impact-actions">
      <details data-persist-open="impact-edit-${escapeHtml(impact.binding_id)}"><summary><span>${icon("settings")}<strong>${L("修改影响范围")}</strong></span>${icon("chevron-down")}</summary>
        <form class="impact-form" data-impact-edit-form data-live-form="impact-edit-${escapeHtml(impact.binding_id)}" data-impact-id="${escapeHtml(impact.binding_id)}" novalidate>
          ${renderImpactFactsForm(impact, item.goal.goal_id)}
          <label class="impact-form-wide"><span>${L("修改说明")}</span><textarea name="audit_reason" rows="2" required placeholder="${L("为什么需要更新影响区域、访问方式或状态")}"></textarea></label>
          <p class="form-error impact-form-wide" data-impact-error role="alert" hidden></p>
          <footer class="impact-form-wide"><span>${L("修改会进入变更历史；已停用记录不会原地恢复。")}</span><button class="button-primary" type="submit">${L("保存影响范围")}</button></footer>
        </form>
      </details>
      <details class="impact-deactivate" data-persist-open="impact-deactivate-${escapeHtml(impact.binding_id)}"><summary><span>${icon("archive")}<strong>${L("停用这条记录")}</strong></span>${icon("chevron-down")}</summary>
        <form data-impact-deactivate-form data-live-form="impact-deactivate-${escapeHtml(impact.binding_id)}" data-impact-id="${escapeHtml(impact.binding_id)}">
          <p>${L("停用后不再参与工作冲突判断，但原记录和停用原因会保留在历史中。")}</p>
          <label><span>${L("停用原因")}</span><textarea name="reason" rows="2" required placeholder="${L("说明这条影响范围为什么不再有效")}"></textarea></label>
          <p class="form-error" data-impact-error role="alert" hidden></p>
          <footer><button class="danger-confirm" type="submit">${L("确认停用")}</button></footer>
        </form>
      </details>
    </div>`}
  </article>`;
}

function renderRiskWorkbench(item: GoalsSafetyItem, view: GoalsSafetyView, editable = true, showHeading = true): string {
  const canEdit = editable && !item.goal.archived_at;
  return `<section class="risk-register">${showHeading ? `<header class="safety-subheading"><div><h3>${L("风险")}</h3><p>${L("记录可能影响推进或完成的情况，并说明什么时候需要重新判断。")}</p></div><span>${L("{count} 项", { count: item.risks.length })}</span></header>` : ""}
      ${item.risks.length ? `<div class="risk-list">${item.risks.map((risk) => renderRiskRecord(risk, item, view, !canEdit, editable ? "risk" : "record-risk")).join("")}</div>` : `<p class="risk-empty">${L("当前没有已记录的风险。只有确实需要观察、处理或阻止完成的情况才需要添加。")}</p>`}
      ${canEdit ? `<details class="risk-create" data-persist-open="risk-create-${escapeHtml(item.goal.goal_id)}"><summary><span class="risk-record-icon">${icon("plus")}</span><span><strong>${L("记录风险")}</strong><small>${L("先写清可能发生什么，再设置它如何影响 Goal")}</small></span>${icon("chevron-down")}</summary>
        <form class="risk-form" data-risk-create-form data-live-form="risk-create-${escapeHtml(item.goal.goal_id)}" data-goal-id="${escapeHtml(item.goal.goal_id)}" novalidate>
          ${renderRiskFactsForm(null, item.goal.goal_id, view)}
          <label class="risk-form-wide"><span>${L("登记原因")}</span><textarea name="reason" rows="2" required placeholder="${L("为什么现在需要记录这项风险")}"></textarea></label>
          <p class="form-error risk-form-wide" data-risk-error role="alert" hidden></p>
          <footer class="risk-form-wide"><span>${L("新风险默认处于“开放”状态。")}</span><button class="button-primary" type="submit">${L("记录风险")}</button></footer>
        </form>
      </details>` : ""}
    </section>`;
}

function renderImpactWorkbench(item: GoalsSafetyItem, editable = true, showHeading = true): string {
  const canEdit = editable && !item.goal.archived_at;
  const activeImpacts = item.impacts.filter((impact) => impact.state !== "inactive");
  const inactiveImpacts = item.impacts.filter((impact) => impact.state === "inactive");
  return `<section class="impact-register">${showHeading ? `<header class="safety-subheading"><div><h3>${L("影响范围")}</h3><p>${L("说明这条 Goal 会读取、修改或决定哪些区域，以及是否会和其他工作冲突。")}</p></div><span>${L("{count} 项生效", { count: activeImpacts.length })}${inactiveImpacts.length ? ` · ${L("{count} 项历史", { count: inactiveImpacts.length })}` : ""}</span></header>` : ""}
      <div class="impact-ledger">
      ${activeImpacts.length ? `<div class="impact-list">${activeImpacts.map((impact) => renderImpactRecord(impact, item, !canEdit, editable ? "impact" : "record-impact")).join("")}</div>` : `<p class="impact-empty">${L("当前没有已记录的影响范围。需要协调多人、多 Goal 或共享资源时再添加。")}</p>`}
      ${canEdit ? `<details class="impact-create" data-persist-open="impact-create-${escapeHtml(item.goal.goal_id)}"><summary><span class="impact-record-icon">${icon("plus")}</span><span><strong>${L("记录影响范围")}</strong><small>${L("说明影响哪里、会做什么以及为什么")}</small></span>${icon("chevron-down")}</summary>
        <form class="impact-form" data-impact-create-form data-live-form="impact-create-${escapeHtml(item.goal.goal_id)}" data-goal-id="${escapeHtml(item.goal.goal_id)}" novalidate>
          ${renderImpactFactsForm(null, item.goal.goal_id)}
          <p class="form-error impact-form-wide" data-impact-error role="alert" hidden></p>
          <footer class="impact-form-wide"><span>${L("已确认的影响范围会参与并行工作冲突判断。")}</span><button class="button-primary" type="submit">${L("记录影响范围")}</button></footer>
        </form>
      </details>` : ""}
      ${inactiveImpacts.length ? `<details class="impact-history" data-persist-open="impact-history-${escapeHtml(item.goal.goal_id)}"><summary><span>${icon("history")}<strong>${L("已停用记录")}</strong><small>${inactiveImpacts.length} ${L("条 · 仍可查看原事实和停用原因")}</small></span>${icon("chevron-down")}</summary><div class="impact-list">${inactiveImpacts.map((impact) => renderImpactRecord(impact, item, true, editable ? "impact" : "record-impact")).join("")}</div></details>` : ""}
      </div>
    </section>`;
}

  return { renderRiskDecision: createRiskDecisionRenderer(primitives), renderRiskWorkbench, renderImpactWorkbench };
}

export type GoalsSafetyRenderer = ReturnType<typeof createSafetyRenderer>;
export type GoalsSafetyUiModel = { primitives: GoalsSafetyUiPrimitives } & (
  | { kind: "risk-decision"; args: Parameters<GoalsSafetyRenderer["renderRiskDecision"]> }
  | { kind: "risk"; args: Parameters<GoalsSafetyRenderer["renderRiskWorkbench"]> }
  | { kind: "impact"; args: Parameters<GoalsSafetyRenderer["renderImpactWorkbench"]> }
);

export const goalsSafetyUiContribution: UiContribution<GoalsSafetyUiModel> = {
  descriptor: { contribution_id: GOALS_SAFETY_UI_CONTRIBUTION_ID, plugin_id: "io.goalboard.native.goals", kind: "embedded", label: "Goal risks and impact",
    surfaces: ["risk-decision","risk","impact"].map(surface_id => ({ surface_id, target_slot_id: "workbench.main", format: "declarative-html" })), slots: [] },
  render({ surface, model }) {
    if (surface !== model.kind) throw new Error("Goals safety surface does not match its model");
    const renderer = createSafetyRenderer(model.primitives);
    switch (model.kind) {
      case "risk-decision": return renderer.renderRiskDecision(...model.args);
      case "risk": return renderer.renderRiskWorkbench(...model.args);
      case "impact": return renderer.renderImpactWorkbench(...model.args);
    }
  },
};
