import { createWorkbenchRenderer, type WorkbenchRendererPorts } from "@adeptify/goalboard-app-workbench";
import { DEFAULT_GOAL_POLICY, composePlanningMethodPacks } from "@adeptify/goalboard-module-goals";
import { L, currentLocale, htmlLang, dateTimeLocale, listJoin, localeSwitchHref, clientI18nScript } from "./web-locale.js";

/** Bind Workbench to this Host's request scope; Desktop supplies its own optional-shell behavior. */
export function createLocalHostWorkbenchRenderer(desktop: WorkbenchRendererPorts["desktop"]) {
  return createWorkbenchRenderer({
    locale: { L, currentLocale, htmlLang, dateTimeLocale, listJoin, localeSwitchHref, clientI18nScript },
    desktop,
    goals: { defaultPolicy: DEFAULT_GOAL_POLICY, composePlanningMethodPacks },
  });
}
