import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readPersonalPlanningMethods } from "@adeptify/goalboard-module-goals";
import type { PlanningMethodPack } from "@adeptify/goalboard-contracts/modules/goals";

/** Read a personal library without provisioning or upgrading a catalog. */
export function readPersonalPlanningMethodPacks(homeDirectory?: string): PlanningMethodPack[] {
  const databasePath = path.join(path.resolve(homeDirectory ?? path.join(os.homedir(), ".goalboard")), "projects", "catalog.db");
  try { realpathSync(databasePath); }
  catch { return []; }
  return readPersonalPlanningMethods(databasePath);
}
