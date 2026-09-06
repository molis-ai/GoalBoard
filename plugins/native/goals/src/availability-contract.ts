import type { ExecutionClaimRole as ClaimRole } from "@adeptify/goalboard-contracts/modules/execution";
import type { GoalRecord, GoalPolicy, GoalLifecycleReason as DecisionReason, ImpactBindingRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalActionKind, GoalWorkState, GoalWorkAction } from "./execution-validation-contract.js";

export interface ReadyGoal {
  goal: GoalRecord;
  role: ClaimRole;
  why_now: string;
  priority_hint: number;
  dependency_summary: string[];
  risk_summary: string[];
  resolved_policy: GoalPolicy;
  relevant_surfaces: ImpactBindingRecord[];
}

export interface AvailableGoal extends Omit<ReadyGoal, "role"> {
  /** Exact canonical action to submit to select_goal. Null only for a legacy repair action. */
  action_id: string | null;
  action_token: string;
  action_kind: GoalActionKind | null;
  action_target_type: string | null;
  action_target_id: string | null;
  /** Null means this action does not require a new Claim or Run. */
  role: ClaimRole | null;
  work_state: GoalWorkState;
  next_action: GoalWorkAction;
  review_obligation_id: string | null;
  /** True when an open parent must return to the user before unrelated work is chosen. */
  requires_parent_confirmation: boolean;
  /** Dependency-derived planning signals used to explain the execution order. */
  planning: {
    topological_level: number;
    unlock_count: number;
    longest_downstream_chain: number;
    rationale: string;
  };
}

/** A Goal that is not claimable because its finished work is waiting on a completion gate. */
export interface BlockedAvailableGoal {
  goal: GoalRecord;
  work_state: "completion_blocked" | "waiting_for_human" | "replaced";
  next_action: null;
  reasons: DecisionReason[];
  priority_hint: number;
  risk_summary: string[];
}

/** A compact pointer to an ordinary phase blocker that can be expanded with Explain. */
export interface BlockedAvailableOverview {
  goal: GoalRecord;
  work_state:
    | "clarification_blocked"
    | "waiting_children"
    | "execution_blocked"
    | "review_blocked"
    | "revalidation_blocked"
    | "invalidated";
  next_action: "explain" | "release";
  reasons: Array<Pick<DecisionReason, "code" | "message" | "facts" | "remediation">>;
  priority_hint: number;
}

export interface ParallelRuntimeAssignment {
  runtime_slot: "current_runtime" | `additional_runtime_${number}`;
  goal_id: string;
  title: string;
  role: "executor";
  required_capabilities: string[];
}

export interface ParallelExecutionSuggestion {
  kind: "safe_parallel_execution";
  advisory_only: true;
  assignments: ParallelRuntimeAssignment[];
}

export interface ReadyQuery {
  board_id: string;
  actor_id: string;
  role?: ClaimRole;
  capabilities?: string[];
  goal_mode_attestation?: boolean;
}

export interface ReadyQueryResult {
  observed_event_cursor: number;
  ready: ReadyGoal[];
}

/** A role-neutral query: the Runtime gets the whole Available set and chooses. */
export interface AvailableQuery {
  board_id: string;
  actor_id: string;
  capabilities?: string[];
  goal_mode_attestation?: boolean;
}

export interface AvailableQueryResult {
  observed_event_cursor: number;
  available: AvailableGoal[];
  blocked: BlockedAvailableGoal[];
  blocked_overview: BlockedAvailableOverview[];
  parallel_suggestion: ParallelExecutionSuggestion | null;
}

export interface ExplainGoalResult {
  goal: GoalRecord | null;
  role: ClaimRole;
  ready: boolean;
  observed_event_cursor: number;
  reasons: DecisionReason[];
  resolved_policy: GoalPolicy;
  relevant_surfaces: ImpactBindingRecord[];
}

/** Existing role-scoped and role-neutral queries; no selection or mutation occurs here. */
export interface GoalAvailabilityQueryApi {
  queryReady(input: ReadyQuery): ReadyQueryResult;
  queryAvailable(input: AvailableQuery): AvailableQueryResult;
  explainGoal(input: ReadyQuery & { goal_id: string }): ExplainGoalResult;
}
