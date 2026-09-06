/** App-owned installation API and release-format types. No project facts. */

export const INSTALLER_ID = "goalboard-home-install-v1";

export const SCHEMA_VERSION = 4;

export const LEGACY_LAUNCHER_HEADER = "#!/usr/bin/env node\n// goalboard-home-launcher-v1";

export const BUNDLED_NODE_LAUNCHER_HEADER = "#!/bin/sh\n# goalboard-home-launcher-v2";

export type GoalBoardHomeInstallStatus = "installed" | "upgraded" | "refreshed" | "repaired" | "unchanged";

export type GoalBoardHomeInstallStep =
  | "before_stage_release"
  | "before_activate_release"
  | "before_write_install_manifest";

export interface GoalBoardHomeInstallOptions {
  /** Defaults to ~/.goalboard. Tests and host integrations may supply another absolute path. */
  homeDirectory?: string;
  /** Package root containing dist/, skills/, package.json and node_modules/. */
  sourceDirectory: string;
  /** Defaults to the source package version. Intended for controlled release builds. */
  version?: string;
  /** Test-only failure injection used to verify rollback behavior. */
  beforeStep?: (step: GoalBoardHomeInstallStep) => void | Promise<void>;
}

export interface GoalBoardHomeInstallResult {
  status: GoalBoardHomeInstallStatus;
  runtime_layout: "self_contained";
  home_directory: string;
  version: string;
  release_directory: string;
  program_directory: string;
  skill_directory: string;
  project_directory: string;
  logs_directory: string;
  launchers: {
    cli: string;
    mcp: string;
    web: string;
  };
  next_steps: {
    message: string;
    web_command: string[];
    service_install_command: string[];
    service_restart_command: string[];
  };
  written_paths: string[];
  preserved_paths: string[];
  removed_paths: string[];
}

export interface ReleaseManifest {
  schema_version: number;
  installer: string;
  version: string;
  dependencies?: "embedded";
  node_runtime?: "embedded";
  content_digest?: string;
  /** Present only in the obsolete schema-1 linked layout. */
  source_directory?: string;
  created_at: string;
}

export interface InstallManifest {
  schema_version: number;
  installer: string;
  version: string;
  release_path: string;
  content_digest?: string;
  updated_at: string;
}

export interface PromotedRelease {
  releaseDirectory: string;
  created: boolean;
  backupDirectory: string | null;
}

export interface RuntimeDependencyPackage {
  name: string;
  version: string;
  directory: string;
}

export interface InspectedSource {
  directory: string;
  version: string;
  runtimeDependencies: RuntimeDependencyPackage[];
  bundledNodePath: string | null;
  contentDigest: string;
}

export interface TextMutation {
  filePath: string;
  previous: string | null;
}

export class GoalBoardHomeInstallError extends Error {
  constructor(
    readonly code:
      | "home.not_directory"
      | "source.invalid"
      | "source.asset_missing"
      | "source.build_stale"
      | "version.invalid"
      | "home.unknown_file"
      | "release.conflict",
    message: string,
  ) {
    super(message);
    this.name = "GoalBoardHomeInstallError";
  }
}

