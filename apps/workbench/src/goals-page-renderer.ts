import type { WorkbenchDocumentRenderRequest } from "@adeptify/goalboard-contracts/platform/ui";
import { buildGoalCollectionModel, type GoalCollectionItem, type GoalCollectionView, type GoalCollectionModel } from "@adeptify/goalboard-plugin-goals";
import type { ProjectOperationsData, ProjectOperationsProject, ProjectOperationsSlice } from "@adeptify/goalboard-plugin-work";

type PageIcon = "user" | "settings" | "input" | "chevron-right" | "file" | "activity" | "arrow" | "workflow" | "tune" | "panel";
type Translate = (text: string, values?: Record<string, string | number>) => string;
type FeedPageSurface = "workbench" | "source-workbench" | "directory" | "source-directory" | "overlays";
export interface WorkbenchGoalsPageView<TItem extends GoalCollectionItem> extends GoalCollectionView<TItem> {
  project: ProjectOperationsProject | null;
  projects: ProjectOperationsProject[];
  route_prefix: string;
}

/** Finite composition ports, not a second Web model or an execution/permission API.
 * HTML ports accept only trusted output from the registered product owners.
 */
export interface WorkbenchGoalsPageOwners<TItem extends GoalCollectionItem, TView extends WorkbenchGoalsPageView<TItem>, TFeedEntry> {
  L: Translate;
  escapeHtml(value: unknown): string;
  icon(name: PageIcon): string;
  htmlLang(): string;
  controlTokenMeta(token: string): string;
  themeBootstrapScript: string;
  renderIconSprite(): string;
  clientI18nScript(): string;
  dataJson(view: TView): string;
  prefixLocalLinks(html: string, prefix: string, desktopShell?: boolean): string;
  renderWorkbenchDocument(request: WorkbenchDocumentRenderRequest): string;
  renderGoalDocument(item: TItem, view: TView, selected: boolean): string;
  renderTrashGoalDocument(item: TItem, selected: boolean): string;
  goalsDocumentRenderer: {
    renderInitialGoalTab(goal: TItem["goal"]): string;
    renderEmptyGoalCollection(trash: boolean, full: boolean): string;
  };
  goalsTreeRenderer: {
    renderGoalRootEntry(count: number, active: boolean): string;
    renderGoalDirectory(view: TView, collection: GoalCollectionModel<TItem>, active: boolean): string;
    renderGoalRefreshDirectory(view: TView, collection: GoalCollectionModel<TItem>): string;
  };
  renderCreateDialog(view: TView): string;
  renderGoalTrashDialog(): string;
  renderMomentumPlaceholder(): string;
  renderTuiPane(selected: TItem | undefined, view: TView, cliAvailability: Record<string, boolean>): string;
  renderProjectOperations(project: ProjectOperationsProject | null, data: ProjectOperationsData | undefined): ProjectOperationsSlice;
  renderDesktopProjectChrome(project: ProjectOperationsProject | null, projects: readonly ProjectOperationsProject[],
    desktop: boolean, settingsHref: string | null,
    options: { switcherClass: string; manageHref: string; directoryToggle: boolean }): string;
  renderProjectSwitcher(project: ProjectOperationsProject | null, projects: readonly ProjectOperationsProject[],
    desktop: boolean, className: string, manageHref: string): string;
  feedNativePluginSupplementalEntries(view: TView): TFeedEntry[];
  renderFeedNativePluginSurface(view: TView, surface: FeedPageSurface, preset: "inbox_message",
    entries?: TFeedEntry[], active?: boolean): string;
}

