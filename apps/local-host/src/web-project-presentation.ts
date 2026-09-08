import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { WebProjectNavigation, WebSettingsProject, WebInstallationDiagnostics } from "@adeptify/goalboard-app-workbench";
import type { GoalBoardProjectRecord } from "./project-catalog.js";

export function projectNavigation(project: GoalBoardProjectRecord): WebProjectNavigation {
  return {
    project_id: project.project_id,
    display_name: project.display_name,
    data_class: project.data_class,
  };
}

export function settingsProject(project: GoalBoardProjectRecord): WebSettingsProject {
  return {
    project_id: project.project_id,
    display_name: project.display_name,
    database_path: project.database_path,
    source: project.source,
    data_class: project.data_class,
    created_at: project.created_at,
  };
}

export function installationDiagnostics(
  homeDirectory: string | undefined,
  projectCount: number,
): WebInstallationDiagnostics {
  const home = path.resolve(homeDirectory ?? path.join(os.homedir(), ".goalboard"));
  const manifestPath = path.join(home, "config", "installation.json");
  let installationState: WebInstallationDiagnostics["installation_state"] = "missing";
  let version: string | null = null;
  let releaseDirectory: string | null = null;
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        installer?: unknown;
        version?: unknown;
        release_path?: unknown;
      };
      if (
        manifest.installer === "goalboard-home-install-v1"
        && typeof manifest.version === "string"
        && typeof manifest.release_path === "string"
      ) {
        version = manifest.version;
        releaseDirectory = path.resolve(home, manifest.release_path);
        installationState = "ready";
      } else {
        installationState = "invalid";
      }
    } catch {
      installationState = "invalid";
    }
  }
  return {
    home_directory: home,
    installation_state: installationState,
    version,
    release_directory: releaseDirectory,
    project_count: projectCount,
    launchers: ([
      ["CLI", "goalboard"],
      ["MCP", "goalboard-mcp"],
      ["Web", "goalboard-web"],
    ] as const).map(([name, file]) => {
      const launcherPath = path.join(home, "bin", file);
      return { name, path: launcherPath, state: fs.existsSync(launcherPath) ? "ready" : "missing" };
    }),
  };
}
