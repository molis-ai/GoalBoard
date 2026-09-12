import type { GoalBoardIcon } from "@adeptify/goalboard-design-system";

export interface ImmersiveShellPrimitives {
  L(value: string): string;
  escapeHtml(value: unknown): string;
  icon(name: GoalBoardIcon): string;
}

/** Application chrome only. Plugin owners continue to render and operate their content. */
export function renderImmersivePluginStrip({ L, icon }: ImmersiveShellPrimitives, enabled: readonly string[]): string {
  const plugins = [
    { id: "goals", surface: "goal", label: "Goals" },
    { id: "sessions", surface: "sessions", label: "Sessions" },
    { id: "feed", surface: "feed", label: "Feed" },
    { id: "artifacts", surface: "artifacts", label: "Artifacts" },
  ];
  return `<div class="immersive-directory-heading" data-plugin-heading hidden>
    <div class="immersive-directory-toolbar"><button class="immersive-directory-back" type="button" data-directory-back aria-label="${L("返回上一级")}">${icon("back")}<span>${L("项目目录")}</span></button>
      <div class="immersive-strip-scroll" data-plugin-scroll-controls hidden><button type="button" data-plugin-scroll="left" aria-label="${L("向左滚动插件")}">${icon("back")}</button><button type="button" data-plugin-scroll="right" aria-label="${L("向右滚动插件")}">${icon("chevron-right")}</button></div>
    </div>
    <nav class="immersive-plugin-strip" data-plugin-strip aria-label="${L("当前项目的插件")}">${plugins.filter(plugin => enabled.includes(plugin.id)).map((plugin) => `<button class="immersive-plugin-link" type="button" data-plugin-id="${plugin.id}" data-directory-open="${plugin.id}" data-work-surface-open="${plugin.surface}"${plugin.id === "feed" ? ' data-feed-preset="feed"' : ""} aria-label="${L("切换到插件")}：${plugin.label}">${plugin.label}</button>`).join("")}</nav>
  </div>`;
}

export function renderImmersiveHeader(primitives: ImmersiveShellPrimitives, desktop: boolean): string {
  const { L, icon } = primitives;
  return `<header class="workbench-header immersive-titlebar">
    <button class="immersive-icon-button immersive-show-directory" type="button" data-directory-show aria-label="${L("展开目录")}" title="${L("展开目录")}">${icon("panel")}</button>
    <strong data-immersive-plugin-title>Goals</strong>
    <div class="immersive-goal-tools" data-immersive-goal-tools><span>${L("画布")}</span><button class="immersive-icon-button" type="button" data-directory-open="goals" aria-label="${L("打开 Goal 列表")}" title="${L("打开 Goal 列表")}">${icon("list")}</button></div>
    <div class="desktop-titlebar-drag"${desktop ? " data-tauri-drag-region" : ""} aria-hidden="true"></div>
    <button class="immersive-icon-button" type="button" data-immersive-theme aria-label="${L("切换外观")}" title="${L("切换外观")}">${icon("sun")}</button>
  </header>`;
}

export function renderImmersiveGoalHeader(title: string, primitives: ImmersiveShellPrimitives): string {
  const { L, escapeHtml, icon } = primitives;
  return `<header class="goal-node-toolbar"><div class="goal-node-heading"><h1 data-workspace-goal-title tabindex="-1">${escapeHtml(title)}</h1><span data-workspace-goal-status></span></div>
    <div class="goal-node-actions"><button type="button" data-goal-details-toggle aria-expanded="true" aria-label="${L("收起 Goal 信息与时间线")}" title="${L("Goal 信息与时间线")}">${icon("panel")}</button><button type="button" data-goal-collapse aria-label="${L("收起 Goal，返回关系画布")}" title="${L("收起 Goal，返回关系画布")}">${icon("x")}</button></div>
  </header>`;
}

export function renderImmersiveWorkTabs({ L, icon }: ImmersiveShellPrimitives): string {
  return `<div class="goal-work-modebar"><div role="tablist" aria-label="${L("工作方式")}"><button type="button" role="tab" id="goal-conversation-tab" aria-selected="false" aria-disabled="true" disabled tabindex="-1" title="${L("对话尚未接入")}" data-goal-work-mode="conversation">${icon("message")}<span>${L("对话")}</span></button><button type="button" role="tab" id="goal-terminal-tab" aria-controls="goal-tui-pane" aria-selected="true" data-goal-work-mode="terminal">${icon("terminal")}<span>${L("终端")}</span></button></div><span data-goal-runtime-status></span></div>`;
}

export { renderProjectHome } from "./project-home.js";

export function renderPluginMarket({ L, icon }: ImmersiveShellPrimitives): string {
  const plugins = [
    { id: "goals", label: "Goals", glyph: "target" as const, copy: "确定目标，推进工作，留下结果。" },
    { id: "sessions", label: "Sessions", glyph: "terminal" as const, copy: "回到你的会话，继续正在做的事。" },
    { id: "feed", label: "Feed", glyph: "activity" as const, copy: "查看来源消息，处理需要关注的事项。" },
    { id: "artifacts", label: "Artifacts", glyph: "file" as const, copy: "打开项目成果，查看保留下来的版本。" },
  ];
  return `<header class="plugin-market-heading"><span>GoalBoard</span><h1>${L("插件市场")}</h1><p>${L("把需要的工作方式添加到项目。")}</p></header>
    <div class="plugin-market-controls"><label>${L("搜索插件")}<input type="search" data-market-search placeholder="${L("名称或用途")}"></label><label>${L("添加到项目")}<select data-market-project aria-label="${L("添加到项目")}" disabled></select></label><label class="plugin-market-filter"><input type="checkbox" data-market-added>${L("仅看已添加")}</label></div>
    <p class="plugin-market-status" data-market-status role="status"></p><button type="button" data-market-retry hidden>${L("重试")}</button>
    <div class="plugin-market-body"><div class="plugin-market-grid">${plugins.map(plugin => `<article data-market-plugin="${plugin.id}"><div class="plugin-market-icon">${icon(plugin.glyph)}</div><h2>${plugin.label}</h2><p>${L(plugin.copy)}</p><footer><span>${L("内置")}</span><button type="button" data-market-add="${plugin.id}" disabled>${L("添加到项目")}</button></footer></article>`).join("")}</div>
    <p data-market-empty hidden>${L("没有符合条件的插件")}</p></div><p class="plugin-market-note">${L("这里提供随 GoalBoard 一起交付的内置插件。")}</p>`;
}
