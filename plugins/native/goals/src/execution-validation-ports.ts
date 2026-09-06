import type { EvidenceVerificationApplicationApi } from "@adeptify/goalboard-contracts/modules/evidence-verification";
import type { ExecutionApplicationApi } from "@adeptify/goalboard-contracts/modules/execution";
import type { GovernanceApplicationApi } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalPolicy } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsLifecycleApi } from "@adeptify/goalboard-contracts/modules/goals";

import type { ActionTransitionReceipt, GoalAction, GoalWorkStateView } from "./execution-validation-contract.js";
import type { BoardSnapshot } from "./goal-entry-contract.js";
import type { ExecutionClaimRole as ClaimRole, ExecutionRunRecord as RunRecord } from "@adeptify/goalboard-contracts/modules/execution";
import type { GoalLifecycleReason as DecisionReason, GoalRecord, ImpactBindingRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ReviewRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";

export interface ExecutionValidationEvaluationInput {
  boardId: string;
  goalId: string;
  actorId: string;
  role: ClaimRole;
  capabilities: string[];
  goalModeAttestation: boolean;
  strengthenPolicy?: Partial<GoalPolicy>;
  now: string;
  snapshot?: BoardSnapshot;
}

export interface ExecutionValidationEvaluation {
  goal: GoalRecord | null;
  reasons: DecisionReason[];
  policy: GoalPolicy;
  surfaces: ImpactBindingRecord[];
}

export interface ExecutionValidationApplicationPorts {
  readonly state: {
    immediate<T>(operation: () => T): T;
    snapshot(boardId: string): BoardSnapshot;
    eventCursor(boardId: string): number;
    appendEvent(input: { eventId: string; boardId: string; actorId: string; type: string; objectType: string; objectId: string; reason: string; payload: unknown; at: string }): number;
  };
  readonly errorType: new (code: string, message: string, details?: Record<string, unknown>) => Error & { code: string; details?: Record<string, unknown> };
  readonly execution: ExecutionApplicationApi;
  readonly evidenceVerification: EvidenceVerificationApplicationApi;
  readonly governance: GovernanceApplicationApi;
  readonly goalsLifecycle: Pick<GoalsLifecycleApi<ActionTransitionReceipt>, "markSatisfiedGoalForEvidenceRevalidation">;
  readonly clock: () => Date;
  evaluate(input: ExecutionValidationEvaluationInput): ExecutionValidationEvaluation;
  claimRoleForAction(candidate: GoalAction, snapshot: BoardSnapshot): ClaimRole;
  ensureReviewObligations(boardId: string, goalId: string, policy: GoalPolicy, at: string): void;
  deriveGoalWorkState(
    boardId: string,
    goal: GoalRecord,
    snapshot: BoardSnapshot,
    now: string,
  ): GoalWorkStateView;
  executorHandoffReasons(workState: GoalWorkStateView): DecisionReason[];
  reconcileLifecycle(
    boardId: string,
    goalId: string,
    actorId: string,
    previousActionToken: string,
    summary: string,
    at: string,
  ): ActionTransitionReceipt;
  hasPostExecutionNeedsChanges(boardId: string, goalId: string): boolean;
  readRun(boardId: string, runId: string): RunRecord;
  readReview(boardId: string, reviewId: string): ReviewRecord;
  requireBoard(boardId: string): void;
  requireGoalOnBoard(boardId: string, goalId: string): GoalRecord;
  replay<T>(boardId: string, actorId: string, operation: string, key: string, hash: string): T | null;
  remember(
    boardId: string,
    actorId: string,
    operation: string,
    key: string,
    hash: string,
    outcome: unknown,
    at: string,
  ): void;
}
