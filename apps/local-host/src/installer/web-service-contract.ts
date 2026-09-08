export const SERVICE_OWNER = "goalboard-web-service-v1";
export const SERVICE_LABEL = "com.adeptify.goalboard.web";

export type GoalBoardWebServiceAction = "install" | "start" | "stop" | "restart" | "remove";
import type { GoalBoardWebServiceDetection } from "@adeptify/goalboard-contracts/platform/app-host";
export type { GoalBoardWebServiceState, GoalBoardWebServiceDetection } from "@adeptify/goalboard-contracts/platform/app-host";

export interface GoalBoardWebServicePlan {
  plan_id: string;
  action: GoalBoardWebServiceAction;
  status: "ready" | "no_change" | "unsupported" | "conflict";
  next_action: "service_install" | null;
  detection: GoalBoardWebServiceDetection;
  changes: Array<{ operation: "create" | "start" | "stop" | "restart" | "remove"; target: string }>;
  confirmation: string;
  message: string;
}

export interface GoalBoardWebServiceResult {
  status: "installed" | "started" | "stopped" | "restarted" | "removed" | "unchanged" | "declined";
  action: GoalBoardWebServiceAction;
  detection: GoalBoardWebServiceDetection;
  message: string;
}

export interface GoalBoardWebServiceRestartPending {
  status: "restarting";
  action: "restart";
  previous_process_id: number;
  message: string;
}

export interface GoalBoardWebServiceManagerOptions {
  homeDirectory?: string;
  userHomeDirectory?: string;
  nodeExecutablePath?: string;
  platform?: NodeJS.Platform;
  uid?: number;
  runCommand?: (file: string, args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
  /** Returns true only when the endpoint belongs to the expected managed process. */
  healthCheck?: (expectedProcessId?: number) => Promise<boolean>;
  /** Compatibility proof for legacy health payloads: the endpoint has no identity and the listener PID matches exactly. */
  legacyInstanceCheck?: (expectedProcessId: number) => Promise<boolean>;
  /** Returns true when another process is already accepting connections on the Web port. */
  portCheck?: () => Promise<boolean>;
  /** Tests may remove the real launchd transition wait without changing retry behavior. */
  transitionDelayMilliseconds?: number;
}

export interface WebServiceReceipt {
  schema_version: 1;
  owner: typeof SERVICE_OWNER;
  label: string;
  plist_path: string;
  plist_hash: string;
  installed_at: string;
}

export interface PreparedServicePlan {
  publicPlan: GoalBoardWebServicePlan;
  snapshotHash: string;
  expectedPlist: string;
}

export class GoalBoardWebServiceError extends Error {
  constructor(
    readonly code: "service.unsupported" | "service.conflict" | "service.plan_missing" | "service.plan_stale" | "service.command_failed",
    message: string,
  ) {
    super(message);
    this.name = "GoalBoardWebServiceError";
  }
}
