import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { GoalBoardUninstallService, type GoalBoardUninstallServiceOptions, type UninstallProjectAccess } from "@adeptify/goalboard-app-local-host";
import { inspectProjectCatalogForUninstall } from "@adeptify/goalboard-module-projects";
import { withGoalBoardProjectCatalog } from "../projects/catalog-session.js";

/** Temporary root composition for the remaining catalog file lifecycle, not installer policy. */
export function createLocalUninstallService(options: Omit<GoalBoardUninstallServiceOptions, "projects"> = {}): GoalBoardUninstallService {
  const homeDirectory = path.resolve(options.homeDirectory ?? path.join(os.homedir(), ".goalboard"));
  const projects: UninstallProjectAccess = {
    async inspect() {
      const databasePath = path.join(homeDirectory, "projects", "catalog.db");
      try { await fs.stat(databasePath); } catch { return { projects: [], conflict: null }; }
      let db: Database.Database | null = null;
      try {
        db = new Database(databasePath, { readonly: true, fileMustExist: true });
        const inspection = inspectProjectCatalogForUninstall(db);
        return { projects: inspection.projects, conflict: inspection.owned ? null : `项目 catalog 不属于 GoalBoard：${databasePath}` };
      } catch (error) {
        return { projects: [], conflict: `无法安全读取项目 catalog：${error instanceof Error ? error.message : String(error)}` };
      } finally { db?.close(); }
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
