import type { GoalsContextItem, GoalsContextView, GoalsContextUiPrimitives } from "./context-ui-model.js";
import { activeOutgoingDependsOn, findGoalTreeItem as findGoalView, goalWorkSatisfied, partOfChildViews } from "./tree-presentation.js";
import { sortGoalTreeItems as sortGoals } from "./tree-order.js";

export function createGoalContextCoverageRenderer(primitives: GoalsContextUiPrimitives) {
  const { translate: L, escapeHtml, icon, renderList, subsectionHeading, explainWorkState, explainParentCompletion } = primitives;
function renderCompletionBoundaries(item: GoalsContextItem): string {
  const visible = [
    [L("这次会做"), item.goal.in_scope, L("还没有写清这次会做什么。")],
    [L("这次不做"), item.goal.out_of_scope, L("还没有写清这次不做什么。")],
    [L("完成后会交付"), item.goal.promised_outputs, L("还没有写清完成后会交付什么。")],
  ] as const;
  const supporting = [
    [L("开始前需要"), item.goal.required_inputs, L("没有额外输入要求。")],
    [L("必须遵守"), item.goal.constraints, L("没有额外约束。")],
  ] as const;
  return `<div class="completion-boundaries">${visible.map(([title, values, empty]) => `<section><h3>${escapeHtml(title)}</h3>${renderList(values, empty)}</section>`).join("")}</div>
    <details class="supporting-boundaries"><summary>${L("查看开始前需要的内容和必须遵守的限制")}${icon("chevron-down")}</summary><div>${supporting.map(([title, values, empty]) => `<section><h3>${escapeHtml(title)}</h3>${renderList(values, empty)}</section>`).join("")}</div></details>`;
}

function renderChildProgress(item: GoalsContextItem, view: GoalsContextView): string {
  const children = sortGoals(partOfChildViews(item.goal.goal_id, view));
  if (!children.length) return "";
  const done = children.filter(goalWorkSatisfied).length;
  const completion = explainParentCompletion(item.goal, done, children.length);
  return `<div class="child-progress child-progress--${completion.tone}"><header><div><h3>${L("父 Goal 如何完成")}</h3><p class="child-progress-rule"><strong>${escapeHtml(completion.label)}</strong><span>${escapeHtml(completion.meaning)}</span></p></div><strong>${done}/${children.length}</strong></header><ul>${children.map((child) => {
    const explanation = explainWorkState(child.status);
    return `<li><a href="/goals/${encodeURIComponent(child.goal.goal_id)}"><span><strong>${escapeHtml(child.goal.title)}</strong><small>${escapeHtml(explanation.nextAction)}</small></span><em>${escapeHtml(explanation.label)}</em>${icon("chevron-right")}</a></li>`;
  }).join("")}</ul></div>`;
}

function renderDependencySummary(item: GoalsContextItem, view: GoalsContextView): string {
  const dependencies = activeOutgoingDependsOn(item).map((relation) => ({
    relation,
    target: findGoalView(view, relation.to_goal_id),
  }));
  if (!dependencies.length) return `<p class="clear-row">${icon("check")}${L("开始前不需要等待其他 Goal。")}</p>`;
  return `<div class="dependency-summary"><h3>${L("开始前要先完成")}</h3><ul>${dependencies.map(({ relation, target }) => {
    const done = target ? goalWorkSatisfied(target) : false;
    return `<li><a href="/goals/${encodeURIComponent(relation.to_goal_id)}"><span class="check-box${done ? " is-checked" : ""}">${done ? icon("check") : ""}</span><span><strong>${escapeHtml(target?.goal.title ?? relation.to_goal_id)}</strong><small>${escapeHtml(done ? L("已经完成，不再挡住这条 Goal。") : relation.reason)}</small></span>${icon("chevron-right")}</a></li>`;
  }).join("")}</ul></div>`;
}

function renderContractCoverage(item: GoalsContextItem, view: GoalsContextView): string {
  const goal = item.goal;
  const satisfaction = goalWorkSatisfied(item)
    ? `<p class="contract-scope-status">${icon("completed")}<strong>${L("本 Goal 按当前 Contract 已满足")}</strong><span>${L("这只表示当前 Goal 自己的承诺和完成条件已满足，不自动等于父 Goal 的完整能力已经实现。")}</span></p>`
    : "";
  const ownCoverage = goal.decomposition_state !== "closed_compound"
    ? ""
    : goal.decomposition_review?.contract_coverage == null
      ? `<p class="empty-row">${L("未记录父子 Contract 覆盖（历史数据）；现有完成状态不会因此被自动改写。")}</p>`
      : `<div class="contract-coverage-group"><h4>${L("父子 Contract 覆盖")}</h4>${[
          ...goal.decomposition_review.contract_coverage.promised_outputs.map((entry) =>
            `<article><strong>${escapeHtml(entry.parent_promised_output)}</strong><small>${escapeHtml(L(entry.status === "complete" ? "完整覆盖" : entry.status === "partial" ? "部分覆盖" : entry.status === "integration_required" ? "仍需父级集成" : "尚未覆盖"))}</small><p>${escapeHtml(entry.reason)}</p><ul>${entry.child_outputs.map((reference) => `<li><button type="button" data-select-goal="${escapeHtml(reference.goal_id)}">${escapeHtml(reference.promised_output)}</button></li>`).join("")}</ul></article>`,
          ),
          ...goal.decomposition_review.contract_coverage.acceptance_criteria.map((entry) =>
            `<article><strong>${escapeHtml(entry.parent_criterion_id)}</strong><small>${escapeHtml(L(entry.status === "complete" ? "完整覆盖" : entry.status === "partial" ? "部分覆盖" : entry.status === "integration_required" ? "仍需父级集成" : "尚未覆盖"))}</small><p>${escapeHtml(entry.reason)}</p><ul>${entry.child_criteria.map((reference) => `<li><button type="button" data-select-goal="${escapeHtml(reference.goal_id)}">${escapeHtml(reference.criterion_id)}</button></li>`).join("")}</ul></article>`,
          ),
        ].join("")}</div>`;
  const parents = view.snapshot.relations
    .filter((relation) => relation.state === "active" && relation.type === "part_of" && relation.from_goal_id === goal.goal_id)
    .map((relation) => findGoalView(view, relation.to_goal_id))
    .filter((parent): parent is GoalsContextItem => parent != null);
  const parentContributions = parents.length === 0
    ? ""
    : `<div class="contract-coverage-group"><h4>${L("对父 Goal 的贡献")}</h4>${parents.map((parent) => {
        const coverage = parent.goal.decomposition_review?.contract_coverage;
        if (!coverage) {
          return `<article><strong>${escapeHtml(parent.goal.title)}</strong><p>${L("这条历史父 Goal 未记录父子 Contract 覆盖；当前子 Goal 的完成不会被解释成父级完整能力。")}</p></article>`;
        }
        const outputs = coverage.promised_outputs.filter((entry) =>
          entry.child_outputs.some((reference) => reference.goal_id === goal.goal_id),
        );
        const criteria = coverage.acceptance_criteria.filter((entry) =>
          entry.child_criteria.some((reference) => reference.goal_id === goal.goal_id),
        );
        return `<article><strong><button type="button" data-select-goal="${escapeHtml(parent.goal.goal_id)}">${escapeHtml(parent.goal.title)}</button></strong><ul>${[
          ...outputs.map((entry) => `<li>${escapeHtml(entry.parent_promised_output)} · ${escapeHtml(L(entry.status === "complete" ? "完整覆盖" : "尚有缺口"))}</li>`),
          ...criteria.map((entry) => `<li>${escapeHtml(entry.parent_criterion_id)} · ${escapeHtml(L(entry.status === "complete" ? "完整覆盖" : "尚有缺口"))}</li>`),
        ].join("")}</ul></article>`;
      }).join("")}</div>`;
  if (!satisfaction && !ownCoverage && !parentContributions) return "";
  return `<div class="document-subsection contract-coverage-summary">${subsectionHeading("link", "Contract 覆盖边界", "区分当前 Goal 自己满足了什么，以及它是否覆盖父级承诺。")}${satisfaction}${ownCoverage}${parentContributions}</div>`;
}


  return { renderCompletionBoundaries, renderChildProgress, renderDependencySummary, renderContractCoverage };
}
