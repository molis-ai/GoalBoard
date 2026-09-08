import type { GoalLifecycleReason, GoalPolicy, ImpactBindingRecord, GoalRevisionDependentTransition } from "./goals.js";
import type { ContractDescriptor } from "../platform/package.js";

export const modulesExecutionContract = {
  contractId: "io.goalboard.module.execution.v1",
  kind: "module",
  schemaVersion: 1,
  maturity: "partial",
  ssot: "docs/modules/execution.md",
} as const satisfies ContractDescriptor;

export type ExecutionClaimRole =
  | "clarifier"
  | "executor"
  | "self_verifier"
  | "cross_reviewer"
  | "adversarial_reviewer"
  | "revalidator";

export type ExecutionClaimState = "active" | "released" | "expired" | "revoked";
export type ExecutionRunState = "started" | "blocked" | "completed" | "failed" | "abandoned";

/** Active, unexpired Claim + confirmed Goal declaration, assembled by the caller. */
export interface ExecutionImpactOccupancy extends Pick<ImpactBindingRecord, "surface" | "access" | "input_snapshot"> {
  claim_id: string;
  existing_goal_id: string;
}

export interface ExecutionImpactPolicyApi {
  conflicts(requested: readonly ImpactBindingRecord[], occupied: readonly ExecutionImpactOccupancy[]): GoalLifecycleReason[];
  allowsParallel(existing: readonly ImpactBindingRecord[], requested: readonly ImpactBindingRecord[]): boolean;
}
export type ExecutionActionKind =
  | "clarify"
  | "execute"
  | "submit_evidence"
  | "revise"
  | "review"
  | "revalidate"
  | "mitigate_risk"
  | "accept_risk"
  | "release"
  | "renew"
  | "repair"
  | "wait";

export interface ExecutionClaimRecord {
  claim_id: string;
  board_id: string;
  goal_id: string;
  actor_id: string;
  role: ExecutionClaimRole;
  contract_revision: number;
  action_kind: ExecutionActionKind | null;
  action_target_id: string | null;
  state: ExecutionClaimState;
  capabilities: string[];
  goal_mode_attestation: boolean;
  resolved_policy: GoalPolicy;
  claimed_at: string;
  expires_at: string;
  renewed_at: string | null;
  released_at: string | null;
  release_reason: string | null;
}

export interface ExecutionRunRecord {
  run_id: string;
  board_id: string;
  goal_id: string;
  claim_id: string;
  actor_id: string;
  role: ExecutionClaimRole;
  state: ExecutionRunState;
  block_reason: string | null;
  output_refs: string[];
  discovery_refs: string[];
  started_at: string;
  ended_at: string | null;
}

export interface AuthorizedExecutionClaimInput {
  board_id: string;
  goal_id: string;
  actor_id: string;
  role: ExecutionClaimRole;
  contract_revision: number;
  action_id?: string | null;
  action_kind: ExecutionActionKind | null;
  action_target_id: string | null;
  capabilities: string[];
  goal_mode_attestation: boolean;
  resolved_policy: GoalPolicy;
  lease_seconds: number;
  reason: string;
}

export interface RenewExecutionClaimInput {
  board_id: string;
  claim_id: string;
  actor_id: string;
  lease_seconds?: number;
}

export interface EndExecutionClaimInput {
  board_id: string;
  claim_id: string;
  actor_id: string;
  reason: string;
  active_run_reason?: string;
}

export interface StartExecutionRunInput {
  board_id: string;
  claim_id: string;
  actor_id: string;
}

export interface ReportExecutionRunInput {
  board_id: string;
  run_id: string;
  actor_id: string;
  state: ExecutionRunState;
  block_reason?: string | null;
  output_refs?: string[];
  discovery_refs?: string[];
}

export interface ExecutionClaimEndResult {
  claim: ExecutionClaimRecord;
  abandoned_run_ids: string[];
  observed_event_cursor: number;
}

export interface ExecutionRunReportResult {
  run: ExecutionRunRecord;
  released_claim: ExecutionClaimRecord | null;
  observed_event_cursor: number;
}

export interface ExecutionRunWithClaim {
  run: ExecutionRunRecord;
  claim: ExecutionClaimRecord;
}

export interface ExecutionQueryApi {
  activeClaimCount(boardId: string, at: string): number;
  nonterminalRunCount(boardId: string): number;
  activeRunIdsForGoal(boardId: string, goalId: string): string[];
  listClaimsForGoal(boardId: string, goalId: string): ExecutionClaimRecord[];
  latestCompletedWorkRunEventSeq(boardId: string, goalId: string): number;
  latestRunForGoal(boardId: string, goalId: string, roles?: readonly ExecutionRunRecord["role"][]): ExecutionRunRecord | null;
  latestClaimForGoal(boardId: string, goalId: string, roles?: readonly ExecutionClaimRecord["role"][]): ExecutionClaimRecord | null;
  latestActiveRunForClaim(claimId: string): ExecutionRunRecord | null;
  activeClaimIdsForGoal(boardId: string, goalId: string, at?: string): string[];
  listLifecycleEvents(boardId: string): import("../platform/storage.js").StoredModuleEvent[];
  getClaim(boardId: string, claimId: string): ExecutionClaimRecord | null;
  getRun(boardId: string, runId: string): ExecutionRunRecord | null;
  getRunWithClaim(boardId: string, runId: string): ExecutionRunWithClaim | null;
  listClaims(boardId: string): ExecutionClaimRecord[];
  listRuns(boardId: string): ExecutionRunRecord[];
  listNonterminalRuns(boardId: string): ExecutionRunRecord[];
}

export interface ExecutionCommandApi {
  completeRunForRevalidation(boardId: string, runId: string, actorId: string): void;
  /** Application has authorized the Review; close its Run in the shared transaction. */
  completeReviewedRun(runId: string, at: string): ExecutionRunRecord | null;
  transitionGoalContractRevision(input: GoalRevisionDependentTransition): void;
  /** Internal close-out after application reconciliation, inside its existing transaction. */
  releaseClaimForLifecycleFacts(boardId: string, claimId: string, actorId: string, at: string, reason: string): number;
  completeRunForProposal(boardId: string, runId: string, proposalId: string, actorId: string, at: string): number;
  createAuthorizedClaim(input: AuthorizedExecutionClaimInput): ExecutionClaimRecord;
  renewClaim(input: RenewExecutionClaimInput): ExecutionClaimRecord;
  releaseClaim(input: EndExecutionClaimInput): ExecutionClaimEndResult;
  revokeClaim(input: EndExecutionClaimInput): ExecutionClaimEndResult;
  startRun(input: StartExecutionRunInput): ExecutionRunRecord;
  reportRun(input: ReportExecutionRunInput): ExecutionRunReportResult;
  expirePastClaims(boardId: string, actorId: string): string[];
}

export interface ExecutionApplicationApi {
  query: ExecutionQueryApi;
  commands: ExecutionCommandApi;
}
