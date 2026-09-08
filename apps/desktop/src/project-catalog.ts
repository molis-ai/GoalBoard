import { GoalBoardProjectCatalog, type GoalBoardProjectCatalogOptions } from "@adeptify/goalboard-app-local-host";
import { DesktopPanelService } from "./panels.js";
import { createDesktopPanelTables, SqliteDesktopPanelRepository } from "./adapters/sqlite-panels.js";

/** Open the one Host catalog with the current desktop platform adapters. */
export function openGoalBoardProjectCatalog(options: GoalBoardProjectCatalogOptions = {}): Promise<GoalBoardProjectCatalog> {
  return GoalBoardProjectCatalog.open(options, {
    createPanelSchema: createDesktopPanelTables,
    createPanels: (db, ports) => new DesktopPanelService({ ...ports, repository: new SqliteDesktopPanelRepository(db) }),
  });
}
export async function withGoalBoardProjectCatalog<T>(options: GoalBoardProjectCatalogOptions, operation: (catalog: GoalBoardProjectCatalog) => T | Promise<T>): Promise<T> {
  const catalog = await openGoalBoardProjectCatalog(options);
  try { return await operation(catalog); } finally { catalog.close(); }
}
