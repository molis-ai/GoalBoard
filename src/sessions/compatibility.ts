import { GoalBoardProjectCatalog, normalizeRuntimeWorkContext } from "../projects/catalog.js";
import type { LegacySessionMigrationApi } from "@adeptify/goalboard-contracts/modules/private-work-context";
import type { LegacySessionMigrationReport } from "./types.js";
export { runtimeSessionHostSignalsFromEnvironment } from "@adeptify/goalboard-app-local-host";
export { findSessionForHostSignals } from "@adeptify/goalboard-module-private-work-context";
export type { RuntimeSessionHostSignals } from "@adeptify/goalboard-contracts/modules/private-work-context";

export function reconcileLegacySessionCatalog(
  catalog: GoalBoardProjectCatalog,
  registry: LegacySessionMigrationApi,
  beforeStep?: (step: "after_panels" | "after_bindings" | "before_commit") => void,
): LegacySessionMigrationReport {
  const panels = catalog.listProjects().flatMap((project) =>
    catalog.desktopPanels.list(project.project_id).map((panel) => {
      const normalized = panel.cwd
        ? normalizeRuntimeWorkContext({
            runtime_id: panel.runtime_kind,
            stable_work_context_id: null,
            host_declares_stable: false,
            workspace: { canonical_path: panel.cwd, realpath_verified: false },
          }).workspace
        : undefined;
      return {
        panel_id: panel.panel_id,
        project_id: panel.project_id,
        goal_id: panel.goal_id,
        runtime_id: panel.runtime_kind,
        work_context_id: panel.work_context_id,
        host_session_id: panel.host_session_id,
        workspace_id: normalized?.workspace_id ?? null,
        workspace_path: normalized?.canonical_path ?? null,
        title: panel.title,
        status: panel.status,
        created_at: panel.created_at,
        updated_at: panel.updated_at,
      };
    }),
  );
  return registry.migrateLegacy({
    panels,
    bindings: catalog.listRuntimeContextBindings().map((binding) => ({
      binding_id: binding.binding_id,
      runtime_id: binding.runtime_id,
      stable_work_context_id: binding.stable_work_context_id,
      project_id: binding.project_id,
      bound_by: binding.bound_by,
      created_at: binding.created_at,
      updated_at: binding.updated_at,
    })),
    before_step: beforeStep,
  });
}
