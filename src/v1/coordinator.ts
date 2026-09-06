import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { createContextLedger } from "@adeptify/goalboard-module-context-ledger";
import {
  ArtifactsModule,
  type ArtifactsSqliteDatabase,
} from "@adeptify/goalboard-module-artifacts";
import type {
  ArtifactsApplicationApi,
} from "@adeptify/goalboard-contracts/modules/artifacts";
import {
  EvidenceVerificationModule,
  type EvidenceSqliteDatabase,
} from "@adeptify/goalboard-module-evidence-verification";
import type {
  EvidenceVerificationApplicationApi,
} from "@adeptify/goalboard-contracts/modules/evidence-verification";
import {
  ExecutionModule,
  executionImpactPolicy,
  type ExecutionSqliteDatabase,
} from "@adeptify/goalboard-module-execution";
import type { ExecutionApplicationApi } from "@adeptify/goalboard-contracts/modules/execution";
import {
  GovernanceCollaborationModule,
  type GovernanceSqliteDatabase,
} from "@adeptify/goalboard-module-governance-collaboration";
import type {
  GovernanceApplicationApi,
} from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import {
  GoalsModule,
  recordedContractCoverageBlocksClosure,
  resolveGoalPolicy,
  type GoalsSqliteDatabase,
  type PlanningMethodPack,
  type PlanningMetric,
  type SetRiskStateInput as GoalsSetRiskStateInput,
  type UpdateRiskInput as GoalsUpdateRiskInput,
} from "@adeptify/goalboard-module-goals";
import type { GoalsApplicationApi } from "@adeptify/goalboard-contracts/modules/goals";
import {
  DraftDialogueApplication,
  GoalTreeQueryApplication,
  GoalTreeInputReader,
  GoalTreeSubmissionApplication,
  GoalTreeFactMaterializer,
  GoalTreeGovernanceMaterializer,
  GoalTreeMaterializationConflicts,
  GoalTreeMaterializationApplication,
  LegacyContractProposalValidator,
  LegacyProposalSubmissionApplication,
  LegacyContractDecisionApplication,
  LegacyCandidateDecisionApplication,
  LegacyRewireDecisionApplication,
  GoalTreeCheckApplication,
  GoalTreeDecisionApplication,
  GoalTreeWebDecisionInput,
  LegacyGoalTreeDecisionApplication,
  GoalTreeDecisionFollowup,
  transitionGoalRevisionDependents,
  GoalTreeDecisionNormalizer,
  LifecycleReconciliationApplication,
  compatibleContractRevisions,
  contractRevisionIsCompatible,
  deriveGoalActionProjection,
  requiresParentCompletionConfirmation,
  type ExecutionValidationApplicationApi,
} from "@adeptify/goalboard-plugin-goals";
import { SqliteGoalBoardStore } from "./store.js";
import {
  type ActionTransitionReceipt,
  type AvailableGoal,
  type BoardSnapshot,
  type BlockedAvailableGoal,
  type BlockedAvailableOverview,
  type ClaimRecord,
  type ClaimRole,
  type ContractProposalRecord,

  type DecisionReason,
  type GoalAction,
  type GoalPolicy,
  type GoalContractView,
  type GoalRecord,
  type GoalWorkAction,
  type GoalWorkState,
  type GoalWorkStateView,
  type ImpactBindingRecord,
  type ParallelExecutionSuggestion,
  type ProjectGuidanceView,
  type ReadyGoal,
  type ReviewRecord,
  type RiskRecord,
  type RunRecord,
} from "./types.js";
import { GoalReadApplication } from "./goal-query-application.js";
import { ExecutionValidationApplication } from "./execution-validation-application.js";
import { GoalBoardV1Error } from "./errors.js";
export { GoalBoardV1Error } from "./errors.js";
export type {
  ClaimReleaseHandoff,
  ClaimReleaseResult,
  ReportRunResult as RunReportResult,
} from "@adeptify/goalboard-plugin-goals";



export type ExplainGoalResult = import("@adeptify/goalboard-plugin-goals").ExplainGoalResult;

export function projectGoalLifecycle(
  snapshot: Pick<BoardSnapshot, "claims" | "runs">,
  goalId: string,
  now: string,
): { claims: ClaimRecord[]; runs: RunRecord[] } {
  const expiredClaims = new Map(
    snapshot.claims
      .filter((item) => item.goal_id === goalId && item.state === "active" && item.expires_at <= now)
      .map((item) => [item.claim_id, item]),
  );
  const claims = snapshot.claims
    .filter((item) => item.goal_id === goalId)
    .map((item) => expiredClaims.has(item.claim_id)
      ? {
          ...item,
          state: "expired" as const,
          released_at: item.expires_at,
          release_reason: "领取租约已到期",
        }
      : item);
  const runs = snapshot.runs
    .filter((item) => item.goal_id === goalId)
    .map((item) => {
      const expiredClaim = expiredClaims.get(item.claim_id);
      if (!expiredClaim || !["started", "blocked"].includes(item.state)) return item;
      return {
        ...item,
        state: "abandoned" as const,
        block_reason: "领取租约已到期，当前 Run 自动中断",
        ended_at: expiredClaim.expires_at,
      };
    });
  return { claims, runs };
}

export type ReadyQuery = import("@adeptify/goalboard-plugin-goals").ReadyQuery;
export type ReadyQueryResult = import("@adeptify/goalboard-plugin-goals").ReadyQueryResult;
export type AvailableQuery = import("@adeptify/goalboard-plugin-goals").AvailableQuery;
export type AvailableQueryResult = import("@adeptify/goalboard-plugin-goals").AvailableQueryResult;

export type GoalTreeProposalListQuery = import("@adeptify/goalboard-plugin-goals").GoalTreeProposalListQuery;

export type GoalTreeProposalListResult = import("@adeptify/goalboard-plugin-goals").GoalTreeProposalListResult;

export type GoalTreeProposalCheckResult = import("@adeptify/goalboard-plugin-goals").GoalTreeProposalCheckResult;

export type GoalTreeProposalDecisionResult = import("@adeptify/goalboard-plugin-goals").GoalTreeProposalDecisionResult;

export type GoalTreeSemanticReview = import("@adeptify/goalboard-plugin-goals").GoalTreeSemanticReview;

interface ActorWrite {
  actor_id: string;
  actor_kind?: "user" | "runtime";
  idempotency_key: string;
  reason?: string;
}





interface EvaluationInput {
  boardId: string;
  goalId: string;
  actorId: string;
  role: ClaimRole;
  capabilities: string[];
  goalModeAttestation: boolean;
  strengthenPolicy?: Partial<GoalPolicy>;
  now: string;
  snapshot?: BoardSnapshot;
  snapshot_index?: SnapshotEvaluationIndex;
  policy_rows?: ReturnType<SqliteGoalBoardStore["activePolicyRowsForBoard"]>;
}

interface Evaluation {
  goal: GoalRecord | null;
  reasons: DecisionReason[];
  policy: GoalPolicy;
  surfaces: ImpactBindingRecord[];
}

interface AvailableAction {
  role: ClaimRole | null;
  next_action: GoalWorkAction;
  review_obligation_id: string | null;
}

interface SnapshotEvaluationIndex {
  goals_by_id: Map<string, GoalRecord>;
  dependencies_by_goal: Map<string, GoalRecord[]>;
  risks_by_goal: Map<string, RiskRecord[]>;
  claims_by_goal: Map<string, ClaimRecord[]>;
  impacts_by_goal: Map<string, ImpactBindingRecord[]>;
  pending_contract_proposal_by_goal: Map<string, ContractProposalRecord>;
  pending_review_keys: Set<string>;
  latest_work_run_by_goal: Map<string, RunRecord>;
}

const snapshotEvaluationIndexes = new WeakMap<BoardSnapshot, SnapshotEvaluationIndex>();

function pushSnapshotGroup<T>(target: Map<string, T[]>, key: string, value: T): void {
  const current = target.get(key);
  if (current) current.push(value);
  else target.set(key, [value]);
}

function snapshotEvaluationIndex(snapshot: BoardSnapshot): SnapshotEvaluationIndex {
  const cached = snapshotEvaluationIndexes.get(snapshot);
  if (cached) return cached;
  const goalsById = new Map(snapshot.goals.map((goal) => [goal.goal_id, goal]));
  const dependenciesByGoal = new Map<string, GoalRecord[]>();
  for (const relation of snapshot.relations) {
    if (relation.type !== "depends_on" || relation.state !== "active") continue;
    const dependency = goalsById.get(relation.to_goal_id);
    if (dependency) pushSnapshotGroup(dependenciesByGoal, relation.from_goal_id, dependency);
  }
  for (const dependencies of dependenciesByGoal.values()) {
    dependencies.sort((left, right) => left.goal_id.localeCompare(right.goal_id));
  }
  const risksById = new Map(snapshot.risks.map((risk) => [risk.risk_id, risk]));
  const risksByGoal = new Map<string, RiskRecord[]>();
  for (const link of snapshot.goal_risks) {
    const risk = risksById.get(link.risk_id);
    if (risk && (risk.state === "open" || risk.state === "triggered")) {
      pushSnapshotGroup(risksByGoal, link.goal_id, risk);
    }
  }
  for (const risks of risksByGoal.values()) {
    risks.sort((left, right) => left.risk_id.localeCompare(right.risk_id));
  }
  const claimsByGoal = new Map<string, ClaimRecord[]>();
  for (const claim of snapshot.claims) pushSnapshotGroup(claimsByGoal, claim.goal_id, claim);
  const impactsByGoal = new Map<string, ImpactBindingRecord[]>();
  for (const impact of snapshot.impacts) {
    if (impact.state !== "inactive") pushSnapshotGroup(impactsByGoal, impact.goal_id, impact);
  }
  const pendingContractProposalByGoal = new Map<string, ContractProposalRecord>();
  for (const proposal of snapshot.contract_proposals) {
    if (proposal.state !== "pending") continue;
    const current = pendingContractProposalByGoal.get(proposal.goal_id);
    if (!current || proposal.created_at > current.created_at) {
      pendingContractProposalByGoal.set(proposal.goal_id, proposal);
    }
  }
  const pendingReviewKeys = new Set(
    snapshot.review_obligations
      .filter((obligation) => obligation.state === "pending")
      .map((obligation) => `${obligation.goal_id}\u0000${obligation.role}`),
  );
  const latestWorkRunByGoal = new Map<string, RunRecord>();
  for (const run of snapshot.runs) {
    if (run.role !== "executor" && run.role !== "revalidator") continue;
    const current = latestWorkRunByGoal.get(run.goal_id);
    if (
      !current ||
      run.started_at > current.started_at ||
      (run.started_at === current.started_at && run.run_id > current.run_id)
    ) {
      latestWorkRunByGoal.set(run.goal_id, run);
    }
  }
  const index: SnapshotEvaluationIndex = {
    goals_by_id: goalsById,
    dependencies_by_goal: dependenciesByGoal,
    risks_by_goal: risksByGoal,
    claims_by_goal: claimsByGoal,
    impacts_by_goal: impactsByGoal,
    pending_contract_proposal_by_goal: pendingContractProposalByGoal,
    pending_review_keys: pendingReviewKeys,
    latest_work_run_by_goal: latestWorkRunByGoal,
  };
  snapshotEvaluationIndexes.set(snapshot, index);
  return index;
}


const CLAIMABLE_GOAL_ACTION_KINDS = new Set<GoalAction["kind"]>([
  "clarify",
  "execute",
  "submit_evidence",
  "review",
  "revalidate",
  "mitigate_risk",
]);

