import type { GoalsDocumentItem, GoalsDocumentContext, GoalsDocumentUiPrimitives } from "./document-ui-model.js";
import { activeOutgoingDependsOn, displayedPassedCriterionIds } from "./tree-presentation.js";

export function goalDocumentActorLabel(actor: string | null | undefined, L: GoalsDocumentUiPrimitives["translate"]): string {

  if (!actor) return L("未指定");
  const confirmedPrefix = "user-confirmed-via:";
  if (!actor.startsWith(confirmedPrefix)) return actor;
  const runtime = actor.slice(confirmedPrefix.length).trim();
  const runtimeLabel = runtime.toLowerCase() === "codex"
    ? "Codex"
    : runtime.replaceAll("-", " ").replace(/^./, (value) => value.toUpperCase());
  return runtimeLabel ? `${L("用户确认")} · ${runtimeLabel}` : L("用户确认");

}

export function createGoalOverviewRenderer(primitives: GoalsDocumentUiPrimitives) {
  const { translate: L, escapeHtml, icon, formatDate } = primitives;
  const workbenchActorLabel = (actor: string | null | undefined) => goalDocumentActorLabel(actor, L);
function renderGoalPrimaryAction(item: GoalsDocumentItem, context: GoalsDocumentContext): string {
  const goalId = item.goal.goal_id;
  const action = item.action_projection.primary_action;
  const decisions = context.decisionCount;
  if (!action && item.display_status === "completed" && !item.goal.archived_at) {
    return `<button class="goal-primary-action" type="button" data-goal-archive="true" data-goal-id="${escapeHtml(goalId)}" aria-label="${L("归档这条已完成的 Goal")}" title="${L("归档这条已完成的 Goal")}">${icon("archive")}<span>${L("归档 Goal")}</span></button>`;
  }
  if (!action) return "";
  if (action.actor === "user") {
    const href = decisions > 0
      ? `/decisions#decision-goal-${encodeURIComponent(goalId)}`
      : `#acceptance-${encodeURIComponent(goalId)}`;
    return `<a class="goal-primary-action" href="${href}" aria-label="${escapeHtml(item.main_action_label)}" title="${escapeHtml(item.main_action_label)}">${icon("user")}<span>${escapeHtml(item.main_action_label)}</span></a>`;
  }
  if (action.status === "blocked" || action.kind === "wait") {
    return `<a class="goal-primary-action" href="#progress-${encodeURIComponent(goalId)}" aria-label="${escapeHtml(item.main_action_label)}" title="${escapeHtml(item.main_action_label)}">${icon(action.kind === "wait" ? "waiting" : "blocked")}<span>${escapeHtml(item.main_action_label)}</span></a>`;
  }
  if (action.kind === "clarify") {
    return `<button class="goal-primary-action" type="button" data-open-goal-edit aria-label="${escapeHtml(item.main_action_label)}" title="${escapeHtml(item.main_action_label)}">${icon("clipboard")}<span>${escapeHtml(item.main_action_label)}</span></button>`;
  }
  return `<button class="goal-primary-action" type="button" data-open-goal-tui aria-label="${escapeHtml(item.main_action_label)}" title="${escapeHtml(item.main_action_label)}">${icon("terminal")}<span>${escapeHtml(item.main_action_label)}</span></button>`;
}

function renderGoalNow(item: GoalsDocumentItem, context: GoalsDocumentContext): string {
  const action = item.action_projection.primary_action;
  const blockers = action?.reasons.filter((reason) => reason.severity === "blocker") ?? [];
  const guidance = action?.actor === "user"
    ? L("完成这一个决定后，页面会直接显示新的下一步。")
    : action?.status === "blocked" || action?.kind === "wait"
      ? L("满足这里列出的恢复条件后，状态会自动重新计算。")
      : L("从主按钮继续；已有 Run、Evidence 和 Review 都会保留。")
  return `<section class="goal-now" data-goal-section="now" aria-labelledby="goal-now-${escapeHtml(item.goal.goal_id)}">
    <header><h2 id="goal-now-${escapeHtml(item.goal.goal_id)}">${L("下一步")}</h2></header>
    <div class="goal-now-body"><div><strong>${escapeHtml(item.main_action_label)}</strong><p>${escapeHtml(item.action_summary)}</p><small><b>${L("怎么做：")}</b>${escapeHtml(guidance)}</small></div>${renderGoalPrimaryAction(item, context)}</div>
    ${blockers.length
      ? `<div class="goal-now-blockers"><strong>${L("当前阻塞")}</strong><ul>${blockers.map((reason) => `<li>${escapeHtml(reason.message)}${reason.remediation ? `<small>${L("可以这样处理：")}${escapeHtml(reason.remediation)}</small>` : ""}</li>`).join("")}</ul></div>`
      : ""}
  </section>`;
}

function renderGoalFocusOverview(item: GoalsDocumentItem, context: GoalsDocumentContext): string {
  const criteria = item.goal.acceptance_criteria;
  const preview = criteria.slice(0, 5);
  const passedCriteria = new Set(displayedPassedCriterionIds(item));
  const passed = passedCriteria.size;
  const remaining = Math.max(0, criteria.length - preview.length);
  const owner = workbenchActorLabel(item.active_claim_actor ?? item.goal.accepted_by);
  const dependencies = activeOutgoingDependsOn(item).length;
  const contextRows = [
    [L("负责人"), owner],
    [L("工作范围"), item.goal.in_scope.length ? L("{count} 项", { count: item.goal.in_scope.length }) : L("未记录")],
    [L("前置依赖"), dependencies ? L("{count} 项", { count: dependencies }) : L("无")],
    [L("完成依据"), L("{count} 条", { count: item.evidence.length })],
    [L("最近更新"), formatDate(item.goal.updated_at)],
  ];
  return `${context.draftGapsHtml}
    <div class="goal-focus-layout">
      <div class="goal-focus-main">
        ${renderGoalNow(item, context)}
        <section class="goal-focus-criteria" aria-labelledby="goal-focus-criteria-${escapeHtml(item.goal.goal_id)}">
          <header><div><h2 id="goal-focus-criteria-${escapeHtml(item.goal.goal_id)}">${L("完成要求")}</h2><p>${criteria.length ? L("这些条件决定这条 Goal 是否真的完成。") : L("还没有可以判断完成的条件。")}</p></div><strong>${passed}/${criteria.length}</strong></header>
          ${preview.length
            ? `<ul>${preview.map((criterion) => {
                const isPassed = passedCriteria.has(criterion.criterion_id);
                return `<li><span class="check-box${isPassed ? " is-checked" : ""}">${isPassed ? icon("check") : ""}</span><span><strong>${escapeHtml(criterion.statement)}</strong>${criterion.pass_condition !== criterion.statement ? `<small>${escapeHtml(criterion.pass_condition)}</small>` : ""}</span></li>`;
              }).join("")}</ul>`
            : `<p class="empty-row empty-row--warning">${L("补全完成标准后，执行和复核才有共同依据。")}</p>`}
          <a href="#acceptance-${escapeHtml(item.goal.goal_id)}">${remaining ? L("查看全部 {count} 条要求", { count: criteria.length }) : L("查看完整要求与边界")}${icon("arrow")}</a>
        </section>
      </div>
      <aside class="goal-focus-aside" aria-label="${L("上下文")}">
        <section class="goal-focus-context" aria-labelledby="goal-focus-context-${escapeHtml(item.goal.goal_id)}">
          <header><h2 id="goal-focus-context-${escapeHtml(item.goal.goal_id)}">${L("上下文")}</h2><p>${L("这条 Goal 当前最需要记住的事实。")}</p></header>
          <dl>${contextRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
        </section>
        ${context.companionRuntimeHtml}
      </aside>
    </div>`;
}


  return { renderGoalFocusOverview };
}
