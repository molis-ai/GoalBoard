import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalSqliteStorage } from "@adeptify/goalboard-storage";
import { GoalBoardUninstallService } from "./installer/uninstall.js";
import type { GoalBoardUninstallServiceOptions, UninstallProjectAccess } from "./installer/uninstall-contract.js";
import { inspectProjectCatalogForUninstall } from "@adeptify/goalboard-module-projects";
import type { LocalWebCatalogRunner } from "./web-project-settings.js";

/** Read-only Catalog inspection and the existing Demo lifecycle for local uninstall. */
export function createLocalUninstallService(options: Omit<GoalBoardUninstallServiceOptions, "projects">, withGoalBoardProjectCatalog: LocalWebCatalogRunner): GoalBoardUninstallService {
  const homeDirectory = path.resolve(options.homeDirectory ?? path.join(os.homedir(), ".goalboard"));
  const projects: UninstallProjectAccess = {
    async inspect() {
      const databasePath = path.join(homeDirectory, "projects", "catalog.db");
      try { await fs.stat(databasePath); } catch { return { projects: [], conflict: null }; }
      let storage: LocalSqliteStorage | null = null;
      try {
        storage = new LocalSqliteStorage(databasePath, { readonly: true });
        const inspection = inspectProjectCatalogForUninstall(storage.db);
        return { projects: inspection.projects, conflict: inspection.owned ? null : `项目 catalog 不属于 GoalBoard：${databasePath}` };
      } catch (error) {
        return { projects: [], conflict: `无法安全读取项目 catalog：${error instanceof Error ? error.message : String(error)}` };
      } finally { storage?.close(); }
    },
    async removeDemos(input) {
      await withGoalBoardProjectCatalog({ homeDirectory }, async catalog => {
        for (const projectId of input.project_ids) await catalog.removeDemoProject({
          project_id: projectId, actor_id: "goalboard-uninstaller", delete_confirmed: true,
          idempotency_key: `${input.plan_id}:${projectId}`,
        });
      });
    },
  };
  return new GoalBoardUninstallService({ ...options, homeDirectory, projects });
}
