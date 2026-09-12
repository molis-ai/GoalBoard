export interface WebProjectNavigation {
  project_id: string;
  display_name: string;
  data_class?: "user" | "migrated_user" | "regenerable_demo";
}


export type WebSettingsSection = "appearance" | "runtimes" | "projects" | "diagnostics";
type SettingsNavigationActive = WebSettingsSection | "planning";
type ProjectSettingsNavigationActive = "general" | "guidance" | "rules" | "planning";


export interface SettingsNavigationPrimitives {
  L(text: string): string;
  escapeHtml(value: unknown): string;
  icon(name: "database" | "chevron-down" | "check" | "settings" | "panel" | "bell" | "arrow" | "user" | "system" | "workflow" | "tree" | "activity" | "book" | "shield"): string;
  withDesktopQuery(path: string): string;
}
export function createWorkbenchSettingsNavigation(primitives: SettingsNavigationPrimitives) {
  const { L, escapeHtml, icon, withDesktopQuery } = primitives;
function settingsContextHref(
  path: string,
  project: Pick<WebProjectNavigation, "project_id"> | null,
  desktopShell: boolean,
): string {
  const separator = path.includes("?") ? "&" : "?";
  const contextualPath = project
    ? `${path}${separator}project=${encodeURIComponent(project.project_id)}`
    : path;
  return desktopShell ? withDesktopQuery(contextualPath) : contextualPath;
}

function renderProjectSwitcher(
  currentProject: WebProjectNavigation | null,
  projects: readonly WebProjectNavigation[],
  desktopShell: boolean,
  className = "navigator-project-menu",
  manageHref = "/",
): string {
  const href = (path: string) => desktopShell ? withDesktopQuery(path) : path;
  const options = projects.length ? projects : currentProject ? [currentProject] : [];
  const currentName = currentProject?.display_name ?? L("选择项目");
  return `<details class="${className} navigator-project-menu" data-project-menu><summary class="navigator-project-selector" aria-label="${L("切换项目")}">${icon("database")}<strong title="${escapeHtml(currentName)}">${escapeHtml(currentName)}</strong>${icon("chevron-down")}</summary><div class="navigator-project-menu-popover"><span>${L("切换项目")}</span><nav>${options.map((project) => `<a class="navigator-project-option${project.project_id === currentProject?.project_id ? " is-current" : ""}" href="${href(`/projects/${encodeURIComponent(project.project_id)}/`)}"${project.project_id === currentProject?.project_id ? ' aria-current="page"' : ""}><span>${icon("database")}<strong>${escapeHtml(project.display_name)}</strong></span>${project.project_id === currentProject?.project_id ? icon("check") : ""}</a>`).join("")}</nav><a class="navigator-project-manage" href="${desktopShell ? withDesktopQuery(manageHref) : manageHref}">${icon("settings")}<span>${L("管理项目")}</span></a></div></details>`;
}

function renderDesktopProjectChrome(
  currentProject: WebProjectNavigation | null,
  projects: readonly WebProjectNavigation[],
  desktopShell: boolean,
  settingsHref: string | null,
  options: {
    switcherClass?: string;
    manageHref?: string;
    settingsCurrent?: boolean;
    directoryToggle?: boolean;
  } = {},
): string {
  const dragAttribute = desktopShell ? " data-tauri-drag-region" : "";
  const directoryToggle = options.directoryToggle
    ? `<button class="navigator-directory-toggle" type="button" data-directory-toggle aria-expanded="true" aria-label="${L("收起目录")}" title="${L("收起目录")}">${icon("panel")}</button>`
    : "";
  const settings = settingsHref
    ? `<a class="navigator-project-settings" href="${settingsHref}"${options.settingsCurrent ? ' aria-current="page"' : ""} aria-label="${options.settingsCurrent ? L("当前项目设置") : L("打开当前项目设置")}" title="${L("项目设置")}">${icon("settings")}</a>`
    : "";
  return `<div class="navigator-native-row">${directoryToggle}<div class="desktop-titlebar-drag desktop-titlebar-drag--left"${dragAttribute} aria-hidden="true"></div></div><div class="navigator-project-primary">${renderProjectSwitcher(currentProject, projects, desktopShell, options.switcherClass, options.manageHref)}<button class="navigator-project-notifications" type="button" disabled aria-label="${L("通知，暂不可用")}" title="${L("通知功能即将开放")}">${icon("bell")}</button>${settings}</div>`;
}

function renderSettingsNavigation(
  active: SettingsNavigationActive,
  project: WebProjectNavigation | null,
  desktopShell = false,
  projects: readonly WebProjectNavigation[] = [],
): string {
  const globalHref = (path: string) => settingsContextHref(path, project, desktopShell);
  const planningHref = settingsContextHref("/settings/planning", null, desktopShell);
  const current = (section: SettingsNavigationActive) => active === section ? ' aria-current="page"' : "";
  const projectHome = project ? `/projects/${encodeURIComponent(project.project_id)}/` : "/";
  const projectSettings = project ? `/projects/${encodeURIComponent(project.project_id)}/settings/guidance` : "/settings/projects";
  const desktopProjectContext = `<div class="settings-desktop-project">${renderDesktopProjectChrome(project, projects, desktopShell, desktopShell ? withDesktopQuery(projectSettings) : projectSettings, { switcherClass: "settings-project-switcher" })}</div><header class="settings-desktop-heading"><a href="${desktopShell ? withDesktopQuery(projectHome) : projectHome}" aria-label="${L("返回项目")}">${icon("arrow")}</a><span><strong>${L("全局设置")}</strong><small>${L("只影响当前设备")}</small></span></header>`;
  const desktopFooter = `<footer class="personal-sidebar-footer"><a class="personal-account" href="${globalHref("/settings/appearance")}" aria-current="page" aria-label="${L("全局设置")}"><span class="personal-account-avatar" aria-hidden="true">${icon("user")}</span><span class="personal-account-copy"><strong>${L("一骏")}</strong><small>${L("本地空间")}</small></span><span class="personal-account-settings" aria-hidden="true">${icon("settings")}</span></a></footer>`;
  return `<nav class="settings-navigation" aria-label="${L("系统设置")}">
    ${desktopProjectContext}<div class="settings-nav-body"><section class="settings-nav-group" aria-labelledby="settings-global-group"><div class="settings-nav-label" id="settings-global-group"><span>${L("全局设置")}</span><small>${L("只影响当前设备")}</small></div>
      <a href="${globalHref("/settings/appearance")}"${current("appearance")}>${icon("system")}<span><strong>${L("界面与语言")}</strong><small>${L("语言、主题、终端与界面密度")}</small></span></a>
      <a href="${globalHref("/settings/runtimes")}"${current("runtimes")}>${icon("workflow")}<span><strong>${L("AI 与执行工具")}</strong><small>${L("连接 Runtime 与会话")}</small></span></a>
      <a href="${planningHref}"${current("planning")}>${icon("tree")}<span><strong>${L("规划方法")}</strong><small>${L("规划方法库")}</small></span></a>
      <a href="${globalHref("/settings/diagnostics")}"${current("diagnostics")}>${icon("activity")}<span><strong>${L("诊断")}</strong><small>${L("安装、服务与环境")}</small></span></a>
    </section></div>${desktopFooter}
  </nav>`;
}

function renderProjectSettingsNavigation(
  active: ProjectSettingsNavigationActive,
  project: WebProjectNavigation,
  desktopShell = false,
  projects: readonly WebProjectNavigation[] = [],
): string {
  const routePrefix = `/projects/${encodeURIComponent(project.project_id)}`;
  const href = (path: string) => desktopShell ? withDesktopQuery(path) : path;
  const current = (section: ProjectSettingsNavigationActive) => active === section ? ' aria-current="page"' : "";
  const desktopProjectContext = `<div class="settings-desktop-project">${renderDesktopProjectChrome(project, projects, desktopShell, href(`${routePrefix}/settings/guidance`), { switcherClass: "settings-project-switcher", settingsCurrent: true })}</div><header class="settings-desktop-heading"><a href="${href(`${routePrefix}/`)}" aria-label="${L("返回 Goal Tree")}">${icon("arrow")}</a><span><strong>${L("项目设置")}</strong><small>${escapeHtml(project.display_name)}</small></span></header>`;
  const globalSettingsHref = settingsContextHref("/settings/appearance", project, desktopShell);
  const desktopFooter = `<footer class="personal-sidebar-footer"><a class="personal-account" href="${globalSettingsHref}" aria-label="${L("打开全局设置")}"><span class="personal-account-avatar" aria-hidden="true">${icon("user")}</span><span class="personal-account-copy"><strong>${L("一骏")}</strong><small>${L("本地空间")}</small></span><span class="personal-account-settings" aria-hidden="true">${icon("settings")}</span></a></footer>`;
  return `<nav class="settings-navigation project-settings-navigation" aria-label="${L("项目设置")}">
    ${desktopProjectContext}<div class="settings-nav-body">
    <section class="settings-nav-group" aria-labelledby="settings-project-group"><div class="settings-nav-label" id="settings-project-group"><span>${L("项目设置")}</span><small>${escapeHtml(project.display_name)}</small></div>
      <a href="${href(`${routePrefix}/settings/general`)}"${current("general")}>${icon("settings")}<span><strong>${L("基本信息")}</strong><small>${L("项目名称与删除")}</small></span></a>
      <a href="${href(`${routePrefix}/settings/guidance`)}"${current("guidance")}>${icon("book")}<span><strong>${L("项目说明")}</strong><small>${L("所有 Goal 共享的长期上下文")}</small></span></a>
      <a href="${href(`${routePrefix}/settings/rules`)}"${current("rules")}>${icon("shield")}<span><strong>${L("工作规则")}</strong><small>${L("执行和复核底线")}</small></span></a>
      <a href="${href(`${routePrefix}/settings/planning`)}"${current("planning")}>${icon("workflow")}<span><strong>${L("工作规划")}</strong><small>${L("选择和调整规划方法")}</small></span></a>
    </section></div>${desktopFooter}
  </nav>`;
}


  return { settingsContextHref, renderProjectSwitcher, renderDesktopProjectChrome, renderSettingsNavigation, renderProjectSettingsNavigation };
}
