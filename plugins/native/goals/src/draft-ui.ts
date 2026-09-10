import type { GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsDraftItem, GoalsContextUiPrimitives } from "./context-ui-model.js";
type AcceptanceCriterion = GoalRecord["acceptance_criteria"][number];

export function createGoalDraftRenderer(primitives: Pick<GoalsContextUiPrimitives, "translate" | "escapeHtml" | "icon" | "currentLocale" | "subsectionHeading">) {
  const { translate: L, escapeHtml, icon, currentLocale, subsectionHeading } = primitives;
function renderDraftGaps(item: GoalsDraftItem): string {
  const goal = item.goal;
  if (item.status === "clarification_decision_pending") {
    return `<div class="draft-gaps draft-gaps--decision"><div><strong>${L("方案已经整理好")}</strong><p>${L("这条 Goal 不是还要继续澄清，而是在等你确认整理后的结果、范围和子 Goal。采用后才会更新正式内容。")}</p></div><a href="/decisions#decision-goal-${encodeURIComponent(goal.goal_id)}">${L("查看方案并决定")}</a></div>`;
  }
  if (goal.definition_state !== "draft") return "";
  const gaps = [
    !goal.outcome.trim() ? L("要得到的结果") : "",
    !goal.why.trim() ? L("为什么做") : "",
    !goal.business_logic.trim() ? L("实际运转方式") : "",
    !goal.in_scope.length ? L("包含范围") : "",
    !goal.out_of_scope.length ? L("明确不做") : "",
    !goal.promised_outputs.length ? L("承诺输出") : "",
    !goal.acceptance_criteria.length ? L("验收条件") : "",
  ].filter(Boolean);
  if (!gaps.length) return "";
  return `<div class="draft-gaps"><div><strong>${L("这条 Goal 还没说清楚")}</strong><p>${L("还需要补全：{gaps}。保存只会更新说明；确认后才能开始。", { gaps: gaps.join(currentLocale() === "en" ? ", " : "、") })}</p></div><a href="#goal-requirements-${escapeHtml(goal.goal_id)}">${L("查看完成标准")}</a></div>`;
}

const DECOMPOSITION_OPTIONS = [
  ["abstract", "仍需拆分", "方向还比较抽象，需要继续找到可独立交付的结果。"],
  ["frontier_open", "已经拆出一部分", "已经有部分可以开始，但拆分工作还没有结束。"],
  ["closed_leaf", "可以独立完成", "这条 Goal 可以独立推进、独立交付，并有自己的完成标准。"],
  ["closed_compound", "由子 Goal 共同完成", "这条上层 Goal 不直接执行；完成所有子 Goal 后它会自动完成。"],
] as const;

function renderDecisionMethodOptions(selected: AcceptanceCriterion["decision_method"]): string {
  return ([
    ["automated_check", L("自动检查")],
    ["measurement", L("量化测量")],
    ["inspection", L("人工检查")],
    ["human_decision", L("用户判断")],
  ] as const)
    .map(([value, label]) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`)
    .join("");
}

function renderCriterionTarget(target: Record<string, unknown> | null | undefined): string {
  if (target == null) return "";
  if (Object.keys(target).length === 1 && "value" in target) return String(target.value ?? "");
  return JSON.stringify(target);
}

function renderDraftCriterionRow(
  criterion: AcceptanceCriterion | undefined,
  index: number,
): string {
  return `<article class="criterion-editor-row" data-criterion-row>
    <header><strong data-criterion-number>验收条件 ${index}</strong><button type="button" data-remove-criterion aria-label="${L("移除这条验收条件")}">${icon("x")}<span>${L("移除")}</span></button></header>
    <div class="criterion-editor-grid">
      <label class="criterion-statement"><span>${L("检查什么")}</span><input data-criterion-field="statement" value="${escapeHtml(criterion?.statement ?? "")}" placeholder="${L("例如：用户可以保存 Draft 后再次打开")}"></label>
      <label><span>${L("判断方式")}</span><select data-criterion-field="decision_method">${renderDecisionMethodOptions(criterion?.decision_method ?? "inspection")}</select></label>
      <label class="criterion-pass"><span>${L("怎样算通过")}</span><textarea rows="2" data-criterion-field="pass_condition" placeholder="${L("写出明确、可判断的通过条件")}">${escapeHtml(criterion?.pass_condition ?? "")}</textarea></label>
      <label><span>${L("目标值 ")}<small>${L("可选")}</small></span><input data-criterion-field="target" value="${escapeHtml(renderCriterionTarget(criterion?.target))}" placeholder="${L("例如 100%、≤ 2 秒或 JSON")}"></label>
      <label><span>${L("所需证据类型")}</span><input data-criterion-field="required_evidence" value="${escapeHtml(criterion?.required_evidence.join(", ") ?? "")}" placeholder="${L("例如 test, inspection")}"></label>
      <label><span>${L("条件 ID ")}<small>${L("可选，留空自动生成")}</small></span><input data-criterion-field="criterion_id" value="${escapeHtml(criterion?.criterion_id ?? "")}" placeholder="${L("例如 DRAFT-C1")}"></label>
    </div>
  </article>`;
}

function renderDraftEditor(item: GoalsDraftItem): string {
  const goal = item.goal;
  if (goal.definition_state !== "draft") return "";
  const criteria = goal.acceptance_criteria.length
    ? goal.acceptance_criteria.map((criterion, index) => renderDraftCriterionRow(criterion, index + 1)).join("")
    : renderDraftCriterionRow(undefined, 1);
  const listValue = (values: string[]) => escapeHtml(values.join("\n"));
  const decompositionOptions = DECOMPOSITION_OPTIONS.map(
    ([value, label, description]) => `<label class="decomposition-choice"><input type="radio" name="decomposition_state" value="${value}"${goal.decomposition_state === value ? " checked" : ""}><span><strong>${L(label)}</strong><small>${L(description)}</small></span></label>`,
  ).join("");
  return `<div class="draft-editor-section" data-draft-editor data-goal-id="${escapeHtml(goal.goal_id)}">
    ${subsectionHeading("clipboard", "修改目标说明和完成标准", "这里只修改尚未确认的草稿；保存不会让它自动开始。")}
    <form class="draft-contract-form" data-draft-form data-live-form="draft-${escapeHtml(goal.goal_id)}" data-goal-id="${escapeHtml(goal.goal_id)}">
      <div class="draft-form-row draft-form-row--title"><label><span>${L("Goal 名称")}</span><input name="title" required maxlength="120" value="${escapeHtml(goal.title)}"></label><label><span>${L("优先级")}</span><input name="priority" type="number" min="0" max="100" step="1" value="${goal.priority}"></label></div>
      <label class="draft-field"><span>${L("要得到的结果")}</span><textarea name="outcome" rows="2" placeholder="${L("完成后，用户或系统获得什么可观察结果")}">${escapeHtml(goal.outcome)}</textarea></label>
      <label class="draft-field"><span>${L("为什么现在做")}</span><textarea name="why" rows="2" placeholder="${L("说明问题和这项工作的价值")}">${escapeHtml(goal.why)}</textarea></label>
      <label class="draft-field"><span>${L("它会怎样运转")}</span><textarea name="business_logic" rows="3" placeholder="${L("用简单语言说明实际使用方式和边界")}">${escapeHtml(goal.business_logic)}</textarea></label>
      <div class="draft-list-grid">
        <label><span>${L("包含范围 ")}<small>${L("每行一项")}</small></span><textarea name="in_scope" rows="4">${listValue(goal.in_scope)}</textarea></label>
        <label><span>${L("明确不做 ")}<small>${L("每行一项")}</small></span><textarea name="out_of_scope" rows="4">${listValue(goal.out_of_scope)}</textarea></label>
        <label><span>${L("约束 ")}<small>${L("每行一项")}</small></span><textarea name="constraints" rows="4">${listValue(goal.constraints)}</textarea></label>
        <label><span>${L("需要的输入 ")}<small>${L("每行一项")}</small></span><textarea name="required_inputs" rows="4">${listValue(goal.required_inputs)}</textarea></label>
        <label><span>${L("承诺输出 ")}<small>${L("每行一项")}</small></span><textarea name="promised_outputs" rows="4">${listValue(goal.promised_outputs)}</textarea></label>
      </div>
      <fieldset class="decomposition-editor"><legend>${L("这条 Goal 现在拆到什么程度？")}</legend><div>${decompositionOptions}</div></fieldset>
      <section class="criteria-editor" aria-labelledby="criteria-editor-${escapeHtml(goal.goal_id)}">
        <header><div><h3 id="criteria-editor-${escapeHtml(goal.goal_id)}">${L("完成标准详情")}</h3><p>${L("每一条都要写清检查什么、怎样算通过，以及需要什么依据。")}</p></div><button type="button" data-add-criterion>${icon("plus")}<span>${L("添加完成标准")}</span></button></header>
        <div class="criteria-editor-list" data-criteria-list>${criteria}</div>
        <template data-criterion-template>${renderDraftCriterionRow(undefined, 1)}</template>
      </section>
      <label class="draft-field"><span>${L("本次修改原因")}</span><textarea name="reason" rows="2" required placeholder="${L("例如：补充用户确认的范围和验收条件")}"></textarea></label>
      <p class="form-error" data-draft-error role="alert" hidden></p>
      <footer><span>${L("保存只会更新这条草稿。之前等待确认的版本会作废，需要重新确认。")}</span><button class="button-primary" type="submit">${L("保存草稿修改")}</button></footer>
    </form>
    <div class="draft-auxiliary">
      <a class="draft-policy-link" href="#goal-factor-panel-risks-${escapeHtml(goal.goal_id)}">${icon("risk")}<span><strong>${L("登记风险")}</strong><small>${L("记录什么情况会影响推进或完成，以及准备怎样处理。")}</small></span>${icon("arrow")}</a>
      <a class="draft-policy-link" href="#goal-factor-panel-impacts-${escapeHtml(goal.goal_id)}">${icon("impact")}<span><strong>${L("记录影响范围")}</strong><small>${L("说明这项工作会读写哪些区域，以及影响现在是否仍然存在。")}</small></span>${icon("arrow")}</a>
      <a class="draft-policy-link" href="#goal-factor-panel-rules-${escapeHtml(goal.goal_id)}">${icon("settings")}<span><strong>${L("设置执行和检查规则")}</strong><small>${L("设置谁可以推进、需要哪些检查，以及最长可以领取多久。")}</small></span>${icon("arrow")}</a>
    </div>
  </div>`;
}


  return { renderDraftGaps, renderDraftEditor };
}
