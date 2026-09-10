import type { GoalRecord, RiskRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionRunRecord } from "@adeptify/goalboard-contracts/modules/execution";
import type { EvidenceRecord } from "@adeptify/goalboard-contracts/modules/evidence-verification";
import type {
  WorkSessionEventKind as SessionTimelineKind,
  WorkSessionEventSource as SessionEventSource,
  WorkSessionRecord as GoalBoardSessionRecord,
  WorkSessionHandoffRecord as GoalBoardSessionHandoffRecord,
} from "@adeptify/goalboard-contracts/modules/private-work-context";

export { GoalBoardSessionError } from "@adeptify/goalboard-contracts/modules/private-work-context";
export type {
  WorkSessionRecord as GoalBoardSessionRecord,
  WorkSessionEventRecord as GoalBoardSessionEventRecord,
  WorkSessionHandoffRecord as GoalBoardSessionHandoffRecord,
  WorkSessionEventKind as SessionTimelineKind,
} from "@adeptify/goalboard-contracts/modules/private-work-context";
export type { RuntimeSessionAdapterResult } from "@adeptify/goalboard-contracts/services/runtime-host";

/** Read-only inputs consumed by handoff; no coordinator or business Store crosses into Work. */
export interface SessionHandoffGoalContext {
  board: { board_id: string };
  goal: GoalRecord;
  work_state: { work_state: string; next_action: string | null; pending_review_roles: readonly string[] };
  runs: readonly ExecutionRunRecord[];
  evidence: readonly EvidenceRecord[];
  risks: readonly RiskRecord[];
  event_work?: boolean;
  event_facts?: {
    work_status: string;
    outcome: string;
    next_step: string | null;
    pending_decisions: readonly string[];
    current_decisions: readonly string[];
    gaps: readonly string[];
    stale_summary: boolean;
  };
}

export interface SessionTimelineEvent {
  event_id: string;
  session_id: string;
  source: "runtime_native" | SessionEventSource;
  kind: SessionTimelineKind;
  label: string;
  content: string;
  occurred_at: string;
  source_order: number;
  runtime_id: string;
  metadata: Record<string, unknown>;
}

export type SessionContentMode = "native" | "fallback" | "unavailable" | "failed";

export interface SessionContentResult {
  session: GoalBoardSessionRecord;
  content_mode: SessionContentMode;
  events: SessionTimelineEvent[];
  native_error: { code: string; message: string } | null;
  native_history: {
    mode: "summary";
    turn_count: number;
    has_earlier: boolean;
  } | null;
  partial_terminal_history: boolean;
}

export type SessionResumeResult =
  | {
      status: "ok";
      runtime_id: string;
      native_runtime_session_id: string;
      value: unknown;
    }
  | {
      status: "unsupported" | "failed";
      runtime_id: string;
      code: string;
      message: string;
      next_action: "create_handoff" | "retry";
    };

export interface PrepareSessionHandoffInput {
  source_session_id: string;
  project_id: string;
  project_name: string;
  target_runtime_id: string;
  target_workspace_id?: string | null;
  target_workspace_path?: string | null;
  actor_id: string;
  goal_contract: SessionHandoffGoalContext;
}

export interface SendSessionHandoffInput {
  package_id: string;
  target_runtime_id: string;
  target_workspace_id?: string | null;
  target_workspace_path?: string | null;
  content: string;
  actor_id: string;
  user_confirmed: boolean;
}

export interface SessionHandoffResult {
  handoff: GoalBoardSessionHandoffRecord;
  destination_session: GoalBoardSessionRecord | null;
}