function asText(value: unknown): string {
  return value == null ? "" : String(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}





















function reason(
  code: string,
  subjectType: string,
  subjectId: string,
  message: string,
  facts?: Record<string, unknown>,
  remediation?: string,
): DecisionReason {
  return {
    code,
    severity: "blocker",
    subject_type: subjectType,
    subject_id: subjectId,
    message,
    ...(facts ? { facts } : {}),
    ...(remediation ? { remediation } : {}),
  };
}

function compareReasons(left: DecisionReason, right: DecisionReason): number {
  return (
    left.code.localeCompare(right.code) ||
    left.subject_type.localeCompare(right.subject_type) ||
    left.subject_id.localeCompare(right.subject_id)
  );
}

export class GoalBoardCoordinator {
  readonly artifacts: ArtifactsApplicationApi;
  private readonly evidenceVerificationModule: EvidenceVerificationModule;
  private readonly executionModule: ExecutionModule;
  private readonly goalsModule: GoalsModule<ActionTransitionReceipt>;
  readonly evidenceVerification: EvidenceVerificationApplicationApi;
  readonly execution: ExecutionApplicationApi;
  readonly governance: GovernanceApplicationApi;
  readonly goals: GoalsApplicationApi<ActionTransitionReceipt>;
  readonly goalInputs: GoalInputBindingsApi;
  readonly goalQueries: GoalReadApplication;
  readonly executionValidation: ExecutionValidationApplicationApi<BoardSnapshot>;
  readonly draftDialogue: DraftDialogueApplication;
  readonly goalTree: GoalTreeQueryApplication;
  readonly goalTreeInputs: GoalTreeInputReader;
  readonly goalTreeSubmission: GoalTreeSubmissionApplication;
  readonly goalTreeFacts: GoalTreeFactMaterializer;
  readonly goalTreeGovernance: GoalTreeGovernanceMaterializer;
  readonly goalTreeConflicts: GoalTreeMaterializationConflicts;
  readonly goalTreeMaterialization: GoalTreeMaterializationApplication;
  readonly legacyContractValidator: LegacyContractProposalValidator;
  readonly goalTreeDecisionInputs: GoalTreeDecisionNormalizer;
  readonly goalTreeCheck: GoalTreeCheckApplication;
  readonly goalTreeDecision: GoalTreeDecisionApplication;
  readonly goalTreeWebInput: GoalTreeWebDecisionInput;
  readonly legacyContractDecision: LegacyContractDecisionApplication;
  readonly legacyProposalSubmission: LegacyProposalSubmissionApplication;
  readonly legacyCandidateDecision: LegacyCandidateDecisionApplication;
  readonly legacyRewireDecision: LegacyRewireDecisionApplication;
  readonly goalTreeDecisionFollowup: GoalTreeDecisionFollowup;
  readonly lifecycleReconciliation: LifecycleReconciliationApplication;

  constructor(
    readonly store: SqliteGoalBoardStore,
    private readonly clock: () => Date = () => new Date(),
    private readonly personalPlanningMethodPacks: readonly PlanningMethodPack[] = [],
  ) {
    const artifactsModule = new ArtifactsModule({
      db: this.store.db as unknown as ArtifactsSqliteDatabase,
      now: () => this.clock().toISOString(),
      errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
      appendEvent: (input) => this.store.appendEvent(input),
    });
    this.artifacts = {
      query: artifactsModule.query,
      commands: artifactsModule.commands,
    };
    this.executionModule = new ExecutionModule({
      db: this.store.db as unknown as ExecutionSqliteDatabase,
      now: () => this.clock().toISOString(),
      errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
      appendEvent: (input) => this.store.appendEvent(input),
      assertRunStartAllowed: (boardId, goalId) => {
        const goal = this.store.getGoal(goalId);
        if (!goal || goal.board_id !== boardId || goal.validity_state === "invalidated") {
          throw new GoalBoardV1Error("goal.invalidated", "Goal 已失效，不能开始 Run");
        }
        if (goal.trashed_at) {
          throw new GoalBoardV1Error("goal.trashed", "回收站中的 Goal 不能开始 Run");
        }
      },
    });
    this.execution = {
      query: this.executionModule.query,
      commands: this.executionModule.commands,
    };
    this.evidenceVerificationModule = new EvidenceVerificationModule({
      db: this.store.db as unknown as EvidenceSqliteDatabase,
      now: () => this.clock().toISOString(),
      errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
      appendEvent: (input) => this.store.appendEvent(input),
    });
    this.evidenceVerification = {
      query: this.evidenceVerificationModule.query,
      commands: this.evidenceVerificationModule.commands,
    };
    const governanceModule = new GovernanceCollaborationModule({
      db: this.store.db as unknown as GovernanceSqliteDatabase,
      now: () => this.clock().toISOString(),
      errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
    });
    this.governance = {
      clarification: governanceModule.clarification,
      provenance: governanceModule.provenance,
      query: governanceModule.query,
      reviews: governanceModule.reviews,
      records: governanceModule.records,
      decisions: governanceModule.decisions,
    };
    this.goalInputs = new GoalInputBindings(this.store.db, createContextLedger(this.store.db, {
      authorize: (access) => access.scope.kind === "personal",
      now: () => this.clock(),
    }));
    let goalsModule!: GoalsModule<ActionTransitionReceipt>;
    goalsModule = new GoalsModule<ActionTransitionReceipt>(
      this.store.db as unknown as GoalsSqliteDatabase,
      {
        validateRelationGraph: (boardId, input) => {
          const projectedId = "projected:new-relation";
          const snapshot = this.store.snapshot(boardId);
          const issue = goalsModule.planning.validateGraph(
            snapshot.goals,
            goalsModule.planning.projectRelations(snapshot.relations, [{
              action: "add",
              relation_id: projectedId,
              from_goal_id: input.from_goal_id,
              to_goal_id: input.to_goal_id,
              type: input.type,
              reason: input.reason,
            }]),
          ).find((candidate) => candidate.relation_ids.includes(projectedId));
          return issue ? { code: issue.code, message: issue.message } : null;
        },
        clearActiveGoalIfMatches: (boardId, goalId, at) =>
          this.clearActiveGoalIfMatches(boardId, goalId, at),
        blockingWork: (boardId, goalId, now) => ({
          claim_ids: this.executionModule.repository.activeClaimIdsForGoal(boardId, goalId, now),
          run_ids: this.executionModule.repository.activeRunIdsForGoal(boardId, goalId),
        }),
        compoundCoverageBlocksClosure: (boardId, goalId) => {
          const snapshot = this.store.snapshot(boardId);
          const goal = snapshot.goals.find((candidate) => candidate.goal_id === goalId);
          return goal
            ? recordedContractCoverageBlocksClosure(goal, {
                goals: snapshot.goals,
                relations: snapshot.relations,
              })
            : true;
        },
        completionGateReasons: (boardId, goalId) =>
          this.externalCompletionGateReasons(boardId, goalId),
        currentActionProjection: (boardId, goalId) =>
          this.executionValidation.query.getGoalActionProjection({ board_id: boardId, goal_id: goalId }),
        isContractRevisionCompatible: (boardId, goalId, revision) => {
          const goal = this.requireGoalOnBoard(boardId, goalId);
          return contractRevisionIsCompatible(goal, this.store.snapshot(boardId), revision);
        },
        readRevalidationRun: (boardId, runId) => {
          const pair = this.execution.query.getRunWithClaim(boardId, runId);
          return pair ? {
            run_id: pair.run.run_id,
            board_id: pair.run.board_id,
            goal_id: pair.run.goal_id,
            actor_id: pair.run.actor_id,
            role: pair.run.role,
            state: pair.run.state,
            claim_state: pair.claim.state,
            claim_expires_at: pair.claim.expires_at,
            claim_role: pair.claim.role,
            claim_actor_id: pair.claim.actor_id,
            claim_contract_revision: pair.claim.contract_revision,
          } : null;
        },
        completeRevalidationRun: (boardId, _goalId, runId, actorId, _at) => {
          this.executionModule.lifecycle.completeRunForRevalidation(boardId, runId, actorId);
        },
        transitionRevisionDependents: (input) =>
          transitionGoalRevisionDependents({ execution: this.execution.commands, governance: this.governance.reviews }, input),
        supersedePendingContractProposals: (...args) => this.governance.records.supersedePendingContractProposals(...args),
        currentActionToken: (boardId, goalId) =>
          this.executionValidation.query.getGoalActionProjection({ board_id: boardId, goal_id: goalId }).action_token,
        authorizeRiskUpdate: (boardId, input, write, current) =>
          this.authorizeGoalRiskUpdate(boardId, input, write, current),
        authorizeRiskState: (
          boardId,
          input,
          write,
          current,
          linkedGoalIds,
          resolutionBasis,
        ) => this.authorizeGoalRiskState(
          boardId,
          input,
          write,
          current,
          linkedGoalIds,
          resolutionBasis,
        ),
        reconcileLifecycle: (
          boardId,
          goalId,
          actorId,
          previousActionToken,
          summary,
          at,
        ) => this.lifecycleReconciliation.reconcile(
          boardId,
          goalId,
          actorId,
          previousActionToken,
          summary,
          at,
        ),
      },
      {
        now: this.clock,
        errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
        personalPlanningMethodPacks: this.personalPlanningMethodPacks,
      },
    );
    this.goalsModule = goalsModule;
    this.lifecycleReconciliation = new LifecycleReconciliationApplication({
      query: { goals: goalsModule.query, execution: this.execution.query, evidence: this.evidenceVerification.query, governance: this.governance.query },
      goals: goalsModule.lifecycle,
      execution: this.execution.commands,
      errorFactory: (code, message) => new GoalBoardV1Error(code, message),
    });
    this.goals = {
      impacts: goalsModule.impacts,
      commands: goalsModule.commands,
      lifecycle: goalsModule.lifecycle,
      planning: goalsModule.planning,
    };
    this.goalQueries = new GoalReadApplication(goalsModule.query, {
      now: () => this.clock(),
      snapshot: (boardId) => this.store.snapshot(boardId),
      projectGoalLifecycle: (snapshot, goalId, now) =>
        this.projectGoalLifecycle(snapshot, goalId, now),
      workState: (boardId, goal, snapshot, now) =>
        this.deriveGoalWorkState(boardId, goal, snapshot, now),
      actionProjection: (goal, snapshot, now) =>
        deriveGoalActionProjection(goal, snapshot, now),
      goalTreeProposals: (boardId, rootGoalId) =>
        this.goalTree.listGoalTreeProposals({ board_id: boardId, root_goal_id: rootGoalId }).proposals,
    });
    this.executionValidation = new ExecutionValidationApplication({
      store: this.store,
      executionModule: this.executionModule,
      execution: this.execution,
      evidenceVerification: this.evidenceVerification,
      governance: this.governance,
      goalsModule: this.goalsModule,
      clock: this.clock,
      evaluate: (input) => this.evaluate(input),
      claimRoleForAction: (candidate, snapshot) => this.claimRoleForAction(candidate, snapshot),
      ensureReviewObligations: (boardId, goalId, policy, at) =>
        this.ensureReviewObligations(boardId, goalId, policy, at),
      deriveGoalWorkState: (boardId, goal, snapshot, now) =>
        this.deriveGoalWorkState(boardId, goal, snapshot, now),
      executorHandoffReasons: (workState) => this.executorHandoffReasons(workState),
      reconcileLifecycle: (boardId, goalId, actorId, previousActionToken, summary, at) =>
        this.lifecycleReconciliation.reconcile(boardId, goalId, actorId, previousActionToken, summary, at),
      hasPostExecutionNeedsChanges: (boardId, goalId) =>
        this.hasPostExecutionNeedsChanges(boardId, goalId),
      readRun: (runId) => this.readRun(runId),
      readReview: (boardId, reviewId) => this.readReview(boardId, reviewId),
      requireBoard: (boardId) => this.requireBoard(boardId),
      requireGoalOnBoard: (boardId, goalId) => this.requireGoalOnBoard(boardId, goalId),
      replay: <T>(boardId: string, actorId: string, operation: string, key: string, hash: string) =>
        this.replay<T>(boardId, actorId, operation, key, hash),
      remember: (boardId, actorId, operation, key, hash, outcome, at) =>
        this.remember(boardId, actorId, operation, key, hash, outcome, at),
    });
    this.draftDialogue = new DraftDialogueApplication({
      goals: { query: this.goalsModule.query, commands: this.goals.commands },
      governance: this.governance,
      execution: this.execution,
      validation: this.executionValidation,
      clock: this.clock,
      errorFactory: (code, message) => new GoalBoardV1Error(code, message),
    });
    this.goalTree = new GoalTreeQueryApplication({
      goals: this.goalsModule.query,
      governance: this.governance,
      errorFactory: (code, message) => new GoalBoardV1Error(code, message),
    });
    this.goalTreeSubmission = new GoalTreeSubmissionApplication({
      goals: { query: this.goalsModule.query, commands: this.goals.commands, planning: this.goals.planning },
      governance: this.governance, execution: this.execution, query: this.goalTree,
      lifecycle: this.lifecycleReconciliation, clock: this.clock,
      errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
    });
    this.goalTreeInputs = new GoalTreeInputReader({ query: this.goalsModule.query, commands: this.goals.commands,
      errorFactory: (code, message) => new GoalBoardV1Error(code, message) });
    this.goalTreeFacts = new GoalTreeFactMaterializer({ ...this.goals, query: this.goalsModule.query },
      this.governance, this.goalTreeInputs, (code, message, details) => new GoalBoardV1Error(code, message, details));
    this.goalTreeGovernance = new GoalTreeGovernanceMaterializer(this.governance,
      { query: this.goalsModule.query, planning: this.goals.planning }, this.goalTreeInputs,
      this.goalTreeFacts, (code, message) => new GoalBoardV1Error(code, message));
    this.goalTreeConflicts = new GoalTreeMaterializationConflicts({ query: this.goalsModule.query, planning: this.goals.planning },
      this.governance, this.goalTreeInputs);
    this.legacyContractValidator = new LegacyContractProposalValidator({
      goals: { query: this.goalsModule.query, commands: this.goals.commands }, governance: this.governance,
      errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
    });
    this.legacyProposalSubmission = new LegacyProposalSubmissionApplication({
      goals: { ...this.goals, query: this.goalsModule.query }, governance: this.governance, execution: this.execution.query,
      inputs: this.goalTreeInputs, validator: this.legacyContractValidator, clock: this.clock,
      errorFactory: (code, message) => new GoalBoardV1Error(code, message),
    });
    this.legacyRewireDecision = new LegacyRewireDecisionApplication({
      goals: { ...this.goals, query: this.goalsModule.query }, governance: this.governance,
      clock: this.clock, errorFactory: (code, message) => new GoalBoardV1Error(code, message),
    });
    this.legacyCandidateDecision = new LegacyCandidateDecisionApplication({
      goals: this.goals, governance: this.governance, execution: this.execution.query, inputs: this.goalTreeInputs,
      clock: this.clock, errorFactory: (code, message) => new GoalBoardV1Error(code, message),
    });
    this.legacyContractDecision = new LegacyContractDecisionApplication({
      goals: { ...this.goals, query: this.goalsModule.query }, governance: this.governance,
      validator: this.legacyContractValidator, clock: this.clock, errorFactory: (code, message) => new GoalBoardV1Error(code, message),
    });
    this.goalTreeMaterialization = new GoalTreeMaterializationApplication({
      goals: this.goalsModule.query, transactions: this.governance.decisions, facts: this.goalTreeFacts,
      governance: this.goalTreeGovernance, conflicts: this.goalTreeConflicts,
      isDomainError: (error): error is GoalBoardV1Error => error instanceof GoalBoardV1Error,
    });
    this.goalTreeDecisionInputs = new GoalTreeDecisionNormalizer(this.governance.provenance,
      (code, message) => new GoalBoardV1Error(code, message));
    this.goalTreeDecisionFollowup = new GoalTreeDecisionFollowup({
      goals: { query: this.goalsModule.query, planning: this.goals.planning }, governance: this.governance,
      query: this.goalTree, inputs: this.goalTreeInputs, errorFactory: (code, message) => new GoalBoardV1Error(code, message),
    });
    const legacyGoalTreeDecision = new LegacyGoalTreeDecisionApplication({
      query: this.goalTree, normalizer: this.goalTreeDecisionInputs, followup: this.goalTreeDecisionFollowup,
      contract: this.legacyContractDecision, candidate: this.legacyCandidateDecision, rewire: this.legacyRewireDecision,
      errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
    });
    this.goalTreeDecision = new GoalTreeDecisionApplication({
      goals: { ...this.goals, query: this.goalsModule.query }, governance: this.governance, query: this.goalTree,
      inputs: this.goalTreeInputs, normalizer: this.goalTreeDecisionInputs, conflicts: this.goalTreeConflicts,
      materialization: this.goalTreeMaterialization, followup: this.goalTreeDecisionFollowup, validation: this.executionValidation,
      legacy: legacyGoalTreeDecision, clock: this.clock,
      errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
      isDomainError: (error): error is GoalBoardV1Error => error instanceof GoalBoardV1Error,
    });
    this.goalTreeWebInput = new GoalTreeWebDecisionInput({ query: this.goalTree, goals: this.goalsModule.query });
    this.goalTreeCheck = new GoalTreeCheckApplication({
      goals: { query: this.goalsModule.query, planning: this.goals.planning }, governance: this.governance,
      query: this.goalTree, materialization: this.goalTreeMaterialization, legacy: this.legacyContractValidator, clock: this.clock,
      errorFactory: (code, message, details) => new GoalBoardV1Error(code, message, details),
      isDomainError: (error): error is GoalBoardV1Error => error instanceof GoalBoardV1Error,
    });
  }

  projectGoalLifecycle(
    snapshot: Pick<BoardSnapshot, "claims" | "runs">,
    goalId: string,
    now = this.clock().toISOString(),
  ): { claims: ClaimRecord[]; runs: RunRecord[] } {
    return projectGoalLifecycle(snapshot, goalId, now);
  }

  initializeBoard(input: {
    board_id: string;
    title: string;
    actor_id: string;
    idempotency_key: string;
  }): { board_id: string; replayed: boolean; observed_event_cursor: number } {
    if (!input.board_id.trim() || !input.title.trim()) {
      throw new GoalBoardV1Error("request.invalid", "Board ID 和名称不能为空");
    }
    const hash = requestHash({ board_id: input.board_id, title: input.title });
    return this.store.immediate(() => {
      const replay = this.replay<{ board_id: string; observed_event_cursor: number }>(
        input.board_id,
        input.actor_id,
        "initialize_board",
        input.idempotency_key,
        hash,
      );
      if (replay) return { ...replay, replayed: true };

      const exists = this.store.db
        .prepare("SELECT board_id FROM boards WHERE board_id = ?")
        .get(input.board_id);
      if (exists) throw new GoalBoardV1Error("board.exists", `Board 已存在: ${input.board_id}`);

      const at = this.clock().toISOString();
      this.store.db
        .prepare(
          "INSERT INTO boards (board_id, title, active_goal_id, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)",
        )
        .run(input.board_id, input.title.trim(), at, at);
      let cursor = this.store.appendEvent({
        eventId: randomUUID(),
        boardId: input.board_id,
        actorId: input.actor_id,
        type: "board.created",
        objectType: "board",
        objectId: input.board_id,
        reason: "创建 GoalBoard 真相源",
        payload: { title: input.title.trim() },
        at,
      });
      const outcome = { board_id: input.board_id, observed_event_cursor: cursor };
      this.remember(
        input.board_id,
        input.actor_id,
        "initialize_board",
        input.idempotency_key,
        hash,
        outcome,
        at,
      );
      return { ...outcome, replayed: false };
    });
  }

  readProjectGuidance(boardId: string): ProjectGuidanceView {
    return this.goalQueries.readProjectGuidance(boardId);
  }
  private authorizeGoalRiskUpdate(
    boardId: string,
    input: GoalsUpdateRiskInput,
    write: ActorWrite,
    _current: RiskRecord,
  ): void {
    const actionContextValues = [
      input.action_goal_id,
      input.contract_revision,
      input.action_id,
      input.action_token,
    ];
    if (!actionContextValues.some((value) => value != null)) return;
    const goal = this.requireGoalOnBoard(boardId, input.action_goal_id!);
    const projection = this.executionValidation.query.getGoalActionProjection({ board_id: boardId, goal_id: goal.goal_id });
    if (!contractRevisionIsCompatible(goal, this.store.snapshot(boardId), input.contract_revision!)) {
      throw new GoalBoardV1Error(
        "contract.revision_stale",
        "Risk 决定属于旧 Contract revision。",
        { current_contract_revision: goal.current_contract_revision, projection },
      );
    }
    if (input.action_token !== projection.action_token) {
      throw new GoalBoardV1Error(
        "action.token_stale",
        "处理 Risk 前 Goal 已变化；旧决定未生效。",
        { projection },
      );
    }
    if (!projection.actions.some((action) =>
      action.action_id === input.action_id &&
      action.actor === "user" &&
      action.kind === "accept_risk" &&
      action.target_type === "risk" &&
      action.target_id === input.risk_id
    )) {
      throw new GoalBoardV1Error(
        "action.not_available",
        "当前用户动作不再指向这条 Risk。",
        { projection },
      );
    }
    if (write.actor_kind !== "user") {
      throw new GoalBoardV1Error(
        "risk.user_acceptance_required",
        "只有用户可以决定是否接受这条 Risk。",
      );
    }
  }

  private authorizeGoalRiskState(
    boardId: string,
    input: GoalsSetRiskStateInput,
    write: ActorWrite,
    _current: RiskRecord,
    linkedGoalIds: string[],
    resolutionBasis: RiskRecord["resolution_basis"],
  ): void {
    const snapshot = this.store.snapshot(boardId);
    const authorizationGoalIds = input.goal_id ? [input.goal_id] : linkedGoalIds;
    for (const goalId of linkedGoalIds) {
      const goal = snapshot.goals.find((candidate) => candidate.goal_id === goalId)!;
      const projection = deriveGoalActionProjection(goal, snapshot, this.clock().toISOString());
      const isActionGoal = goalId === input.goal_id;
      if (
        isActionGoal &&
        !contractRevisionIsCompatible(goal, snapshot, input.contract_revision!)
      ) {
        throw new GoalBoardV1Error(
          "contract.revision_stale",
          "Risk 写入属于旧 Contract revision。",
          { current_contract_revision: goal.current_contract_revision, projection },
        );
      }
      if (isActionGoal && input.action_token !== projection.action_token) {
        throw new GoalBoardV1Error(
          "action.token_stale",
          "处理 Risk 前 Goal 已变化；旧写入未生效。",
          { projection },
        );
      }
      if (isActionGoal && !projection.actions.some((candidate) =>
        candidate.action_id === input.action_id &&
        candidate.target_type === "risk" &&
        candidate.target_id === input.risk_id &&
        candidate.actor === (write.actor_kind === "user" ? "user" : "runtime") &&
        candidate.kind === (write.actor_kind === "user" ? "accept_risk" : "mitigate_risk")
      )) {
        throw new GoalBoardV1Error(
          "action.not_available",
          "当前动作已经变化或不属于这个操作者。",
          { projection },
        );
      }
    }
    if (
      input.state === "resolved" &&
      (write.actor_kind != null ||
        input.action_token != null ||
        input.contract_revision != null ||
        input.goal_id != null)
    ) {
      const evidenceById = new Map(
        snapshot.evidence.map((evidence) => [evidence.evidence_id, evidence]),
      );
      for (const evidenceRef of resolutionBasis?.evidence_refs ?? []) {
        const evidence = evidenceById.get(evidenceRef);
        const goal = evidence
          ? snapshot.goals.find((candidate) => candidate.goal_id === evidence.goal_id)
          : null;
        if (
          !evidence ||
          !goal ||
          !linkedGoalIds.includes(evidence.goal_id) ||
          !contractRevisionIsCompatible(goal, snapshot, evidence.contract_revision) ||
          evidence.lifecycle_state !== "effective" ||
          evidence.historical_unmapped
        ) {
          throw new GoalBoardV1Error(
            "risk.evidence_not_current",
            "Risk resolved 只能引用关联 Goal 当前 Contract revision 的有效 Evidence。",
            { evidence_id: evidenceRef },
          );
        }
      }
    }
    if (write.actor_kind === "runtime") {
      const authorized = authorizationGoalIds.every((goalId) => {
        const goal = snapshot.goals.find((candidate) => candidate.goal_id === goalId)!;
        const claims = snapshot.claims
          .filter((claim) =>
            claim.goal_id === goalId &&
            claim.actor_id === write.actor_id &&
            contractRevisionIsCompatible(goal, snapshot, claim.contract_revision)
          )
          .sort((left, right) => left.claimed_at.localeCompare(right.claimed_at));
        const claim = claims.at(-1);
        if (!claim) return false;
        if (
          claim.state === "active" &&
          claim.action_kind === "mitigate_risk" &&
          claim.action_target_id === input.risk_id
        ) {
          return true;
        }
        const run = snapshot.runs
          .filter((candidate) => candidate.claim_id === claim.claim_id)
          .sort((left, right) => left.started_at.localeCompare(right.started_at))
          .at(-1);
        const newerClaim = snapshot.claims.some((candidate) =>
          candidate.goal_id === goalId && candidate.claimed_at > claim.claimed_at
        );
        return run?.state === "completed" && !newerClaim;
      });
      if (!authorized) {
        throw new GoalBoardV1Error(
          "risk.runtime_authority_missing",
          "Runtime 没有当前 Risk action，也不是刚完成同一 revision 的原执行者。",
        );
      }
    }
  }
  private clearActiveGoalIfMatches(boardId: string, goalId: string, at: string): boolean {
    return this.store.db
      .prepare(`
        UPDATE boards
        SET active_goal_id = NULL, updated_at = ?
        WHERE board_id = ? AND active_goal_id = ?
      `)
      .run(at, boardId, goalId).changes > 0;
  }

  setActiveGoal(
    boardId: string,
    input: { goal_id: string; reason: string },
    write: ActorWrite,
  ): { active_goal_id: string; replayed: boolean; observed_event_cursor: number } {
    const hash = requestHash({ board_id: boardId, ...input });
    return this.store.immediate(() => {
      const replay = this.replay<{ active_goal_id: string; observed_event_cursor: number }>(
        boardId,
        write.actor_id,
        "set_active_goal",
        write.idempotency_key,
        hash,
      );
      if (replay) return { ...replay, replayed: true };
      const goal = this.requireGoalOnBoard(boardId, input.goal_id);
      if (goal.definition_state !== "accepted") {
        throw new GoalBoardV1Error("goal.not_accepted", "只有已接受的 Goal 可以成为当前产品目标");
      }
      if (goal.trashed_at) {
        throw new GoalBoardV1Error("goal.trashed", "回收站中的 Goal 需要先恢复，才能设为当前产品目标");
      }
      if (goal.archived_at) {
        throw new GoalBoardV1Error("goal.archived", "已归档 Goal 需要先恢复，才能设为当前产品目标");
      }
      if (goal.fulfillment_state === "satisfied") {
        throw new GoalBoardV1Error("goal.already_satisfied", "已完成的 Goal 不能成为当前进行中的 Goal");
      }
      const now = this.clock().toISOString();
      this.store.db
        .prepare("UPDATE boards SET active_goal_id = ?, updated_at = ? WHERE board_id = ?")
        .run(input.goal_id, now, boardId);
      const cursor = this.store.appendEvent({
        eventId: randomUUID(),
        boardId,
        actorId: write.actor_id,
        type: "board.active_goal_changed",
        objectType: "goal",
        objectId: input.goal_id,
        reason: input.reason,
        payload: {},
        at: now,
      });
      const outcome = { active_goal_id: input.goal_id, observed_event_cursor: cursor };
      this.remember(boardId, write.actor_id, "set_active_goal", write.idempotency_key, hash, outcome, now);
      return { ...outcome, replayed: false };
    });
  }

  /** A dedicated read path for a later trash UI/MCP; ordinary work lists exclude these Goals. */
  listTrashedGoals(boardId: string): GoalRecord[] {
    return this.goalQueries.listTrashedGoals(boardId);
  }


  queryReady(input: ReadyQuery): ReadyQueryResult {
    this.requireBoard(input.board_id);
    const now = this.clock().toISOString();
    const role = input.role ?? "executor";
    const ready: ReadyGoal[] = [];
    for (const goal of this.goalsModule.query.listGoals(input.board_id)) {
      const evaluation = this.evaluate({
        boardId: input.board_id,
        goalId: goal.goal_id,
        actorId: input.actor_id,
        role,
        capabilities: input.capabilities ?? [],
        goalModeAttestation: input.goal_mode_attestation ?? false,
        now,
      });
      if (evaluation.reasons.length > 0 || !evaluation.goal) continue;
      ready.push({
        goal: evaluation.goal,
        role,
        why_now:
          role === "clarifier"
            ? "Goal 仍需要补齐定义、拆分或验收，现在可以开始澄清"
            : role === "revalidator"
              ? "Goal 的前提发生过变化，需要重新核对 Contract、依赖和风险后恢复可信状态"
            : "Goal 已定义清楚，依赖、风险、影响面和领取策略当前都允许开始",
        priority_hint: evaluation.goal.priority,
        dependency_summary: this.dependencySummary(input.board_id, goal.goal_id),
        risk_summary: this.riskSummary(goal.board_id, goal.goal_id),
        resolved_policy: evaluation.policy,
        relevant_surfaces: evaluation.surfaces,
      });
    }
    ready.sort(
      (left, right) =>
        right.priority_hint - left.priority_hint || left.goal.goal_id.localeCompare(right.goal.goal_id),
    );
    return { observed_event_cursor: this.store.eventCursor(input.board_id), ready };
  }

  /**
   * Returns every action this Runtime may take now. Unlike the legacy
   * role-scoped `queryReady`, this is the Runtime's menu, not a dispatcher.
   */
  queryAvailable(input: AvailableQuery): AvailableQueryResult {
    this.requireBoard(input.board_id);
    const now = this.clock().toISOString();
    const snapshot = this.store.snapshot(input.board_id);
    const snapshotIndex = snapshotEvaluationIndex(snapshot);
    const policyRows = this.store.activePolicyRowsForBoard(input.board_id);
    const metrics = this.goalsModule.planning.metrics(snapshot.goals, snapshot.relations);
    const available: AvailableGoal[] = [];
    const blocked: BlockedAvailableGoal[] = [];
    const blockedOverview: BlockedAvailableOverview[] = [];
    for (const goal of snapshot.goals) {
      const actionProjection = deriveGoalActionProjection(goal, snapshot, now);
      const workState = this.deriveGoalWorkState(input.board_id, goal, snapshot, now);
      const runtimeReadyActions = actionProjection.actions.filter((candidate) =>
        candidate.actor === "runtime" &&
        candidate.status === "ready" &&
        CLAIMABLE_GOAL_ACTION_KINDS.has(candidate.kind)
      );
      if (
        (workState.work_state === "completion_blocked" && runtimeReadyActions.length === 0) ||
        workState.work_state === "waiting_for_human" ||
        workState.work_state === "replaced"
      ) {
        blocked.push({
          goal,
          work_state: workState.work_state,
          next_action: null,
          reasons: workState.work_state === "completion_blocked"
            ? this.executorHandoffReasons(workState)
            : workState.reasons,
          priority_hint: goal.priority,
          risk_summary: this.riskSummary(goal.board_id, goal.goal_id, snapshotIndex),
        });
      }
      if (
        workState.work_state === "clarification_blocked" ||
        workState.work_state === "waiting_children" ||
        workState.work_state === "execution_blocked" ||
        workState.work_state === "review_blocked" ||
        workState.work_state === "revalidation_blocked" ||
        workState.work_state === "invalidated"
      ) {
        blockedOverview.push({
          goal,
          work_state: workState.work_state,
          next_action: "explain",
          reasons: workState.reasons.map(({ code, message }) => ({ code, message })),
          priority_hint: goal.priority,
        });
      }
      const requiresParentConfirmation =
        workState.work_state === "clarification_pending" &&
        requiresParentCompletionConfirmation(goal, snapshot);
      for (const projectedAction of runtimeReadyActions) {
        const role = this.claimRoleForAction(projectedAction, snapshot);
        const legacyNextAction: GoalWorkAction = projectedAction.kind === "clarify"
          ? "clarify"
          : projectedAction.kind === "review"
            ? "review"
            : projectedAction.kind === "revalidate"
              ? "revalidate"
              : "execute";
        const evaluation = this.evaluate({
          boardId: input.board_id,
          goalId: goal.goal_id,
          actorId: input.actor_id,
          role,
          capabilities: input.capabilities ?? [],
          goalModeAttestation: input.goal_mode_attestation ?? false,
          now,
          snapshot,
          snapshot_index: snapshotIndex,
          policy_rows: policyRows,
        });
        if (projectedAction.kind === "mitigate_risk") {
          evaluation.reasons = evaluation.reasons.filter((item) =>
            !(item.subject_type === "risk" && item.subject_id === projectedAction.target_id)
          );
        }
        if (evaluation.reasons.length > 0 || !evaluation.goal) continue;
        available.push({
          goal: evaluation.goal,
          action_id: projectedAction.action_id,
          action_token: actionProjection.action_token,
          action_kind: projectedAction.kind,
          action_target_type: projectedAction.target_type,
          action_target_id: projectedAction.target_id,
          role,
          work_state: workState.work_state,
          next_action: legacyNextAction,
          review_obligation_id: projectedAction.kind === "review" ? projectedAction.target_id : null,
          requires_parent_confirmation: requiresParentConfirmation,
          why_now: requiresParentConfirmation
            ? "现有子 Goal 都已完成，但父 Goal 的拆分还没有确认结束；先和用户确认是否已经覆盖整个父目标，再决定收口或继续补充子 Goal"
            : projectedAction.reasons[0]?.message ?? (
              projectedAction.kind === "submit_evidence"
                ? "执行已经完成，当前 Runtime 可以补齐完成依据"
                : projectedAction.kind === "mitigate_risk"
                  ? "这项风险可以由当前 Runtime 按既定方案处理"
                  : this.workActionMessage(legacyNextAction)
            ),
          priority_hint: evaluation.goal.priority,
          dependency_summary: this.dependencySummary(input.board_id, goal.goal_id, snapshotIndex),
          risk_summary: this.riskSummary(goal.board_id, goal.goal_id, snapshotIndex),
          resolved_policy: evaluation.policy,
          relevant_surfaces: evaluation.surfaces,
          planning: {
            topological_level: metrics.get(goal.goal_id)?.topological_level ?? 0,
            unlock_count: metrics.get(goal.goal_id)?.unlock_count ?? 0,
            longest_downstream_chain: metrics.get(goal.goal_id)?.longest_downstream_chain ?? 0,
            rationale: this.planningRationale(metrics.get(goal.goal_id)),
          },
        });
      }
    }
    available.sort(
      (left, right) =>
        Number(right.requires_parent_confirmation) - Number(left.requires_parent_confirmation) ||
        right.planning.unlock_count - left.planning.unlock_count ||
        right.planning.longest_downstream_chain - left.planning.longest_downstream_chain ||
        left.planning.topological_level - right.planning.topological_level ||
        right.priority_hint - left.priority_hint ||
        left.goal.goal_id.localeCompare(right.goal.goal_id) ||
        (left.role ?? "").localeCompare(right.role ?? ""),
    );
    blocked.sort(
      (left, right) =>
        right.priority_hint - left.priority_hint || left.goal.goal_id.localeCompare(right.goal.goal_id),
    );
    blockedOverview.sort(
      (left, right) =>
        right.priority_hint - left.priority_hint || left.goal.goal_id.localeCompare(right.goal.goal_id),
    );
    return {
      observed_event_cursor: snapshot.cursor,
      available,
      blocked,
      blocked_overview: blockedOverview,
      parallel_suggestion: this.parallelExecutionSuggestion(available),
    };
  }




  /** Read the canonical effective policy without running a full readiness evaluation. */
  getResolvedGoalPolicy(input: { board_id: string; goal_id: string }): GoalPolicy {
    return this.goalQueries.getResolvedGoalPolicy(input);
  }

  explainGoal(input: ReadyQuery & { goal_id: string }): ExplainGoalResult {
    this.requireBoard(input.board_id);
    const role = input.role ?? "executor";
    const evaluation = this.evaluate({
      boardId: input.board_id,
      goalId: input.goal_id,
      actorId: input.actor_id,
      role,
      capabilities: input.capabilities ?? [],
      goalModeAttestation: input.goal_mode_attestation ?? false,
      now: this.clock().toISOString(),
    });
    const workState = this.executionValidation.query.getGoalWorkState({ board_id: input.board_id, goal_id: input.goal_id });
    const completionReasons = role === "executor"
      ? this.executorHandoffReasons(workState)
      : workState.work_state === "waiting_for_human" &&
          (role === "self_verifier" || role === "cross_reviewer" || role === "adversarial_reviewer")
        ? workState.reasons
        : [];
    const reasons = [...evaluation.reasons, ...completionReasons]
      .filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) =>
              candidate.code === item.code &&
              candidate.subject_type === item.subject_type &&
              candidate.subject_id === item.subject_id,
          ) === index,
      )
      .sort(compareReasons);
    return {
      goal: evaluation.goal,
      role,
      ready: reasons.length === 0 && evaluation.goal !== null,
      observed_event_cursor: this.store.eventCursor(input.board_id),
      reasons,
      resolved_policy: evaluation.policy,
      relevant_surfaces: evaluation.surfaces,
    };
  }

  readGoalContract(boardId: string, goalId: string): GoalContractView {
    return this.goalQueries.readGoalContract(boardId, goalId);
  }

  /**
   * Re-check each native proposal item against its own recorded baseline. A
   * conflict in A never hides or invalidates an unchanged item B.
   */


  /**
   * Applies either an explicitly selected subset or one pristine whole proposal.
   * Subset decisions preserve independent-item conflict handling; whole confirmation
   * is all-or-nothing and rolls the transaction back when any item cannot land.
   */









  private ensureReviewObligations(
    boardId: string,
    goalId: string,
    policy: GoalPolicy,
    at: string,
  ): void {
    const snapshot = this.store.snapshot(boardId);
    const currentGoal = snapshot.goals.find((goal) => goal.goal_id === goalId) ?? null;
    const criteria = currentGoal?.acceptance_criteria ?? [];
    const contractRevision = currentGoal?.current_contract_revision ?? 1;
    const compatibleRevisions = currentGoal
      ? compatibleContractRevisions(currentGoal, snapshot)
      : new Set([contractRevision]);
    const runtimeCriterionIds = criteria
      .filter((criterion) => criterion.decision_method !== "human_decision")
      .map((criterion) => criterion.criterion_id);
    const humanCriterionIds = criteria
      .filter((criterion) => criterion.decision_method === "human_decision")
      .map((criterion) => criterion.criterion_id);
    const allCriterionIds = criteria.map((criterion) => criterion.criterion_id);
    const obligations: Array<{
      role: "self_verifier" | "cross_reviewer" | "adversarial_reviewer" | "human_approver";
      count: number;
      independence: string;
      criterionIds: string[];
    }> = [];
    if (policy.self_verification && runtimeCriterionIds.length > 0) {
      obligations.push({
        role: "self_verifier",
        count: 1,
        independence: "executor_allowed",
        criterionIds: runtimeCriterionIds,
      });
    }
    if (policy.cross_reviewers > 0 && runtimeCriterionIds.length > 0) {
      obligations.push({
        role: "cross_reviewer",
        count: policy.cross_reviewers,
        independence: "actor_must_differ_from_executor",
        criterionIds: runtimeCriterionIds,
      });
    }
    if (policy.adversarial_reviewers > 0 && runtimeCriterionIds.length > 0) {
      obligations.push({
        role: "adversarial_reviewer",
        count: policy.adversarial_reviewers,
        independence: "actor_must_differ_from_executor",
        criterionIds: runtimeCriterionIds,
      });
    }
    if (policy.human_approval || humanCriterionIds.length > 0) {
      obligations.push({
        role: "human_approver",
        count: 1,
        independence: "user_authority",
        criterionIds: policy.human_approval ? allCriterionIds : humanCriterionIds,
      });
    }

    this.governance.reviews.reconcileObligations({
      board_id: boardId,
      goal_id: goalId,
      contract_revision: contractRevision,
      compatible_contract_revisions: [...compatibleRevisions],
      created_at: at,
      desired: obligations.map((obligation) => ({
        role: obligation.role,
        required_count: obligation.count,
        independence_rule: obligation.independence,
        criterion_scope: obligation.criterionIds,
      })),
    });
  }





















  /** Validate the special accepted-parent closure path and reject callers that
   * try to bypass the native same-Goal Contract revision operation. */




















  /**
   * A native proposal can safely retire one legacy Rewire only when both describe
   * the exact same pure relation change set and the canonical graph already
   * reflects every requested relation state. Historical proposal text is kept.
   */



  private readRun(runId: string): RunRecord {
    const run = this.executionModule.repository.getRunById(runId);
    if (!run) throw new Error(`Run 写入后无法读取: ${runId}`);
    return run;
  }

  private readReview(boardId: string, reviewId: string): ReviewRecord {
    const review = this.governance.query.listReviews(boardId)
      .find((item) => item.review_id === reviewId);
    if (!review) throw new Error(`Review 写入后无法读取: ${reviewId}`);
    return review;
  }






  private activeGoalReplacement(
    boardId: string,
    goalId: string,
    snapshot?: ReturnType<SqliteGoalBoardStore["snapshot"]>,
  ): { relation_id: string; replacement_goal_id: string; replacement_goal_title: string } | null {
    if (snapshot) {
      const relation = snapshot.relations
        .filter(
          (item) =>
            item.board_id === boardId &&
            item.to_goal_id === goalId &&
            item.type === "replaces" &&
            item.state === "active",
        )
        .sort(
          (left, right) =>
            right.created_at.localeCompare(left.created_at) ||
            right.relation_id.localeCompare(left.relation_id),
        )[0];
      if (!relation) return null;
      const replacement = snapshot.goals.find((item) => item.goal_id === relation.from_goal_id);
      if (!replacement) return null;
      return {
        relation_id: relation.relation_id,
        replacement_goal_id: replacement.goal_id,
        replacement_goal_title: replacement.title,
      };
    }
    return this.goalsModule.query.activeReplacement(boardId, goalId);
  }

  private goalReplacedReason(
    goalId: string,
    replacement: { relation_id: string; replacement_goal_id: string; replacement_goal_title: string },
  ): DecisionReason {
    return reason(
      "goal.replaced",
      "goal",
      goalId,
      `这条 Goal 已被「${replacement.replacement_goal_title}」替代，不再接受新的 Runtime 工作`,
      replacement,
      "请推进替代 Goal；如果替代关系有误，由用户停用对应的 replaces 关系后再查询 Ready。",
    );
  }

  private deriveGoalWorkState(
    boardId: string,
    goal: GoalRecord,
    snapshot: ReturnType<SqliteGoalBoardStore["snapshot"]>,
    now: string,
  ): GoalWorkStateView {
    const childGoalIds = snapshot.relations
      .filter(
        (relation) =>
          relation.state === "active" &&
          relation.type === "part_of" &&
          relation.to_goal_id === goal.goal_id,
      )
      .map((relation) => relation.from_goal_id)
      .sort();
    const activeClaims = snapshot.claims
      .filter(
        (claim) =>
          claim.goal_id === goal.goal_id &&
          claim.state === "active" &&
          claim.expires_at > now,
      )
      .sort((left, right) => left.claimed_at.localeCompare(right.claimed_at));
    const activeClaimById = new Map(activeClaims.map((claim) => [claim.claim_id, claim]));
    const activeRun = snapshot.runs
      .filter(
        (run) =>
          run.goal_id === goal.goal_id &&
          ["started", "blocked"].includes(run.state) &&
          activeClaimById.has(run.claim_id),
      )
      .sort((left, right) => left.started_at.localeCompare(right.started_at))
      .at(-1) ?? null;
    const activeClaim = activeRun
      ? activeClaimById.get(activeRun.claim_id) ?? null
      : activeClaims.at(-1) ?? null;
    const expiredClaim = snapshot.claims
      .filter(
        (claim) =>
          claim.goal_id === goal.goal_id &&
          claim.state === "active" &&
          claim.expires_at <= now,
      )
      .sort((left, right) => left.claimed_at.localeCompare(right.claimed_at))
      .at(-1) ?? null;
    const expiredRun = expiredClaim
      ? snapshot.runs
          .filter(
            (run) =>
              run.claim_id === expiredClaim.claim_id &&
              ["started", "blocked"].includes(run.state),
          )
          .sort((left, right) => left.started_at.localeCompare(right.started_at))
          .at(-1) ?? null
      : null;
    const leaseRecoveryReason: DecisionReason | null = expiredClaim && expiredRun
      ? {
          code: "lease.expired",
          severity: "info",
          subject_type: "claim",
          subject_id: expiredClaim.claim_id,
          message: "上一轮领取租约已到期，旧 Run 不再具有写权限",
          facts: {
            claim_id: expiredClaim.claim_id,
            run_id: expiredRun.run_id,
            expired_at: expiredClaim.expires_at,
            next_action: "select_goal",
          },
          remediation: "直接重新领取这条 Goal；无需释放旧 Claim，也不要继续报告旧 Run。",
        }
      : null;
    const phaseReasons = (blockingReasons: DecisionReason[]): DecisionReason[] =>
      blockingReasons.length > 0
        ? blockingReasons
        : leaseRecoveryReason
          ? [leaseRecoveryReason]
          : [];
    const latestClaimRun = activeClaim
      ? snapshot.runs
          .filter((run) => run.claim_id === activeClaim.claim_id)
          .sort(
            (left, right) =>
              left.started_at.localeCompare(right.started_at) || left.run_id.localeCompare(right.run_id),
          )
          .at(-1) ?? null
      : null;
    const compatibleRevisions = compatibleContractRevisions(goal, snapshot);
    const pendingReviewObligations = snapshot.review_obligations.filter(
      (obligation) =>
        obligation.goal_id === goal.goal_id &&
        compatibleRevisions.has(obligation.contract_revision) &&
        obligation.state === "pending",
    );
    const pendingReviewRoles = pendingReviewObligations.map((obligation) => obligation.role);
    const reviewReady = this.latestWorkRunState(snapshot, goal) === "completed";
    const activeClaimLease = activeClaim
      ? (() => {
          const remainingSeconds = Math.max(
            0,
            Math.ceil((new Date(activeClaim.expires_at).getTime() - new Date(now).getTime()) / 1000),
          );
          const leaseStartedAt = activeClaim.renewed_at ?? activeClaim.claimed_at;
          const currentLeaseSeconds = Math.max(
            1,
            Math.ceil(
              (new Date(activeClaim.expires_at).getTime() - new Date(leaseStartedAt).getTime()) / 1000,
            ),
          );
          const renewalWindowSeconds = Math.max(
            1,
            Math.min(300, Math.ceil(currentLeaseSeconds / 3)),
          );
          const renewRecommended = remainingSeconds <= renewalWindowSeconds;
          return {
            remaining_seconds: remainingSeconds,
            renewal_window_seconds: renewalWindowSeconds,
            renew_recommended: renewRecommended,
            next_action: renewRecommended ? "renew_claim" as const : null,
          };
        })()
      : null;
    const base = {
      goal_id: goal.goal_id,
      active_claim: activeClaim,
      active_claim_lease: activeClaimLease,
      active_run: activeRun,
      pending_review_roles: pendingReviewRoles,
      child_goal_ids: childGoalIds,
    };

    if (goal.trashed_at) {
      return { ...base, work_state: "trashed", next_action: null, reasons: [] };
    }
    if (goal.archived_at) {
      return { ...base, work_state: "archived", next_action: null, reasons: [] };
    }
    const replacement = this.activeGoalReplacement(boardId, goal.goal_id, snapshot);
    if (replacement) {
      return {
        ...base,
        work_state: "replaced",
        next_action: null,
        reasons: [this.goalReplacedReason(goal.goal_id, replacement)],
      };
    }
    if (goal.validity_state === "invalidated") {
      return {
        ...base,
        work_state: "invalidated",
        next_action: null,
        reasons: [reason("goal.invalidated", "goal", goal.goal_id, "Goal 已失效，需要重新澄清或替换")],
      };
    }
    if (
      goal.decomposition_state === "closed_compound" &&
      recordedContractCoverageBlocksClosure(goal, {
        goals: snapshot.goals,
        relations: snapshot.relations,
      })
    ) {
      return {
        ...base,
        work_state: "clarification_blocked",
        next_action: "clarify",
        reasons: [
          reason(
            "goal.contract_coverage_incomplete",
            "goal",
            goal.goal_id,
            "父 Goal 记录的承诺结果或完成条件尚未被子 Contract 完整覆盖",
            undefined,
            "继续澄清父子 Contract 映射；部分覆盖、尚未覆盖或仍需父级集成时不能关闭父 Goal",
          ),
        ],
      };
    }
    if (
      goal.decomposition_state !== "closed_compound" &&
      goal.validity_state === "valid" &&
      goal.fulfillment_state === "satisfied"
    ) {
      return { ...base, work_state: "satisfied", next_action: null, reasons: [] };
    }
    if (activeClaim && !activeRun) {
      return this.workStateWithoutRun(base, activeClaim, latestClaimRun);
    }

    const needsClarification = this.goalNeedsClarification(goal);
    if (needsClarification) {
      if (activeRun?.role === "clarifier") return this.workStateFromRun(base, activeRun);
      const reasons = this.workStatePhaseReasons(boardId, goal.goal_id, "clarifier", now, snapshot);
      return {
        ...base,
        work_state: reasons.length > 0 ? "clarification_blocked" : "clarification_pending",
        next_action: "clarify",
        reasons: phaseReasons(reasons),
      };
    }

    if (goal.validity_state === "needs_revalidation") {
      if (activeRun) return this.workStateFromRun(base, activeRun);
      const reasons = this.workStatePhaseReasons(boardId, goal.goal_id, "revalidator", now, snapshot);
      return {
        ...base,
        work_state: reasons.length > 0 ? "revalidation_blocked" : "revalidation_pending",
        next_action: "revalidate",
        reasons: phaseReasons(reasons),
      };
    }

    if (goal.decomposition_state === "closed_compound") {
      if (childGoalIds.length > 0) {
        const childGoalById = new Map(snapshot.goals.map((child) => [child.goal_id, child]));
        const untrustedChildren = childGoalIds
          .map((childGoalId) => childGoalById.get(childGoalId)!)
          .filter(
            (child) =>
              child.fulfillment_state !== "satisfied" ||
              child.validity_state !== "valid" ||
              child.trashed_at != null ||
              child.archived_at != null,
          );
        if (
          goal.fulfillment_state === "satisfied" &&
          goal.validity_state === "valid" &&
          untrustedChildren.length === 0
        ) {
          return { ...base, work_state: "satisfied", next_action: null, reasons: [] };
        }
        return {
          ...base,
          work_state: "waiting_children",
          next_action: null,
          reasons: untrustedChildren.map((child) =>
            reason(
              "goal.compound_child_not_trusted",
              "goal",
              child.goal_id,
              `子 Goal「${child.title}」当前还不是可信完成`,
              {
                fulfillment_state: child.fulfillment_state,
                validity_state: child.validity_state,
                trashed: child.trashed_at != null,
                archived: child.archived_at != null,
              },
              "先恢复该子 Goal 的可信完成状态",
            ),
          ),
        };
      }
      return {
        ...base,
        work_state: "clarification_blocked",
        next_action: "clarify",
        reasons: [
          reason(
            "goal.compound_children_missing",
            "goal",
            goal.goal_id,
            "复合 Goal 已确认，但还没有任何生效的子 Goal",
            undefined,
            "补充子 Goal 或重新进入澄清后再确认拆分",
          ),
        ],
      };
    }

    if (activeRun) return this.workStateFromRun(base, activeRun);

    if (goal.fulfillment_state === "satisfied") {
      return { ...base, work_state: "satisfied", next_action: null, reasons: [] };
    }

    const reworkRequested = this.hasPostExecutionNeedsChanges(boardId, goal.goal_id);
    const pendingRuntimeReviewObligations = pendingReviewObligations.filter(
      (obligation) => obligation.role !== "human_approver",
    );
    const pendingHumanReviewObligations = pendingReviewObligations.filter(
      (obligation) => obligation.role === "human_approver",
    );
    if (pendingRuntimeReviewObligations.length > 0 && reviewReady && !reworkRequested) {
      const action = pendingRuntimeReviewObligations
        .map((obligation) => this.reviewActionFor(obligation))
        .find((candidate): candidate is AvailableAction => candidate !== null);
      const reasons = action?.role
        ? this.workStatePhaseReasons(boardId, goal.goal_id, action.role, now, snapshot)
        : [];
      return {
        ...base,
        work_state: reasons.length > 0 ? "review_blocked" : "review_pending",
        next_action: "review",
        reasons: phaseReasons(reasons),
      };
    }

    const uncoveredHumanCriterionIds = goal.acceptance_criteria
      .filter((criterion) => criterion.decision_method === "human_decision")
      .filter((criterion) => !this.criterionHasPassingEvidence(goal, criterion.criterion_id))
      .map((criterion) => criterion.criterion_id);
    if (
      reviewReady &&
      !reworkRequested &&
      (pendingHumanReviewObligations.length > 0 || uncoveredHumanCriterionIds.length > 0)
    ) {
      const criterionIds = unique([
        ...pendingHumanReviewObligations.flatMap((obligation) => obligation.criterion_scope),
        ...uncoveredHumanCriterionIds,
      ]).sort();
      const singlePendingHumanObligation = pendingHumanReviewObligations.length === 1
        ? pendingHumanReviewObligations[0]
        : null;
      const singleHumanObligation = singlePendingHumanObligation &&
          unique(singlePendingHumanObligation.criterion_scope).sort().length === criterionIds.length &&
          unique(singlePendingHumanObligation.criterion_scope).sort().every(
            (criterionId, index) => criterionId === criterionIds[index],
          )
        ? singlePendingHumanObligation
        : null;
      const conversationApprovalHandoff = singleHumanObligation
        ? {
            requires_single_pending_obligation: true,
            evidence_tool: "goalboard_v1_evidence_submit",
            evidence_kind: "human_verdict",
            evidence_result: "passed",
            criterion_ids: singleHumanObligation.criterion_scope,
            obligation_id: singleHumanObligation.obligation_id,
            locator_scheme: "conversation://",
            digest_source: "exact_user_quote",
            final_action: "open_goalboard_inbox_for_single_user_submit",
            runtime_can_submit_human_review: false,
          }
        : null;
      return {
        ...base,
        work_state: "waiting_for_human",
        next_action: null,
        reasons: [
          reason(
            "review.user_approval_required",
            "goal",
            goal.goal_id,
            "Runtime 可承担的检查已经结束，当前只剩用户本人验收与决定",
            {
              criterion_ids: criterionIds,
              obligation_ids: pendingHumanReviewObligations.map((item) => item.obligation_id),
              next_action: conversationApprovalHandoff
                ? "record_explicit_user_approval_or_open_goalboard"
                : "open_goalboard",
              ...(conversationApprovalHandoff
                ? { conversation_approval_handoff: conversationApprovalHandoff }
                : {}),
            },
            conversationApprovalHandoff
              ? "若用户在当前对话明确批准这一项唯一待决验收，Runtime 只把用户原话登记为 human_verdict Evidence 并打开已预填 Inbox；最终 Human Review 仍由用户提交。含糊回复、多个待决项或不通过结论继续使用 Inbox。"
              : "请用户在 GoalBoard 中完成真实操作、提交决定及相应验收依据；Runtime 不要重复领取 Review。",
          ),
        ],
      };
    }

    if (
      reviewReady &&
      pendingReviewObligations.length === 0 &&
      !reworkRequested &&
      this.acceptanceCriteriaPassed(goal, snapshot)
    ) {
      const completionRiskReasons = this.completionRiskReasons(goal.board_id, goal.goal_id);
      if (completionRiskReasons.length > 0) {
        return {
          ...base,
          work_state: "completion_blocked",
          next_action: null,
          reasons: completionRiskReasons,
        };
      }
      return {
        ...base,
        work_state: "completion_pending",
        next_action: "complete",
        reasons: [],
      };
    }

    const reasons = this.workStatePhaseReasons(boardId, goal.goal_id, "executor", now, snapshot);
    return {
      ...base,
      work_state: reasons.length > 0 ? "execution_blocked" : "execution_pending",
      next_action: "execute",
      reasons: phaseReasons(reasons),
    };
  }

  private workStateFromRun(
    base: Omit<GoalWorkStateView, "work_state" | "next_action" | "reasons">,
    run: RunRecord,
  ): GoalWorkStateView {
    const phase =
      run.role === "clarifier"
        ? "clarification"
        : run.role === "revalidator"
          ? "revalidation"
          : run.role === "self_verifier" || run.role === "cross_reviewer" || run.role === "adversarial_reviewer"
            ? "review"
            : "execution";
    const state =
      run.state === "blocked"
        ? (`${phase}_blocked` as GoalWorkState)
        : phase === "clarification"
          ? "clarifying"
          : phase === "revalidation"
            ? "revalidating"
            : phase === "review"
              ? "reviewing"
            : "executing";
    const nextAction: GoalWorkAction =
      phase === "clarification"
        ? "clarify"
        : phase === "revalidation"
          ? "revalidate"
          : phase === "review"
            ? "review"
            : "execute";
    return {
      ...base,
      work_state: state,
      next_action: nextAction,
      reasons:
        run.state === "blocked"
          ? [
              reason(
                "run.blocked",
                "run",
                run.run_id,
                run.block_reason ?? "Runtime 报告当前工作受阻",
              ),
            ]
          : [],
    };
  }

  /**
   * A direct Claim without a Run is an abnormal handoff, while a completed Run
   * whose Claim has not yet been released is a normal, short-lived transition.
   * Keep both unavailable without exposing protocol object names in the default UI.
   */
  private workStateWithoutRun(
    base: Omit<GoalWorkStateView, "work_state" | "next_action" | "reasons">,
    claim: ClaimRecord,
    latestRun: RunRecord | null,
  ): GoalWorkStateView {
    const phase =
      claim.role === "clarifier"
        ? "clarification"
        : claim.role === "revalidator"
          ? "revalidation"
          : claim.role === "self_verifier" ||
              claim.role === "cross_reviewer" ||
              claim.role === "adversarial_reviewer"
            ? "review"
            : "execution";
    const nextAction: GoalWorkAction =
      phase === "clarification"
        ? "clarify"
        : phase === "revalidation"
          ? "revalidate"
          : phase === "review"
            ? "review"
            : "execute";
    if (latestRun?.state === "completed") {
      const evidenceIncomplete = phase === "execution";
      return {
        ...base,
        work_state: evidenceIncomplete ? "executing" : (`${phase}_blocked` as GoalWorkState),
        next_action: nextAction,
        reasons: [
          reason(
            evidenceIncomplete ? "action.evidence_incomplete" : "claim.release_repair_required",
            "claim",
            claim.claim_id,
            evidenceIncomplete
              ? "执行已经结束，还需要补齐当前要求对应的完成依据"
              : "本阶段已经结束，但旧 Claim 没有正常自动释放",
            { claim_id: claim.claim_id, run_id: latestRun.run_id },
            evidenceIncomplete
              ? "提交最后一条必要 Evidence；系统会自动释放 Claim 并立即给出下一动作。"
              : "这是旧数据或异常恢复场景，可使用显式 release 修复；正常流程不会到这里。",
          ),
        ],
      };
    }
    return {
      ...base,
      work_state: `${phase}_blocked` as GoalWorkState,
      next_action: nextAction,
      reasons: [
        reason(
          "run.missing",
          "claim",
          claim.claim_id,
          "这项工作已被接手，但还没有开始推进",
          undefined,
          "开始推进，或者先结束当前接手状态后再交给其他人。",
        ),
      ],
    };
  }

  private latestWorkRunState(
    snapshot: ReturnType<SqliteGoalBoardStore["snapshot"]>,
    goal: GoalRecord,
  ): RunRecord["state"] | null {
    const compatibleRevisions = compatibleContractRevisions(goal, snapshot);
    const compatibleClaimIds = new Set(snapshot.claims
      .filter((claim) =>
        claim.goal_id === goal.goal_id && compatibleRevisions.has(claim.contract_revision)
      )
      .map((claim) => claim.claim_id));
    return (
      snapshot.runs
        .filter(
          (run) =>
            run.goal_id === goal.goal_id &&
            compatibleClaimIds.has(run.claim_id) &&
            (run.role === "executor" || run.role === "revalidator"),
        )
        .sort(
          (left, right) =>
            left.started_at.localeCompare(right.started_at) || left.run_id.localeCompare(right.run_id),
        )
        .at(-1)?.state ?? null
    );
  }

  private goalNeedsClarification(goal: GoalRecord): boolean {
    return (
      goal.definition_state !== "accepted" ||
      goal.decomposition_state === "abstract" ||
      goal.decomposition_state === "frontier_open" ||
      goal.acceptance_criteria.length === 0
    );
  }

  private acceptanceCriteriaPassed(
    goal: GoalRecord,
    _snapshot: ReturnType<SqliteGoalBoardStore["snapshot"]>,
  ): boolean {
    return goal.acceptance_criteria.every((criterion) =>
      this.criterionHasPassingEvidence(goal, criterion.criterion_id),
    );
  }

  private criterionHasPassingEvidence(goal: GoalRecord, criterionId: string): boolean {
    const snapshot = this.store.snapshot(goal.board_id);
    return this.evidenceVerification.query.hasPassingEvidence({
      board_id: goal.board_id,
      goal_id: goal.goal_id,
      criterion_id: criterionId,
      compatible_contract_revisions: [...compatibleContractRevisions(goal, snapshot)],
    });
  }

  private executorHandoffReasons(workState: GoalWorkStateView): DecisionReason[] {
    if (workState.work_state === "completion_blocked") {
      return [
        ...workState.reasons,
        reason(
          "goal.execution_finished_rework_required",
          "goal",
          workState.goal_id,
          "这条 Goal 的执行、Evidence 与 Review 已经结束；当前门禁只阻止完成，不是 executor Claim 门禁",
          {
            work_state: workState.work_state,
            completion_gate_only: true,
            recovery_tool: "goalboard_v1_rework_request",
          },
          "如果旧验收前提仍成立，处理返回的完成门禁后重试 complete；如果新反证推翻旧结论，调用 goalboard_v1_rework_request 指明受影响 criterion、反证 Evidence 和理由，再读取 Available 继续同一 Goal。",
        ),
      ].sort(compareReasons);
    }
    if (workState.work_state === "waiting_for_human") return workState.reasons;
    if (workState.work_state !== "completion_pending") return [];
    return [
      reason(
        "goal.ready_to_complete",
        "goal",
        workState.goal_id,
        "执行、证据和复核已经完成，不应开始新的执行",
        undefined,
        "直接调用完成判定；如果仍有门禁，按返回原因处理后重试。",
      ),
    ];
  }

  private completionRiskReasons(boardId: string, goalId: string): DecisionReason[] {
    return this.goalsModule.query.listOpenGoalRisks(boardId, goalId)
      .filter(risk => risk.blocking_mode === "completion" || risk.blocking_mode === "invalidate_on_trigger")
      .map(risk => reason(
        "risk.blocks_completion", "risk", risk.risk_id, risk.description,
        { blocking_mode: risk.blocking_mode, state: risk.state, owner: risk.owner,
          scope: "direct_goal", goal_id: goalId, association: "goal_risks", affected_surfaces: risk.affected_surfaces },
        risk.revisit_condition,
      ));
  }

  /**
   * Compatibility port for facts owned by Evidence, Governance and
   * Collaboration while Goal lifecycle rules live in modules/goals.
   */
  private externalCompletionGateReasons(boardId: string, goalId: string): DecisionReason[] {
    const goal = this.requireGoalOnBoard(boardId, goalId);
    const snapshot = this.store.snapshot(boardId);
    const reasons: DecisionReason[] = [];
    for (const criterion of goal.acceptance_criteria) {
      if (!this.criterionHasPassingEvidence(goal, criterion.criterion_id)) {
        reasons.push(
          reason(
            "evidence.criterion_uncovered",
            "criterion",
            criterion.criterion_id,
            `验收条件「${criterion.statement}」还没有通过证据`,
            undefined,
            criterion.pass_condition,
          ),
        );
      }
    }
    const pendingReviews = this.governance.query.listReviewObligations(boardId, goalId)
      .filter((obligation) => obligation.state === "pending");
    for (const pending of pendingReviews) {
      reasons.push(
        reason(
          "policy.review_pending",
          "review",
          pending.obligation_id,
          `还缺少 ${pending.role} Review`,
        ),
      );
    }
    const currentRunCandidates = snapshot.candidates.filter((candidate) => {
      const run = snapshot.runs.find((item) => item.run_id === candidate.discovered_in_run_id);
      return run?.goal_id === goalId && candidate.blocking_mode === "current_run";
    });
    const pendingCandidates = currentRunCandidates.filter((candidate) => candidate.state === "pending");
    for (const candidate of pendingCandidates) {
      reasons.push(reason(
        "candidate.user_decision_required",
        "candidate",
        candidate.candidate_id,
        "执行中发现的新工作需要用户决定",
      ));
    }
    const currentRunCandidateIds = new Set(currentRunCandidates.map((candidate) => candidate.candidate_id));
    const pendingRewires = snapshot.rewires.filter(
      (rewire) => rewire.state === "pending" && rewire.candidate_id != null && currentRunCandidateIds.has(rewire.candidate_id),
    );
    for (const pending of pendingRewires) {
      reasons.push(reason(
        "rewire.user_confirmation_required",
        "rewire",
        pending.rewire_id,
        "用户已接受 Candidate Goal，但关系调整尚未确认",
        { candidate_id: pending.candidate_id },
      ));
    }
    const directPendingRewires = snapshot.rewires.filter(
      (rewire) =>
        rewire.candidate_id == null &&
        rewire.state === "pending" &&
        rewire.proposal.proposal_kind === "dependency" &&
        rewire.proposal.blocking_mode === "current_run" &&
        rewire.proposal.discovered_in_run_id != null,
    );
    for (const pending of directPendingRewires) {
      const discoveredRun = snapshot.runs.find(
        (run) => run.run_id === pending.proposal.discovered_in_run_id,
      );
      if (discoveredRun?.goal_id !== goalId) continue;
      reasons.push(reason(
        "rewire.user_confirmation_required",
        "rewire",
        pending.rewire_id,
        "Runtime 提出了依赖调整，等待用户决定",
      ));
    }
    return reasons;
  }

  private hasPostExecutionNeedsChanges(boardId: string, goalId: string): boolean {
    const latestWorkCompletedSeq = this.executionModule.repository.latestCompletedWorkRunEventSeq(
      boardId,
      goalId,
    );
    const latestNeedsChangesSeq = this.governance.query
      .latestNeedsChangesReviewEventSeq(boardId, goalId);
    const latestReworkSeq = this.store.snapshot(boardId).lifecycle_events
      .filter((event) => event.type === "goal.rework_requested" && event.object_id === goalId)
      .reduce((latest, event) => Math.max(latest, event.seq), 0);
    return Math.max(
      latestNeedsChangesSeq,
      latestReworkSeq,
    ) > latestWorkCompletedSeq;
  }

  private workStatePhaseReasons(
    boardId: string,
    goalId: string,
    role: ClaimRole,
    now: string,
    snapshot?: BoardSnapshot,
  ): DecisionReason[] {
    const policy = this.resolvePolicy(boardId, goalId);
    return this.evaluate({
      boardId,
      goalId,
      actorId: "work-state-observer",
      role,
      capabilities: policy.required_capabilities,
      goalModeAttestation: true,
      now,
      snapshot,
    }).reasons.filter((item) => !item.code.startsWith("claim."));
  }

  private reviewActionFor(obligation: {
    obligation_id: string;
    role: "self_verifier" | "cross_reviewer" | "adversarial_reviewer" | "human_approver";
  }): AvailableAction | null {
    if (obligation.role === "human_approver") return null;
    return {
      role:
        obligation.role === "self_verifier"
          ? "self_verifier"
          : obligation.role === "cross_reviewer"
          ? "cross_reviewer"
          : obligation.role === "adversarial_reviewer"
            ? "adversarial_reviewer"
            : "executor",
      next_action: "review",
      review_obligation_id: obligation.obligation_id,
    };
  }

  private workActionMessage(action: GoalWorkAction): string {
    switch (action) {
      case "clarify":
        return "这条 Goal 仍有会影响范围、拆分或验收的未知项，当前 Runtime 可以继续对话澄清";
      case "revalidate":
        return "前提发生变化，当前 Runtime 可以重新核对 Contract、依赖和风险";
      case "review":
        return "执行结果正在等待所需 Review，当前 Runtime 可以按其角色复核";
      case "execute":
        return "Goal 已澄清为最小闭环，当前 Runtime 可以选择并开始执行";
      case "complete":
        return "执行、证据和复核已经完成；现在应直接重试完成判定，不要开始新的执行";
    }
  }

  private claimRoleForAction(candidate: GoalAction, snapshot: BoardSnapshot): ClaimRole {
    if (candidate.kind === "clarify") return "clarifier";
    if (candidate.kind === "revalidate") return "revalidator";
    if (candidate.kind === "review") {
      const obligation = snapshot.review_obligations.find(
        (item) => item.obligation_id === candidate.target_id,
      );
      if (obligation && obligation.role !== "human_approver") return obligation.role;
    }
    return "executor";
  }

  private planningRationale(metric: PlanningMetric | undefined): string {
    const unlocks = metric?.unlock_count ?? 0;
    const chain = metric?.longest_downstream_chain ?? 0;
    if (unlocks > 0) {
      return `完成后可解锁 ${unlocks} 个尚未完成的下游 Goal；最长后续链路 ${chain} 层`;
    }
    if ((metric?.topological_level ?? 0) === 0) {
      return "当前没有未完成的前置产出阻挡，可以独立推进";
    }
    return `当前位于依赖图第 ${metric?.topological_level ?? 0} 层，前置产出已经满足`;
  }

  /**
   * Adding a new child to an already completed compound Goal changes the
   * confirmed decomposition. Keep the old fact history, but make the parent
   * a Draft again so the user can confirm the expanded tree instead of
   * silently presenting a completed parent with unfinished children.
   */
  private evaluate(input: EvaluationInput): Evaluation {
    const snapshotIndex = input.snapshot_index ?? (
      input.snapshot ? snapshotEvaluationIndex(input.snapshot) : undefined
    );
    const goal = snapshotIndex
      ? snapshotIndex.goals_by_id.get(input.goalId) ?? null
      : this.store.getGoal(input.goalId);
    const policy = this.resolvePolicy(
      input.boardId,
      input.goalId,
      input.strengthenPolicy,
      input.policy_rows,
    );
    const surfaces = snapshotIndex
      ? snapshotIndex.impacts_by_goal.get(input.goalId) ?? []
      : this.goalImpacts(input.boardId, input.goalId, input.snapshot);
    const reasons: DecisionReason[] = [];
    if (!goal || goal.board_id !== input.boardId) {
      reasons.push(reason("goal.not_found", "goal", input.goalId, "找不到这个 Goal"));
      return { goal: null, reasons, policy, surfaces };
    }
    if (goal.trashed_at) {
      reasons.push(
        reason(
          "goal.trashed",
          "goal",
          goal.goal_id,
          "Goal 已移入回收站，当前不接受新的 Runtime 工作",
          { trashed_at: goal.trashed_at },
          "由用户恢复后再查询 Ready",
        ),
      );
    }
    if (goal.archived_at) {
      reasons.push(
        reason(
          "goal.archived",
          "goal",
          goal.goal_id,
          "Goal 已归档，当前不接受新的 Runtime 领取",
          { archived_at: goal.archived_at },
          "由用户恢复后再查询 Ready",
        ),
      );
    }
    if (!goal.trashed_at && !goal.archived_at) {
      const replacement = this.activeGoalReplacement(input.boardId, goal.goal_id, input.snapshot);
      if (replacement) reasons.push(this.goalReplacedReason(goal.goal_id, replacement));
    }
    if (input.role === "clarifier") {
      const needsClarification = this.goalNeedsClarification(goal);
      if (!needsClarification) {
        reasons.push(
          reason(
            "goal.clarification_not_needed",
            "goal",
            goal.goal_id,
            "这个 Goal 已经可以进入执行领取，不再需要澄清者",
            undefined,
            "改用 executor 查询和领取",
          ),
        );
      }
      const pendingContractProposal = snapshotIndex
        ? snapshotIndex.pending_contract_proposal_by_goal.get(goal.goal_id)
        : this.governance.query.snapshot(input.boardId).contract_proposals
          .find((proposal) => proposal.goal_id === goal.goal_id && proposal.state === "pending");
      if (pendingContractProposal) {
        reasons.push(
          reason(
            "contract_proposal.user_decision_required",
            "contract_proposal",
            asText(pendingContractProposal.proposal_id),
            "目标方案已经整理好，正在等你确认或退回修改",
          ),
        );
      }
      if (goal.validity_state === "invalidated") {
        reasons.push(reason("goal.invalidated", "goal", goal.goal_id, "Goal 已失效"));
      }
      if (goal.fulfillment_state === "satisfied") {
        reasons.push(reason("goal.already_satisfied", "goal", goal.goal_id, "Goal 已完成"));
      }
    } else {
      if (
        input.role === "self_verifier" ||
        input.role === "cross_reviewer" ||
        input.role === "adversarial_reviewer"
      ) {
        const pendingReview = snapshotIndex
          ? snapshotIndex.pending_review_keys.has(`${input.goalId}\u0000${input.role}`)
          : this.governance.query.listReviewObligations(input.boardId, input.goalId)
            .some((obligation) => obligation.role === input.role && obligation.state === "pending");
        if (!pendingReview) {
          reasons.push(
            reason(
              "review.not_pending",
              "goal",
              goal.goal_id,
              "当前没有等待此类 Runtime Review 的义务",
            ),
          );
        }
        const latestWorkRun = snapshotIndex
          ? snapshotIndex.latest_work_run_by_goal.get(input.goalId)
          : this.executionModule.repository.latestRunForGoal(
              input.boardId,
              input.goalId,
              ["executor", "revalidator"],
            );
        if (!latestWorkRun || latestWorkRun.state !== "completed") {
          reasons.push(
            reason(
              "review.execution_not_completed",
              "goal",
              goal.goal_id,
              "执行 Run 尚未完成，不能开始 Review",
            ),
          );
        }
      }
      if (goal.definition_state !== "accepted") {
        reasons.push(reason("goal.not_accepted", "goal", goal.goal_id, "Goal 还没有被接受"));
      }
      if (goal.decomposition_state !== "closed_leaf") {
        reasons.push(
          reason(
            "goal.not_closed_leaf",
            "goal",
            goal.goal_id,
            "这个 Goal 还不是可以直接执行的最小 Goal",
            { decomposition_state: goal.decomposition_state },
            "继续拆分，直到结果和验收都能在 Goal 内闭环",
          ),
        );
      }
      if (input.role === "revalidator" && goal.validity_state === "valid") {
        reasons.push(
          reason(
            "goal.revalidation_not_needed",
            "goal",
            goal.goal_id,
            "Goal 当前已经是可信状态，不需要重新验证",
            undefined,
            "改用 executor 查询和领取",
          ),
        );
      } else if (input.role === "executor" && goal.validity_state === "needs_revalidation") {
        reasons.push(reason("goal.needs_revalidation", "goal", goal.goal_id, "Goal 需要重新验证后才能执行"));
      }
      if (goal.validity_state === "invalidated") {
        reasons.push(reason("goal.invalidated", "goal", goal.goal_id, "Goal 已失效"));
      }
      if (input.role === "executor" && goal.fulfillment_state === "satisfied") {
        reasons.push(reason("goal.already_satisfied", "goal", goal.goal_id, "Goal 已完成"));
      }
      if (goal.acceptance_criteria.length === 0) {
        reasons.push(reason("goal.acceptance_missing", "criterion", goal.goal_id, "Goal 没有明确验收条件"));
      }

      const dependencies = snapshotIndex
        ? snapshotIndex.dependencies_by_goal.get(input.goalId) ?? []
        : this.goalsModule.query.listDependencies(input.boardId, input.goalId);
      for (const dependency of dependencies) {
        const dependencyId = asText(dependency.goal_id);
        if (asText(dependency.fulfillment_state) !== "satisfied") {
          reasons.push(
            reason(
              "dependency.unsatisfied",
              "dependency",
              dependencyId,
              `前置 Goal「${asText(dependency.title)}」还未完成`,
              { dependency_goal_id: dependencyId },
            ),
          );
        }
        if (asText(dependency.validity_state) !== "valid") {
          reasons.push(
            reason(
              "dependency.not_valid",
              "dependency",
              dependencyId,
              `前置 Goal「${asText(dependency.title)}」当前不可信`,
              { validity_state: asText(dependency.validity_state) },
            ),
          );
        }
      }

      const risks = snapshotIndex
        ? snapshotIndex.risks_by_goal.get(input.goalId) ?? []
        : this.goalsModule.query.listOpenGoalRisks(input.boardId, input.goalId);
      for (const risk of risks) {
        const blockingMode = asText(risk.blocking_mode);
        const state = asText(risk.state);
        if (blockingMode === "claim" || (blockingMode === "invalidate_on_trigger" && state === "triggered")) {
          reasons.push(
            reason(
              "risk.blocks_claim",
              "risk",
              asText(risk.risk_id),
              asText(risk.description),
              { blocking_mode: blockingMode, state },
              asText(risk.revisit_condition),
            ),
          );
        }
      }
    }

    if (policy.goal_mode === "required" && !input.goalModeAttestation) {
      reasons.push(
        reason(
          "policy.goal_mode_required",
          "policy",
          input.goalId,
          "这个 Goal 要求 Runtime 开启 Goal 模式",
          undefined,
          "领取时提交 goal_mode_attestation=true",
        ),
      );
    }
    const capabilities = new Set(input.capabilities);
    for (const required of policy.required_capabilities) {
      if (!capabilities.has(required)) {
        reasons.push(
          reason(
            "policy.capability_missing",
            "policy",
            required,
            `Runtime 缺少能力：${required}`,
            { required_capability: required },
          ),
        );
      }
    }

    const sameGoalClaim = snapshotIndex
      ? (snapshotIndex.claims_by_goal.get(input.goalId) ?? [])
        .filter((claim) => claim.state === "active" && claim.expires_at > input.now)
        .sort((left, right) => left.claim_id.localeCompare(right.claim_id))[0]
      : this.executionModule.repository
        .listClaimsForGoal(input.boardId, input.goalId)
        .filter((claim) => claim.state === "active" && claim.expires_at > input.now)
        .sort((left, right) => left.claim_id.localeCompare(right.claim_id))[0];
    if (sameGoalClaim) {
      reasons.push(
        reason(
          "claim.already_active",
          "claim",
          asText(sameGoalClaim.claim_id),
          "这个 Goal 已被另一个 Runtime 领取",
          { actor_id: asText(sameGoalClaim.actor_id) },
        ),
      );
    }

    if (input.role === "executor" || input.role === "revalidator") {
      reasons.push(...this.impactConflicts(
        input.boardId,
        input.goalId,
        surfaces,
        input.now,
        snapshotIndex,
      ));
    }
    return { goal, reasons: reasons.sort(compareReasons), policy, surfaces };
  }

  private resolvePolicy(
    boardId: string,
    goalId: string,
    strengthen?: Partial<GoalPolicy>,
    allActiveRows?: ReturnType<SqliteGoalBoardStore["activePolicyRowsForBoard"]>,
  ): GoalPolicy {
    const rows = allActiveRows
      ? allActiveRows.filter((row) => row.goal_id == null || row.goal_id === goalId)
      : this.store.activePolicyRows(boardId, goalId);
    return resolveGoalPolicy(
      rows as Parameters<typeof resolveGoalPolicy>[0],
      strengthen,
    );
  }

  private impactConflicts(
    boardId: string,
    goalId: string,
    requested: ImpactBindingRecord[],
    now: string,
    snapshotIndex?: SnapshotEvaluationIndex,
  ): DecisionReason[] {
    const rows = snapshotIndex
      ? [...snapshotIndex.claims_by_goal.entries()]
        .filter(([existingGoalId]) => existingGoalId !== goalId)
        .flatMap(([existingGoalId, claims]) => claims
          .filter((claim) => claim.state === "active" && claim.expires_at > now)
          .flatMap((claim) => (snapshotIndex.impacts_by_goal.get(existingGoalId) ?? [])
            .filter((impact) => impact.state === "confirmed")
            .map((impact) => ({
              claim_id: claim.claim_id,
              existing_goal_id: existingGoalId,
              surface: impact.surface,
              access: impact.access,
              input_snapshot: impact.input_snapshot,
            }))))
        .sort((left, right) =>
          left.surface.localeCompare(right.surface) || left.claim_id.localeCompare(right.claim_id)
        )
      : (() => {
          const snapshot = this.store.snapshot(boardId);
          return snapshot.claims
            .filter((claim) =>
              claim.goal_id !== goalId && claim.state === "active" && claim.expires_at > now
            )
            .flatMap((claim) => snapshot.impacts
              .filter((impact) => impact.goal_id === claim.goal_id && impact.state === "confirmed")
              .map((impact) => ({
                claim_id: claim.claim_id,
                existing_goal_id: claim.goal_id,
                surface: impact.surface,
                access: impact.access,
                input_snapshot: impact.input_snapshot,
              })))
            .sort((left, right) =>
              left.surface.localeCompare(right.surface) || left.claim_id.localeCompare(right.claim_id)
            );
        })();
    return executionImpactPolicy.conflicts(requested, rows);
  }

  private parallelExecutionSuggestion(
    available: AvailableGoal[],
  ): ParallelExecutionSuggestion | null {
    const selected: Array<{ item: AvailableGoal; surfaces: ImpactBindingRecord[] }> = [];
    for (const item of available) {
      if (item.role !== "executor" || item.next_action !== "execute") continue;
      const surfaces = item.relevant_surfaces.filter((impact) => impact.state === "confirmed");
      if (surfaces.length === 0) continue;
      if (
        selected.some(
          (existing) => !executionImpactPolicy.allowsParallel(existing.surfaces, surfaces),
        )
      ) {
        continue;
      }
      selected.push({ item, surfaces });
    }
    if (selected.length < 2) return null;
    return {
      kind: "safe_parallel_execution",
      advisory_only: true,
      assignments: selected.map(({ item }, index) => ({
        runtime_slot: index === 0 ? "current_runtime" : `additional_runtime_${index}`,
        goal_id: item.goal.goal_id,
        title: item.goal.title,
        role: "executor",
        required_capabilities: item.resolved_policy.required_capabilities,
      })),
    };
  }

  private goalImpacts(
    boardId: string,
    goalId: string,
    snapshot?: BoardSnapshot,
  ): ImpactBindingRecord[] {
    return (snapshot ?? this.store.snapshot(boardId)).impacts.filter(
      (impact) => impact.goal_id === goalId && impact.state !== "inactive",
    );
  }

  private dependencySummary(
    boardId: string,
    goalId: string,
    snapshotIndex?: SnapshotEvaluationIndex,
  ): string[] {
    if (snapshotIndex) {
      return (snapshotIndex.dependencies_by_goal.get(goalId) ?? []).map((goal) => goal.title);
    }
    return this.goalsModule.query.listDependencies(boardId, goalId).map(goal => goal.title);
  }

  private riskSummary(boardId: string, goalId: string, snapshotIndex?: SnapshotEvaluationIndex): string[] {
    if (snapshotIndex) {
      return (snapshotIndex.risks_by_goal.get(goalId) ?? []).map((risk) => risk.description);
    }
    return this.goalsModule.query.listOpenGoalRisks(boardId, goalId).map(risk => risk.description);
  }


  private requireBoard(boardId: string): void {
    if (!this.goalsModule.query.getBoard(boardId)) {
      throw new GoalBoardV1Error("board.not_found", `Board 不存在: ${boardId}`);
    }
  }

  private requireGoalOnBoard(boardId: string, goalId: string): GoalRecord {
    const goal = this.goalsModule.query.getGoal(boardId, goalId);
    if (!goal) {
      throw new GoalBoardV1Error("goal.not_found", `Goal 不存在: ${goalId}`);
    }
    return goal;
  }


  private replay<T>(
    boardId: string,
    actorId: string,
    operation: string,
    key: string,
    hash: string,
  ): T | null {
    const existing = this.store.getIdempotency(boardId, actorId, operation, key);
    if (!existing) return null;
    if (existing.request_hash !== hash) {
      throw new GoalBoardV1Error(
        "request.idempotency_key_reused",
        `幂等键 ${key} 已被不同请求使用`,
      );
    }
    return existing.outcome as T;
  }

  private remember(
    boardId: string,
    actorId: string,
    operation: string,
    key: string,
    hash: string,
    outcome: unknown,
    at: string,
  ): void {
    this.store.putIdempotency({
      boardId,
      actorId,
      operation,
      key,
      requestHash: hash,
      outcome,
      at,
    });
  }
}

export type GoalBoardDatabase = Database.Database;
import { GoalInputBindings } from "@adeptify/goalboard-module-goals";
import type { GoalInputBindingsApi } from "@adeptify/goalboard-contracts/modules/goals";
