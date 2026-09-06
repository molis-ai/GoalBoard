import type { GoalsContextItem, GoalsContextUiPrimitives, GoalsRecordItem, GoalsRecordRelationsContent } from "./context-ui-model.js";
import { displayedPassedCriterionIds } from "./tree-presentation.js";

export function createGoalContextRecordsRenderer(primitives: GoalsContextUiPrimitives) {
  const { translate: L, escapeHtml, icon, currentLocale, renderList, renderReference, listJoin, formatDate, explainWorkState } = primitives;
function renderAcceptance(item: GoalsContextItem): string {
  if (!item.goal.acceptance_criteria.length) {
    return `<p class="empty-row empty-row--warning">${L("还没有验收条件；这个 Goal 需要继续澄清，暂不能交给执行者。")}</p>`;
  }
  const passedCriteria = new Set(displayedPassedCriterionIds(item));
  return `<ul class="check-list">${item.goal.acceptance_criteria
    .map((criterion) => {
      const passed = passedCriteria.has(criterion.criterion_id);
      const target = criterion.target == null
        ? L("未设置目标值")
        : Object.keys(criterion.target).length === 1 && "value" in criterion.target
          ? String(criterion.target.value)
          : JSON.stringify(criterion.target);
      return `<li><span class="check-box${passed ? " is-checked" : ""}">${passed ? icon("check") : ""}</span><span><strong>${escapeHtml(criterion.statement)}</strong><small>${L("通过条件：")}${escapeHtml(criterion.pass_condition)}</small><small>${L("判断：")}${escapeHtml(criterion.decision_method)} · ${L("目标：")}${escapeHtml(target)} · ${L("证据：")}${escapeHtml(criterion.required_evidence.join(currentLocale() === "en" ? ", " : "、") || L("未指定"))}</small></span></li>`;
    })
    .join("")}</ul>`;
}

function renderScope(item: GoalsContextItem): string {
  const blocks = [
    {
      title: L("包含什么"),
      body: renderList(item.goal.in_scope, "尚未记录范围"),
      empty: item.goal.in_scope.length === 0,
    },
    {
      title: L("明确不做"),
      body: renderList(item.goal.out_of_scope, "尚未记录非目标"),
      empty: item.goal.out_of_scope.length === 0,
    },
    {
      title: L("必须遵守"),
      body: renderList(item.goal.constraints, "暂无额外约束"),
      empty: item.goal.constraints.length === 0,
    },
    {
      title: L("需要的输入"),
      body: renderList(item.goal.required_inputs, "暂无前置输入"),
      empty: item.goal.required_inputs.length === 0,
    },
    {
      title: L("承诺的输出"),
      body: renderList(item.goal.promised_outputs, "尚未记录输出"),
      empty: item.goal.promised_outputs.length === 0,
    },
    {
      title: L("绑定资料"),
      body: item.input_bindings.length
        ? `<div class="bound-list">${item.input_bindings.map((binding) => `<article>${renderReference(binding.source_ref, binding.input_name)}<small>${escapeHtml(binding.state)} · ${escapeHtml(binding.reason)}${binding.snapshot_digest ? ` · ${escapeHtml(binding.snapshot_digest)}` : ""}</small></article>`).join("")}</div>`
        : `<p class="empty-row">${L("暂无资料绑定")}</p>`,
      empty: item.input_bindings.length === 0,
    },
    {
      title: L("需求覆盖"),
      body: item.coverage.length
        ? `<div class="bound-list">${item.coverage.map((coverage) => `<article><strong>${escapeHtml(coverage.requirement_id)} · ${escapeHtml(coverage.statement)}</strong><small>${escapeHtml(coverage.disposition)} · ${coverage.blocking ? L("阻塞") : L("非阻塞")}${coverage.reason ? ` · ${escapeHtml(coverage.reason)}` : ""}${coverage.revisit_condition ? ` · ${L("复查：")}${escapeHtml(coverage.revisit_condition)}` : ""}</small></article>`).join("")}</div>`
        : `<p class="empty-row">${L("暂无需求覆盖记录")}</p>`,
      empty: item.coverage.length === 0,
    },
  ];
  const filled = blocks.filter((block) => !block.empty);
  const vacant = blocks.filter((block) => block.empty);
  const sections = (items: typeof blocks) =>
    items.map((block) => `<section><h3>${block.title}</h3>${block.body}</section>`).join("");
  const gaps = vacant.length
    ? `<details class="scope-gaps" data-persist-open="scope-gaps-${escapeHtml(item.goal.goal_id)}"><summary><span><strong>${
        filled.length ? L("还有 {count} 项未写", { count: vacant.length }) : L("范围、输入与输出尚未填写")
      }</strong><small>${escapeHtml(listJoin(vacant.map((block) => block.title)))}</small></span>${icon("chevron-down")}</summary><div class="contract-list">${sections(vacant)}</div></details>`
    : "";
  if (!filled.length) return gaps;
  return `<div class="contract-list">${sections(filled)}</div>${gaps}`;
}

function renderAcceptanceSummary(item: GoalsContextItem): string {
  if (!item.goal.acceptance_criteria.length) {
    return `<p class="empty-row empty-row--warning">${L("还没有写清怎样才算完成。先补上可判断的完成标准，才能开始工作。")}</p>`;
  }
  const passedCriteria = new Set(displayedPassedCriterionIds(item));
  return `<ul class="check-list check-list--human">${item.goal.acceptance_criteria.map((criterion) => {
    const passed = passedCriteria.has(criterion.criterion_id);
    return `<li><span class="check-box${passed ? " is-checked" : ""}">${passed ? icon("check") : ""}</span><span><strong>${escapeHtml(criterion.statement)}</strong><small>${L("达到下面的结果就算通过：")}${escapeHtml(criterion.pass_condition)}</small></span></li>`;
  }).join("")}</ul>`;
}



  function renderGoalRecordBasics(item: GoalsRecordItem): string {
    const goal = item.goal;
    const owner = item.active_claim_actor ?? goal.accepted_by ?? L("未指定");
    const state = explainWorkState(item.work_state);
    return `<dl class="technical-meta"><div><dt>Goal ID</dt><dd>${escapeHtml(goal.goal_id)}</dd></div><div><dt>${L("创建时间")}</dt><dd>${formatDate(goal.created_at)}</dd></div><div><dt>${L("更新时间")}</dt><dd>${formatDate(goal.updated_at)}</dd></div><div><dt>${L("记录中的负责人")}</dt><dd>${escapeHtml(owner)}</dd></div><div><dt>${L("优先级")}</dt><dd>${goal.priority}</dd></div><div><dt>${L("当前状态")}</dt><dd><strong>${escapeHtml(state.label)}</strong><small>${escapeHtml(state.meaning)}</small></dd></div></dl><section><h3>${L("完成标准")}</h3>${renderAcceptance(item)}</section><section><h3>${L("完整范围、资料和需求覆盖")}</h3>${renderScope(item)}</section>`;
  }
  function renderGoalRecordRelations(content: GoalsRecordRelationsContent): string {
    return `<section><h3>${L("Goal 关系")}</h3>${content.relationsHtml}</section><section><h3>${L("风险与影响范围")}</h3>${content.safetyHtml}</section><section><h3>${L("工作规则")}</h3>${content.policyHtml}</section>`;
  }
  return { renderAcceptance, renderScope, renderAcceptanceSummary, renderGoalRecordBasics, renderGoalRecordRelations };
}
