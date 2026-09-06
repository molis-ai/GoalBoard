import type { UiContribution } from "@adeptify/goalboard-contracts/platform/ui";
import type { GoalsDocumentItem, GoalsDocumentContext, GoalsDocumentUiPrimitives } from "./document-ui-model.js";
import { createGoalOverviewRenderer, goalDocumentActorLabel } from "./document-overview-ui.js";

function createDocumentRenderer(primitives: GoalsDocumentUiPrimitives) {
  const { translate: L, escapeHtml, icon, formatDate, renderVisibleGoalStatus, renderStatus, sectionHeading } = primitives;
  const workbenchActorLabel = (actor: string | null | undefined) => goalDocumentActorLabel(actor, L);
  const { renderGoalFocusOverview } = createGoalOverviewRenderer(primitives);
function renderLazyGoalPanelStatus(label: string): string {
  return `<p class="empty-row goal-panel-lazy-status" data-goal-panel-status role="status">${escapeHtml(label)}</p>`;
}

function renderGoalDocument(item: GoalsDocumentItem, context: GoalsDocumentContext, selected: boolean): string {
  const goal = item.goal;
  const owner = workbenchActorLabel(item.active_claim_actor ?? goal.accepted_by);
  const activeGoalAction =
    goal.definition_state === "accepted" && !goal.archived_at && !goal.trashed_at
      ? context.activeGoalId === goal.goal_id
        ? `<span class="document-action document-action--current" role="status" title="${L("当前产品聚焦 Goal；不表示 Runtime 正在执行")}">${icon("target")}<span>${L("当前 Goal")}</span></span>`
        : `<button class="document-action document-action--quiet" type="button" data-set-active-goal data-goal-id="${escapeHtml(goal.goal_id)}" title="${L("设为 Board 当前聚焦；不会领取或启动 Runtime 执行")}">${icon("target")}<span>${L("设为当前 Goal")}</span></button>`
      : "";
  const archiveAction = goal.archived_at
    ? `<button class="document-action" type="button" data-goal-archive="false" data-goal-id="${escapeHtml(goal.goal_id)}">${icon("refresh")}<span>${L("恢复")}</span></button>`
    : "";
  const trashAction = `<button class="document-action document-action--danger" type="button" data-open-goal-trash data-goal-id="${escapeHtml(goal.goal_id)}" data-goal-title="${escapeHtml(goal.title)}">${icon("archive")}<span>${L("移入回收站")}</span></button>`;
  const moreActions = `<details class="goal-more"><summary aria-label="${L("更多操作")}">${icon("more")}</summary><div>${activeGoalAction}${archiveAction}${trashAction}</div></details>`;
  const quickRecordAction = !goal.archived_at && !goal.trashed_at
    ? `<button class="document-action document-action--quick" type="button" data-open-quick-record>${icon("plus")}<span>${L("快速记录")}</span></button>`
    : "";
  const goalModeSwitch = !goal.archived_at && !goal.trashed_at
    ? `<nav class="goal-mode-switch" role="tablist" aria-label="${L("Goal 工作模式")}"><button class="is-active" type="button" role="tab" aria-selected="true" aria-controls="goal-document-pane" data-workbench-view="focus">${icon("target")}<span>${L("聚焦")}</span></button><button type="button" role="tab" aria-selected="false" aria-controls="goal-tui-pane" data-workbench-view="runtime">${icon("terminal")}<span>Runtime</span></button></nav>`
    : "";
  const goalId = escapeHtml(goal.goal_id);
  const tabs = [
    ["overview", "target", L("当前")],
    ["completion", "clipboard", L("上下文")],
    ["progress", "activity", L("进展")],
    ["factors", "link", L("关系")],
    ["records", "history", L("记录")],
  ] as const;
  const tabNavigation = `<nav class="goal-workspace-nav" role="tablist" aria-label="${L("Goal 详情")}">${tabs.map(([key, iconName, label], index) => `<button id="goal-tab-${key}-${goalId}" type="button" role="tab" aria-selected="${index === 0 ? "true" : "false"}" aria-controls="goal-panel-${key}-${goalId}" tabindex="${index === 0 ? "0" : "-1"}" data-goal-tab="${key}">${icon(iconName)}<span>${label}</span></button>`).join("")}</nav>`;
  const goalBrief = `<div class="goal-brief-grid" aria-label="${L("目标说明")}">
    <section class="goal-brief-item goal-brief-item--outcome"><h2>${L("完成后会得到什么")}</h2><p>${escapeHtml(goal.outcome || L("还没有写清预期结果。"))}</p></section>
    <section class="goal-brief-item"><h2>${L("为什么现在做")}</h2><p>${escapeHtml(goal.why || L("还没有写清为什么要做。"))}</p></section>
    <section class="goal-brief-item"><h2>${L("它会怎样运转")}</h2><p>${escapeHtml(goal.business_logic || L("还没有写清实际使用方式。"))}</p></section>
  </div>`;
  return `<!--
THESIS: Goal 正文首先回答“做什么、为什么、怎么运转、下一步”；拒绝让大标题和卡片边距吃掉第一屏。
OWN-WORLD: 连续白色工作面使用紧凑排版、细分隔线、克制钴蓝焦点和结构化 Contract 摘要。
STORY: 先在一个视口读懂 Goal，再进入上下文、进展、关系与记录。
FIRST VIEWPORT: 状态与事实行、紧凑标题、三段 Goal Contract、详情导航、下一步和完成要求连续出现。
FORM: 既有 Goal 工作台的高密度 Operate 重排。
unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
--><article class="goal-document" data-goal-view="${escapeHtml(goal.goal_id)}"${selected ? "" : " hidden"}>
    <section class="goal-hero" aria-labelledby="goal-title-${goalId}">
      <header class="goal-header">
        <div class="goal-title-kicker"><span class="goal-title-status--wide" aria-hidden="true">${renderVisibleGoalStatus(item)}</span><div class="goal-title-facts"><span>${icon("user")}${escapeHtml(owner)}</span><span>${L("优先级")} ${goal.priority}</span><span>${L("最近更新")} ${formatDate(goal.updated_at)}</span></div></div>
        <div class="goal-title-row"><div class="goal-title-copy"><div class="goal-title-heading"><h1 id="goal-title-${goalId}">${escapeHtml(goal.title)}</h1><span class="goal-title-status--narrow">${renderVisibleGoalStatus(item)}</span></div><p class="goal-title-outcome">${escapeHtml(goal.outcome || L("还没有写清预期结果。"))}</p></div><div class="goal-title-actions">${goalModeSwitch}${quickRecordAction}${moreActions}</div></div>
      </header>
      ${goalBrief}
      ${tabNavigation}
    </section>
    <div class="goal-workspace-panels">
      <div id="goal-panel-overview-${goalId}" class="goal-workspace-panel" role="tabpanel" aria-labelledby="goal-tab-overview-${goalId}" data-goal-panel="overview">
        ${renderGoalFocusOverview(item, context)}
      </div>
      <div id="goal-panel-completion-${goalId}" class="goal-workspace-panel" role="tabpanel" aria-labelledby="goal-tab-completion-${goalId}" data-goal-panel="completion" data-loaded="false" hidden>
        ${renderLazyGoalPanelStatus(L("打开“上下文”时载入。"))}
      </div>
      <div id="goal-panel-progress-${goalId}" class="goal-workspace-panel" role="tabpanel" aria-labelledby="goal-tab-progress-${goalId}" data-goal-panel="progress" data-loaded="false" hidden>
        ${renderLazyGoalPanelStatus(L("打开“进展”时载入。"))}
      </div>
      <div id="goal-panel-factors-${goalId}" class="goal-workspace-panel" role="tabpanel" aria-labelledby="goal-tab-factors-${goalId}" data-goal-panel="factors" data-loaded="false" hidden>
        ${renderLazyGoalPanelStatus(L("打开“关系”时载入。"))}
      </div>
      <div id="goal-panel-records-${goalId}" class="goal-workspace-panel" role="tabpanel" aria-labelledby="goal-tab-records-${goalId}" data-goal-panel="records" hidden>
        <div data-goal-records-content data-loaded="false"><p class="empty-row" role="status">${L("正在载入完整记录…")}</p></div>
      </div>
    </div>
  </article>`;
}

function renderTrashGoalDocument(item: GoalsDocumentItem, selected: boolean): string {
  const goal = item.goal;
  const trashEvent = item.events.find((event) => event.type === "goal.trashed");
  const owner = goal.trashed_by ?? trashEvent?.actor_id ?? L("未记录");
  return `<article class="goal-document trash-goal-document" data-goal-view="${escapeHtml(goal.goal_id)}"${selected ? "" : " hidden"}>
    <section class="goal-hero trash-goal-hero" aria-labelledby="trash-goal-title-${escapeHtml(goal.goal_id)}">
      <header class="goal-header">
        <div class="goal-title-kicker">${renderStatus("trashed")}<dl class="trash-goal-facts"><div>${icon("archive")}<dt>${L("移入于")}</dt><dd>${formatDate(goal.trashed_at)}</dd></div><div>${icon("user")}<dt>${L("操作人")}</dt><dd>${escapeHtml(owner)}</dd></div><div>${icon("history")}<dt>${L("最近更新")}</dt><dd>${formatDate(goal.updated_at)}</dd></div></dl></div>
        <div class="goal-title-row"><div class="goal-title-copy"><h1 id="trash-goal-title-${escapeHtml(goal.goal_id)}">${escapeHtml(goal.title)}</h1><p class="goal-title-outcome">${L("这条 Goal 已从日常列表移除，但内容和历史仍然保留。")}</p></div><div class="goal-title-actions"><button class="document-action" type="button" data-open-goal-restore data-goal-id="${escapeHtml(goal.goal_id)}" data-goal-title="${escapeHtml(goal.title)}">${icon("refresh")}<span>${L("恢复")}</span></button></div></div>
      </header>
    </section>
    <div class="goal-workspace-panels trash-goal-workspace">
    <section class="trash-goal-panel trash-goal-panel--state">
      ${sectionHeading("archive", "回收站状态", "这不是永久删除；恢复后仍是同一个 Goal")}
      <div class="trash-summary"><p><strong>${L("Goal 的 Contract、Run、Evidence 与事件历史都已保留。")}</strong>${L("移入时仍生效的关联关系会临时停止；恢复时，只有两端都不在回收站的关系才会安全恢复。")}</p>${trashEvent ? `<p><strong>移入原因：</strong>${escapeHtml(trashEvent.reason)}</p>` : ""}</div>
    </section>
    <section class="trash-goal-panel">
      ${sectionHeading("book", "原始目标")}
      <div class="business-copy"><p class="outcome"><strong>${L("要得到的结果：")}</strong>${escapeHtml(goal.outcome || L("待澄清"))}</p><p><strong>${L("为什么做：")}</strong>${escapeHtml(goal.why || L("待澄清"))}</p><p><strong>${L("事情如何运转：")}</strong>${escapeHtml(goal.business_logic || L("待澄清"))}</p></div>
    </section>
    <section class="trash-goal-panel trash-goal-panel--restore">
      ${sectionHeading("refresh", "恢复到 Goal Tree", "恢复不会创建新 Goal，也不会自动启动 Runtime")}
      <div class="trash-restore-row"><p>${L("确认恢复后，这条 Goal 会回到原来的日常列表；如果有关联仍不能安全恢复，系统会保留它们为待处理事实。")}</p><button class="button-primary" type="button" data-open-goal-restore data-goal-id="${escapeHtml(goal.goal_id)}" data-goal-title="${escapeHtml(goal.title)}">${icon("refresh")}<span>${L("恢复这个 Goal")}</span></button></div>
    </section>
    </div>
  </article>`;
}


  function renderInitialGoalTab(goal: Pick<GoalsDocumentItem["goal"], "goal_id" | "title">): string {
    return `<div class="desktop-work-tab is-selected" data-work-tab-shell="${escapeHtml(goal.goal_id)}"><button type="button" role="tab" data-work-tab="${escapeHtml(goal.goal_id)}" aria-selected="true" aria-controls="goal-document-pane"><i aria-hidden="true"></i><span>${escapeHtml(goal.title)}</span></button><button type="button" data-close-work-tab="${escapeHtml(goal.goal_id)}" aria-label="${escapeHtml(L("关闭 {title}", { title: goal.title }))}">${icon("x")}</button></div>`;
  }
  function renderEmptyGoalCollection(trash: boolean, full: boolean): string {
    const title = trash ? L("回收站是空的") : L("还没有归档 Goal");
    const detail = full ? `<p>${trash ? L("移入回收站的 Goal 可以在这里恢复；日常 Goal Tree 不会被它们干扰。") : L("已完成的 Goal 可以在正文顶部手动归档，历史事实不会被删除。")}</p><a href="/">${L("返回 Goal Tree")}</a>` : "";
    return `<div class="archive-empty">${icon("archive")}<h1>${title}</h1>${detail}</div>`;
  }
  return { renderGoalDocument, renderTrashGoalDocument, renderInitialGoalTab, renderEmptyGoalCollection };
}
export type GoalsDocumentRenderer = ReturnType<typeof createDocumentRenderer>;
export const GOALS_DOCUMENT_UI_CONTRIBUTION_ID = "io.goalboard.native.goals.document.v1";
export type GoalsDocumentUiModel = { primitives: GoalsDocumentUiPrimitives } & (
  | { kind: "document"; args: Parameters<GoalsDocumentRenderer["renderGoalDocument"]> }
  | { kind: "trash"; args: Parameters<GoalsDocumentRenderer["renderTrashGoalDocument"]> }
  | { kind: "initial-tab"; args: Parameters<GoalsDocumentRenderer["renderInitialGoalTab"]> }
  | { kind: "empty-collection"; args: Parameters<GoalsDocumentRenderer["renderEmptyGoalCollection"]> }
);
export const goalsDocumentUiContribution: UiContribution<GoalsDocumentUiModel> = {
  descriptor: {
    contribution_id: GOALS_DOCUMENT_UI_CONTRIBUTION_ID, plugin_id: "io.goalboard.native.goals", kind: "embedded", label: "Goal document",
    surfaces: ["document", "trash", "initial-tab", "empty-collection"].map(surface_id => ({ surface_id, target_slot_id: "workbench.main", format: "declarative-html" })), slots: [],
  },
  render({ surface, model }) {
    if (surface !== model.kind) throw new Error("Goals document surface does not match its model");
    const renderer = createDocumentRenderer(model.primitives);
    switch (model.kind) {
      case "document": return renderer.renderGoalDocument(...model.args);
      case "trash": return renderer.renderTrashGoalDocument(...model.args);
      case "initial-tab": return renderer.renderInitialGoalTab(...model.args);
      case "empty-collection": return renderer.renderEmptyGoalCollection(...model.args);
    }
  },
};
