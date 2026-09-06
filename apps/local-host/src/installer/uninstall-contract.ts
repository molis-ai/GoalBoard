import type { ProjectRecord } from "@adeptify/goalboard-contracts/modules/projects";
import type { RuntimeIntegrationService } from "./runtime-integration.js";
import type { RuntimeIntegrationPlan } from "./runtime-integration-contract.js";
import type { GoalBoardWebServiceManager } from "./web-service.js";
import type { GoalBoardWebServicePlan } from "./web-service-contract.js";
export const UNINSTALL_OWNER = "goalboard-uninstall-v1";

export interface GoalBoardUninstallChange {
  kind: "runtime" | "web_service" | "demo" | "launcher" | "release" | "install_manifest" | "user_data";
  target: string;
  description: string;
}

export interface GoalBoardUninstallPlan {
  plan_id: string;
  status: "ready" | "no_change" | "conflict";
  home_directory: string;
  purge_user_data: boolean;
  user_project_count: number;
  demo_project_count: number;
  changes: GoalBoardUninstallChange[];
  preserved_paths: string[];
  conflicts: string[];
  confirmation: string;
  message: string;
}

export interface GoalBoardUninstallResult {
  status: "uninstalled" | "purged" | "unchanged" | "declined";
  home_directory: string;
  removed_paths: string[];
  preserved_paths: string[];
  receipt_path: string | null;
  message: string;
}

export interface GoalBoardUninstallServiceOptions {
  homeDirectory?: string;
  projects: UninstallProjectAccess;
  runtimeIntegrationService?: RuntimeIntegrationService;
  webServiceManager?: GoalBoardWebServiceManager;
}

export interface PreparedUninstallPlan {
  publicPlan: GoalBoardUninstallPlan;
  snapshotHash: string;
  runtimePlans: RuntimeIntegrationPlan[];
  webPlan: GoalBoardWebServicePlan;
  ownedPaths: string[];
  purgeDataPaths: string[];
  snapshotPaths: string[];
  demoProjectIds: string[];
}

export interface CatalogInspection {
  projects: ProjectRecord[];
  conflict: string | null;
}

export interface UninstallReceipt {
  schema_version: 1;
  owner: typeof UNINSTALL_OWNER;
  plan_id: string;
  home_directory: string;
  purge_user_data: boolean;
  preserved_projects: Array<{ project_id: string; display_name: string; data_class: string }>;
  completed_steps: string[];
  removed_paths: string[];
  state: "in_progress" | "complete" | "failed";
  error: string | null;
  updated_at: string;
}

export class GoalBoardUninstallError extends Error {
  constructor(
    readonly code:
      | "uninstall.plan_missing"
      | "uninstall.plan_stale"
      | "uninstall.conflict"
      | "uninstall.purge_confirmation_required"
      | "uninstall.step_failed",
    message: string,
  ) {
    super(message);
    this.name = "GoalBoardUninstallError";
  }
}


export interface UninstallProjectAccess {
  inspect(): Promise<CatalogInspection>;
  removeDemos(input: { project_ids: string[]; plan_id: string }): Promise<void>;
}
