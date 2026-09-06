import type { McpLauncherValidationContext } from "@adeptify/goalboard-app-mcp";

export const INTEGRATION_OWNER = "goalboard-runtime-integration-v1";

export const INSTALLER_OWNER = "goalboard-home-install-v1";

export const SUPPORTED_RUNTIME_IDS = ["codex", "claude-code", "opencode", "pi-agent", "grok-build"] as const;

export type SupportedRuntimeId = (typeof SUPPORTED_RUNTIME_IDS)[number];

export function isSupportedRuntimeId(value: string): value is SupportedRuntimeId {
  return (SUPPORTED_RUNTIME_IDS as readonly string[]).includes(value);
}

export type RuntimeIntegrationAction = "connect" | "remove";

export type RuntimeConnectionState =
  | "not_detected"
  | "goalboard_unavailable"
  | "not_connected"
  | "needs_repair"
  | "connected"
  | "conflict";

export interface RuntimeIntegrationDetection {
  runtime_id: SupportedRuntimeId;
  display_name: string;
  executable_path: string | null;
  config_path: string;
  skill_path: string;
  connection_state: RuntimeConnectionState;
  message: string;
}

export interface RuntimeIntegrationChange {
  kind: "runtime_config" | "skill_link" | "ownership_receipt";
  target_path: string;
  operation: "add" | "replace" | "remove";
  before: string;
  after: string;
}

export interface RuntimeIntegrationPlan {
  schema_version: 1;
  plan_id: string;
  plan_hash: string;
  runtime_id: SupportedRuntimeId;
  display_name: string;
  action: RuntimeIntegrationAction;
  status: "ready" | "no_change" | "conflict" | "unavailable";
  changes: RuntimeIntegrationChange[];
  backup_path: string | null;
  confirmation: string;
  alternative: string;
  restart_instructions: string[];
  message: string;
}

export interface RuntimeIntegrationConfirmation {
  runtime_id: SupportedRuntimeId;
  plan_id: string;
  decision: "confirmed" | "declined";
}

export type RuntimeIntegrationResultStatus =
  | "declined"
  | "confirmation_mismatch"
  | "plan_not_found"
  | "unavailable"
  | "conflict"
  | "stale"
  | "connected"
  | "already_connected"
  | "removed"
  | "already_removed"
  | "rolled_back";

export interface RuntimeIntegrationResult {
  status: RuntimeIntegrationResultStatus;
  runtime_id: SupportedRuntimeId;
  plan_id: string;
  backup_path: string | null;
  receipt_path: string | null;
  message: string;
}

export interface RuntimeIntegrationValidationContext extends McpLauncherValidationContext {
  runtime_id: SupportedRuntimeId;
}

export interface RuntimeIntegrationServiceOptions {
  /** GoalBoard-owned home. Defaults to ~/.goalboard. */
  homeDirectory?: string;
  /** User home containing Runtime configuration. Defaults to os.homedir(). */
  userHomeDirectory?: string;
  /** Executable lookup path. Defaults to process.env.PATH. */
  pathEnvironment?: string;
  /** Deterministic executable paths for hosts and tests. null means not installed. */
  runtimeExecutables?: Partial<Record<SupportedRuntimeId, string | null>>;
  /** Defaults to a real MCP initialize/tools-list smoke test. */
  validateConnection?: (context: RuntimeIntegrationValidationContext) => boolean | Promise<boolean>;
}

export interface InstalledArtifacts {
  launcherPath: string;
  skillSourcePath: string;
}

export interface DesiredConnection {
  runtimeId: SupportedRuntimeId;
  launcherPath: string;
  goalboardHome: string;
}

export interface ConfigInspection {
  state: "absent" | "current" | "legacy" | "conflict";
  summary: string;
  entryFingerprint: string | null;
}

export interface SkillSnapshot {
  state: "absent" | "current" | "managed" | "conflict";
  signature: string;
  rawLinkTarget: string | null;
  resolvedLinkTarget: string | null;
}

export interface RuntimeSnapshot {
  adapter: RuntimeAdapter;
  executablePath: string | null;
  runtimeDetected: boolean;
  artifacts: InstalledArtifacts | null;
  configText: string | null;
  configHash: string | null;
  configInspection: ConfigInspection;
  skill: SkillSnapshot;
}

export interface RuntimeAdapter {
  id: SupportedRuntimeId;
  displayName: string;
  executableNames: readonly string[];
  detectionPaths(userHome: string): readonly string[];
  configPath(userHome: string): string;
  skillPath(userHome: string): string;
  desiredConnection(artifacts: InstalledArtifacts, goalboardHome: string): DesiredConnection;
  inspectConfig(contents: string | null, desired: DesiredConnection): ConfigInspection;
  connectConfig(contents: string | null, desired: DesiredConnection): string;
  removeConfig(contents: string | null): string | null;
  restartInstructions: readonly string[];
}

export interface IntegrationReceipt {
  schema_version: 1;
  owner: typeof INTEGRATION_OWNER;
  runtime_id: SupportedRuntimeId;
  config_path: string;
  config_entry_fingerprint: string;
  skill_path: string;
  skill_target: string;
  connected_at: string;
}

export interface PreparedPlan {
  publicPlan: RuntimeIntegrationPlan;
  adapter: RuntimeAdapter;
  beforeConfigText: string | null;
  beforeConfigHash: string | null;
  beforeSkill: SkillSnapshot;
  nextConfigText: string | null;
  artifacts: InstalledArtifacts | null;
  receipt: IntegrationReceipt | null;
}

export class RuntimeIntegrationError extends Error {
  constructor(
    readonly code:
      | "runtime.unsupported"
      | "runtime.installation_invalid"
      | "runtime.config_invalid"
      | "runtime.plan_invalid"
      | "runtime.receipt_invalid",
    message: string,
  ) {
    super(message);
    this.name = "RuntimeIntegrationError";
  }
}

