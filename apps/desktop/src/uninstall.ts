import { createLocalUninstallService, type GoalBoardUninstallServiceOptions } from "@adeptify/goalboard-app-local-host";
import { withGoalBoardProjectCatalog } from "./project-catalog.js";

export function createDesktopUninstallService(options: Omit<GoalBoardUninstallServiceOptions, "projects"> = {}) {
  return createLocalUninstallService(options, withGoalBoardProjectCatalog);
}