/** Workbench owns placement; Goals/Feed/Work owners retain their actual UI and facts. */
export function createWorkbenchGoalsPageRenderer<TItem extends GoalCollectionItem,
  TView extends WorkbenchGoalsPageView<TItem>, TFeedEntry>(
  owners: WorkbenchGoalsPageOwners<TItem, TView, TFeedEntry>,
) {
  const { L, escapeHtml, icon, htmlLang, controlTokenMeta, themeBootstrapScript: THEME_BOOTSTRAP_SCRIPT,
    renderIconSprite, clientI18nScript, dataJson, prefixLocalLinks, renderWorkbenchDocument,
    renderGoalDocument, renderTrashGoalDocument, goalsDocumentRenderer, goalsTreeRenderer,
    renderCreateDialog, renderGoalTrashDialog, renderMomentumPlaceholder, renderTuiPane,
    renderProjectOperations, renderDesktopProjectChrome, renderProjectSwitcher,
    feedNativePluginSupplementalEntries, renderFeedNativePluginSurface } = owners;

function renderGoalBoardRefreshFragment(
  view: TView,
  requestedGoalId?: string,
  archiveView = false,
  trashView = false,
): string {
  const collection = buildGoalCollectionModel(view, requestedGoalId, archiveView, trashView, false, L);
  const { selected } = collection;
  const document = selected
    ? trashView
      ? renderTrashGoalDocument(selected, true)
      : renderGoalDocument(selected, view, true)
    : goalsDocumentRenderer.renderEmptyGoalCollection(trashView, false);
  const bodyView = trashView ? "trash" : archiveView ? "archive" : "current";
  const html = `<!doctype html><html><body data-board-view="${bodyView}">
    ${goalsTreeRenderer.renderGoalRefreshDirectory(view, collection)}
    <section data-document-pane><section data-work-surface="goal">${document}</section></section>
    ${renderCreateDialog(view)}
    <script id="goalboard-data" type="application/json">${dataJson(view)}</script>
  </body></html>`;
  return prefixLocalLinks(html, view.route_prefix);
}

function renderGoalBoardWeb(
  view: TView,
  requestedGoalId?: string,
  archiveView = false,
  decisionView = false,
  trashView = false,
  controlToken = "",
  desktopShell = false,
  cliAvailability: Record<string, boolean> = {},
  projectOperationsData?: ProjectOperationsData,
): string {
  const collection = buildGoalCollectionModel(view, requestedGoalId, archiveView, trashView, decisionView, L);
  const { visibleGoals, selected, title, collectionTitle } = collection;
  const initialFeedPreset = "inbox_message" as const;
  const initialDesktopDirectory: string = decisionView ? "feed" : requestedGoalId ? "goals" : "root";
  const projectOptions = view.projects.length ? view.projects : view.project ? [view.project] : [];
  const projectOperations = renderProjectOperations(view.project
    ? { project_id: view.project.project_id, display_name: view.project.display_name }
    : null, projectOperationsData);
  const desktopAccountFooter = `<footer class="personal-sidebar-footer">
    <a class="personal-account" data-settings-link href="__SYSTEM_SETTINGS__" aria-label="${L("打开全局设置")}">
      <span class="personal-account-avatar" aria-hidden="true">${icon("user")}</span>
      <span class="personal-account-copy"><strong>${L("一骏")}</strong><small>${L("本地空间")}</small></span>
      <span class="personal-account-settings" aria-hidden="true">${icon("settings")}</span>
    </a>
  </footer>`;
  const desktopRootDirectory = `<section class="desktop-directory-panel desktop-directory-root" data-directory-panel="root"${initialDesktopDirectory === "root" ? "" : " hidden"}>
    <nav class="desktop-module-list" aria-label="${L("工作台目录")}">
      <button class="desktop-module-item desktop-module-item--inbox${decisionView ? " is-current" : ""}" type="button" data-directory-open="feed" data-work-surface-open="feed" data-feed-preset="inbox_message"${decisionView ? ' aria-current="page"' : ""}>${icon("input")}<span><strong>Inbox</strong><small>${L("只处理需要你介入的事情")}</small></span>${icon("chevron-right")}</button>
      ${goalsTreeRenderer.renderGoalRootEntry(visibleGoals.length, !decisionView)}
      ${projectOperations.rootItems}
      <a class="desktop-module-item" href="/artifacts">${icon("file")}<span><strong>Artifacts</strong><small>${L("插件发布的结果与版本")}</small></span>${icon("chevron-right")}</a>
      <button class="desktop-module-item" type="button" data-directory-open="feed" data-work-surface-open="feed" data-feed-preset="feed">${icon("activity")}<span><strong>Feed</strong><small>${L("所有来源消息，完整保留")}</small></span>${icon("chevron-right")}</button>
      <button class="desktop-module-item" type="button" data-directory-open="sources" data-work-surface-open="sources">${icon("settings")}<span><strong>${L("来源")}</strong><small>${L("账号、接入源与拉取计划")}</small></span>${icon("chevron-right")}</button>
      <button class="desktop-module-item" type="button" data-work-surface-open="promotion">${icon("arrow")}<span><strong>Promotion</strong><small>${L("把内容升格为 Goal")}</small></span><em>${L("规划中")}</em></button>
      <button class="desktop-module-item" type="button" data-work-surface-open="visual">${icon("workflow")}<span><strong>${L("可视化工作区")}</strong><small>${L("Goal 关系与规划画布")}</small></span><em>${L("规划中")}</em></button>
    </nav>
  </section>`;
  const desktopUtilitySurface = (id: string, label: string, note: string, detail: string, iconName: PageIcon) => `<section class="desktop-work-surface desktop-utility-surface" data-work-surface="${id}" data-work-surface-label="${escapeHtml(label)}" hidden>
    <div class="desktop-utility-heading">${icon(iconName)}<div><h1>${escapeHtml(label)}</h1><p>${note}</p></div><span>${L("规划中")}</span></div>
    <div class="desktop-utility-note"><strong>${L("工作面已经留好")}</strong><p>${detail}</p></div>
  </section>`;
  const projectNavigatorLayer = `<section class="navigator-project" aria-label="${L("当前项目")}">${renderDesktopProjectChrome(view.project ?? null, projectOptions, desktopShell, view.project ? "__PROJECT_SETTINGS__" : null, { switcherClass: "desktop-project-switcher", manageHref: "__PROJECT_INDEX__", directoryToggle: true })}</section>`;
  const showTui = !decisionView && !archiveView && !trashView;
  const desktopUtilityTitle = decisionView ? "Inbox" : collectionTitle;
  const desktopTabsLabel = decisionView ? "Inbox" : L("已打开的 Goal");
  const compactNavigation = {
    tree: L("目标"),
    focus: decisionView ? L("决定") : L("聚焦"),
    runtime: L("运行"),
  };
  const desktopWorkbenchHeader = `<div class="desktop-workbench-bar">
    <div class="desktop-work-tabs" data-work-tabs role="tablist" aria-label="${escapeHtml(desktopTabsLabel)}">
      ${selected ? goalsDocumentRenderer.renderInitialGoalTab(selected.goal) : `<div class="desktop-work-tab is-selected is-utility"><span role="tab" aria-selected="true">${escapeHtml(desktopUtilityTitle)}</span></div>`}
    </div>
    <div class="desktop-titlebar-drag"${desktopShell ? " data-tauri-drag-region" : ""} aria-hidden="true"></div>
  </div>`;
  const mobileWebProjectBar = !desktopShell
    ? `<header class="mobile-project-bar" aria-label="${L("当前项目")}">${renderProjectSwitcher(view.project ?? null, projectOptions, false, "mobile-project-switcher", "__PROJECT_INDEX__")}${view.project ? `<a class="mobile-project-settings" href="__PROJECT_SETTINGS__" aria-label="${L("打开当前项目设置")}" title="${L("项目设置")}">${icon("tune")}</a>` : ""}</header>`
    : "";
  const renderedDocumentContent = selected
      ? trashView
        ? renderTrashGoalDocument(selected, true)
        : renderGoalDocument(selected, view, true)
      : goalsDocumentRenderer.renderEmptyGoalCollection(trashView, true);
  const feedSupplementalEntries = feedNativePluginSupplementalEntries(view);
  const desktopDocumentContent = `<section class="desktop-work-surface" data-work-surface="goal" data-work-surface-label="${escapeHtml(collectionTitle)}"${decisionView ? " hidden" : ""}>${renderedDocumentContent}</section>
      ${projectOperations.surfaces}
      ${renderFeedNativePluginSurface(view, "workbench", initialFeedPreset, feedSupplementalEntries, decisionView)}
      ${renderFeedNativePluginSurface(view, "source-workbench", initialFeedPreset)}
      ${desktopUtilitySurface("promotion", "Promotion", L("把内容升格为 Goal"), L("等候选内容、团队决策和 Goal 创建边界确认后，再在这里接入升格流程；现在不伪造待处理项。"), "arrow")}
      ${desktopUtilitySurface("visual", L("可视化工作区"), L("Goal 关系与规划画布"), L("等画布实体、关系编辑和保存契约确认后，再在这里接入真实可视化工作区。"), "workflow")}`;
  const html = renderWorkbenchDocument({
    preamble_html: `<!--
THESIS: 只有一个目录入口，项目中的多条 Goal 在右侧复用；拒绝重复侧栏、轻首页大留白和后台管理式线框。
OWN-WORLD: 石墨目录、深浅同源的柔和工作面、克制钴蓝焦点、系统字体、Lucide 图标、阴影与色面区分层级，尽量减少结构线。
STORY: 先选择项目和工作类型；Goals 展开真实 Goal Tree，Inbox / Feed 展开同一套 Item 目录，右侧阅读详情、处理来源或升格为 Goal。
FIRST VIEWPORT: 约 310px 单目录与剩余标签工作面；项目切换位于 macOS 标题栏红黄绿按钮右侧，账户和全局设置贴左下，Goal 详情连续展开，Feed 详情保留清晰阅读列和就近动作。
FORM: Operate 模式的 single-directory project-tab workbench，方向由 2026-08-29 用户确认的交互原型锁定（seed=goalboard-desktop-single-directory-project-tabs-2026-08-29）。
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->\n`,
    lang: htmlLang(),
    title,
    head_before_title_html: controlTokenMeta(controlToken),
    head_html: `<script>${THEME_BOOTSTRAP_SCRIPT}</script>
  <script>if(new URLSearchParams(location.search).get("onboarding-embed")==="1"){document.documentElement.dataset.onboardingEmbed="true";document.documentElement.dataset.resolvedTheme="dark";document.documentElement.dataset.resolvedTerminalTheme="dark";}</script>
  <link rel="stylesheet" href="__WORKBENCH_CSS__">`,
    body_attributes: {
      "data-board-view": decisionView ? "decisions" : trashView ? "trash" : archiveView ? "archive" : "current",
      "data-route-prefix": view.route_prefix,
      "data-desktop-shell": "true",
      "data-desktop-surface": decisionView ? "feed" : "goal",
      "data-native-desktop": desktopShell ? "true" : null,
    },
    body_html: `
  ${renderIconSprite()}
  <div class="app">
    ${mobileWebProjectBar}
    <nav class="mobile-switch" role="tablist" aria-label="${L("移动端视图")}"><button class="${initialDesktopDirectory === "root" ? "is-active" : ""}" type="button" role="tab" aria-selected="${initialDesktopDirectory === "root"}" aria-controls="goal-tree-pane" data-mobile-directory-root data-directory-open="root">${icon("panel")}<span>${L("目录")}</span></button><button class="${initialDesktopDirectory === "root" ? "" : "is-active"}" type="button" role="tab" aria-selected="${initialDesktopDirectory !== "root"}" aria-controls="goal-tree-pane" data-mobile-target="tree">${compactNavigation.tree}</button><button type="button" role="tab" aria-selected="false" aria-controls="goal-document-pane" data-mobile-target="document">${compactNavigation.focus}</button>${showTui ? `<button type="button" role="tab" aria-selected="false" aria-controls="goal-tui-pane" data-mobile-target="tui">${compactNavigation.runtime}</button>` : ""}</nav>
    <main class="workspace${showTui ? " is-desktop-tui" : ""}" data-workspace data-mobile-view="tree" data-workspace-mode="focus">
      <aside class="tree-pane" id="goal-tree-pane" data-desktop-directory="${initialDesktopDirectory}">
        ${projectNavigatorLayer}
        ${desktopRootDirectory}
        ${goalsTreeRenderer.renderGoalDirectory(view, collection, initialDesktopDirectory === "goals")}
        ${projectOperations.directories}
        ${renderFeedNativePluginSurface(view, "directory", initialFeedPreset, feedSupplementalEntries)}
        ${renderFeedNativePluginSurface(view, "source-directory", initialFeedPreset)}
        ${desktopAccountFooter}
      </aside>
      <div class="tree-resizer" role="separator" aria-label="${L("调整 Goal Tree 宽度")}" aria-orientation="vertical" aria-valuemin="260" aria-valuemax="520" aria-valuenow="320" tabindex="0" data-tree-resizer></div>
      <header class="workbench-header desktop-pane-header">
        ${desktopWorkbenchHeader}
      </header>
      <section class="document-pane" id="goal-document-pane" data-document-pane role="tabpanel" tabindex="0"${selected ? "" : ` aria-label="${escapeHtml(desktopUtilityTitle)}"`}>
        ${desktopDocumentContent}
      </section>
      ${renderFeedNativePluginSurface(view, "overlays", initialFeedPreset)}
      ${!archiveView && !trashView ? renderMomentumPlaceholder() : ""}
      ${showTui ? renderTuiPane(selected, view, cliAvailability) : ""}
    </main>
  </div>
  ${renderCreateDialog(view)}
  ${renderGoalTrashDialog()}
  ${projectOperations.overlays}
  <div class="toast" data-toast role="status" aria-live="polite"></div>
  <script id="goalboard-data" type="application/json">${dataJson(view)}</script>
  <script>${clientI18nScript()}</script>
  <script src="/assets/goalboard-workbench.js"></script>
  ${showTui ? '<script src="/desktop/pty-client.js"></script>' : ""}`,
  });
  return prefixLocalLinks(html, view.route_prefix, desktopShell);
}
  return { renderGoalBoardWeb, renderGoalBoardRefreshFragment };
}
