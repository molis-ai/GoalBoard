import type { SqliteDatabase } from "@adeptify/goalboard-storage";
import { createContextLedger } from "@adeptify/goalboard-module-context-ledger";
import { ArtifactsModule, type ArtifactsSqliteDatabase } from "@adeptify/goalboard-module-artifacts";
import type { ArtifactsApplicationApi } from "@adeptify/goalboard-contracts/modules/artifacts";
import { EvidenceVerificationModule, type EvidenceSqliteDatabase } from "@adeptify/goalboard-module-evidence-verification";
import type { EvidenceVerificationApplicationApi } from "@adeptify/goalboard-contracts/modules/evidence-verification";
import { ExecutionModule, type ExecutionSqliteDatabase } from "@adeptify/goalboard-module-execution";
import type { ExecutionApplicationApi } from "@adeptify/goalboard-contracts/modules/execution";
import { GovernanceCollaborationModule, type GovernanceSqliteDatabase } from "@adeptify/goalboard-module-governance-collaboration";
import type { GovernanceApplicationApi } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import {
  GoalsModule,
  type GoalsSqliteDatabase,
  type PlanningMethodPack,
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
  GoalEventApplication,
  contractRevisionIsCompatible,
  deriveGoalActionProjection,
  type ExecutionValidationApplicationApi,
} from "@adeptify/goalboard-plugin-goals";
import { LocalProjectDatabase } from "./project-database.js";
import type { ActionTransitionReceipt, BoardSnapshot, GoalContractView } from "@adeptify/goalboard-plugin-goals";
import type { GoalRecord, GoalPolicy, ProjectGuidanceView } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionClaimRecord as ClaimRecord, ExecutionRunRecord as RunRecord } from "@adeptify/goalboard-contracts/modules/execution";
import type { ReviewRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { GoalReadApplication, projectGoalLifecycle, RiskActionAuthorization, ensureGoalReviewObligations } from "@adeptify/goalboard-plugin-goals";
export { projectGoalLifecycle } from "@adeptify/goalboard-plugin-goals";
import { ExecutionValidationApplication, GoalWorkStateQueries, GoalEligibility, GoalAvailability } from "@adeptify/goalboard-plugin-goals";
import { GoalBoardV1Error } from "@adeptify/goalboard-plugin-goals";
export { GoalBoardV1Error } from "@adeptify/goalboard-plugin-goals";
export type {
  ClaimReleaseHandoff,
  ClaimReleaseResult,
  ReportRunResult as RunReportResult,
} from "@adeptify/goalboard-plugin-goals";

export type ExplainGoalResult = import("@adeptify/goalboard-plugin-goals").ExplainGoalResult;

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

export class GoalProjectApplication {
  readonly artifacts: ArtifactsApplicationApi;
  private readonly evidenceVerificationModule: EvidenceVerificationModule;
  private readonly executionModule: ExecutionModule;
  private readonly goalsModule: GoalsModule<ActionTransitionReceipt>;
  readonly evidenceVerification: EvidenceVerificationApplicationApi;
  readonly execution: ExecutionApplicationApi;
  readonly governance: GovernanceApplicationApi;
  readonly goals: GoalsApplicationApi<ActionTransitionReceipt>;
  readonly goalEvents: GoalEventApplication;
  readonly goalInputs: GoalInputBindingsApi;
  readonly goalQueries: GoalReadApplication;
  private readonly workStateQueries: GoalWorkStateQueries;
  private readonly eligibility: GoalEligibility;
  private readonly availability: GoalAvailability;
  private readonly riskAuthorization: RiskActionAuthorization;
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
    readonly store: LocalProjectDatabase,
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
      assertRunStartAllowed: (boardId, goalId) => this.eligibility.assertRunStartAllowed(boardId, goalId),
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
      eventDecisions: governanceModule.eventDecisions,
    };
    this.goalInputs = new GoalInputBindings(this.store.db, createContextLedger(this.store.db, {
      authorize: (access) => access.scope.kind === "personal",
      now: () => this.clock(),
    }));
    let goalsModule!: GoalsModule<ActionTransitionReceipt>;
    goalsModule = new GoalsModule<ActionTransitionReceipt>(
      this.store.db as unknown as GoalsSqliteDatabase,
      {
        validateRelationGraph: (boardId, input) => goalsModule.planning.validateRelationAddition(boardId, input),
        blockingWork: (boardId, goalId, now) => ({
          claim_ids: this.execution.query.activeClaimIdsForGoal(boardId, goalId, now),
          run_ids: this.execution.query.activeRunIdsForGoal(boardId, goalId),
        }),
        compoundCoverageBlocksClosure: (boardId, goalId) => goalsModule.planning.compoundCoverageBlocksClosure(boardId, goalId),
        completionGateReasons: (boardId, goalId) =>
          this.workStateQueries.externalCompletionGateReasons(boardId, goalId),
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
          this.execution.commands.completeRunForRevalidation(boardId, runId, actorId);
        },
        transitionRevisionDependents: (input) =>
          transitionGoalRevisionDependents({ execution: this.execution.commands, governance: this.governance.reviews }, input),
        supersedePendingContractProposals: (...args) => this.governance.records.supersedePendingContractProposals(...args),
        currentActionToken: (boardId, goalId) =>
          this.executionValidation.query.getGoalActionProjection({ board_id: boardId, goal_id: goalId }).action_token,
        authorizeRiskUpdate: (boardId, input, write, current) =>
          this.riskAuthorization.authorizeGoalRiskUpdate(boardId, input, write, current),
        authorizeRiskState: (
          boardId,
          input,
          write,
          current,
          linkedGoalIds,
          resolutionBasis,
        ) => this.riskAuthorization.authorizeGoalRiskState(
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
    this.goalEvents = new GoalEventApplication({
      query: goalsModule.query,
      commands: goalsModule.commands,
      events: goalsModule.events,
      planning: goalsModule.planning,
      recordTrustedDecision: (input) => this.governance.eventDecisions.record(input),
    });
    this.goalQueries = new GoalReadApplication(goalsModule.query, {
      now: () => this.clock(),
      snapshot: (boardId) => this.store.snapshot(boardId),
      workState: (boardId, goal, snapshot, now) =>
        this.workStateQueries.deriveGoalWorkState(boardId, goal, snapshot, now),
      actionProjection: (goal, snapshot, now) =>
        deriveGoalActionProjection(goal, snapshot, now),
      goalTreeProposals: (boardId, rootGoalId) =>
        this.goalTree.listGoalTreeProposals({ board_id: boardId, root_goal_id: rootGoalId }).proposals,
    });
    this.eligibility = new GoalEligibility({
      goals: this.goalsModule.query, execution: this.execution.query, governance: this.governance.query,
      events: this.goalsModule.events,
      snapshot: boardId => this.store.snapshot(boardId),
    });
    this.workStateQueries = new GoalWorkStateQueries({
      goals: this.goalsModule.query, execution: this.execution.query,
      evidence: this.evidenceVerification.query, governance: this.governance.query,
      snapshot: boardId => this.store.snapshot(boardId),
      requireGoalOnBoard: (boardId, goalId) => this.requireGoalOnBoard(boardId, goalId),
      resolvePolicy: (boardId, goalId) => this.eligibility.resolvePolicy(boardId, goalId),
      evaluate: input => this.eligibility.evaluate(input),
    });
    this.availability = new GoalAvailability({
      goals: this.goalsModule.query, planning: this.goals.planning, eligibility: this.eligibility,
      workState: this.workStateQueries, snapshot: boardId => this.store.snapshot(boardId),
      eventCursor: boardId => this.store.eventCursor(boardId), clock: this.clock,
      requireBoard: boardId => this.requireBoard(boardId),
      getGoalWorkState: input => this.executionValidation.query.getGoalWorkState(input),
    });
    this.riskAuthorization = new RiskActionAuthorization({
      snapshot: boardId => this.store.snapshot(boardId), clock: this.clock,
      requireGoalOnBoard: (boardId, goalId) => this.requireGoalOnBoard(boardId, goalId),
      validation: { getGoalActionProjection: input => this.executionValidation.query.getGoalActionProjection(input) },
      error: (code, message, details) => new GoalBoardV1Error(code, message, details),
    });
    this.executionValidation = new ExecutionValidationApplication({
      state: {
        immediate: operation => this.store.immediate(operation),
        snapshot: boardId => this.store.snapshot(boardId),
        eventCursor: boardId => this.store.eventCursor(boardId),
        appendEvent: input => this.store.appendEvent(input),
      },
      errorType: GoalBoardV1Error,
      execution: this.execution,
      evidenceVerification: this.evidenceVerification,
      governance: this.governance,
      goalsLifecycle: this.goalsModule.lifecycle,
      clock: this.clock,
      evaluate: (input) => this.eligibility.evaluate(input),
      claimRoleForAction: (candidate, snapshot) => this.availability.claimRoleForAction(candidate, snapshot),
      ensureReviewObligations: (boardId, goalId, policy, at) =>
        ensureGoalReviewObligations(this.governance.reviews, this.store.snapshot(boardId), boardId, goalId, policy, at),
      deriveGoalWorkState: (boardId, goal, snapshot, now) =>
        this.workStateQueries.deriveGoalWorkState(boardId, goal, snapshot, now),
      executorHandoffReasons: (workState) => this.workStateQueries.executorHandoffReasons(workState),
      reconcileLifecycle: (boardId, goalId, actorId, previousActionToken, summary, at) =>
        this.lifecycleReconciliation.reconcile(boardId, goalId, actorId, previousActionToken, summary, at),
      hasPostExecutionNeedsChanges: (boardId, goalId) =>
        this.workStateQueries.hasPostExecutionNeedsChanges(boardId, goalId),
      readRun: (boardId, runId) => this.readRun(boardId, runId),
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
    return this.goals.commands.initializeBoard(input);
  }

  readProjectGuidance(boardId: string): ProjectGuidanceView {
    return this.goalQueries.readProjectGuidance(boardId);
  }

  setActiveGoal(
    boardId: string,
    input: { goal_id: string; reason: string },
    write: ActorWrite,
  ): { active_goal_id: string; replayed: boolean; observed_event_cursor: number } {
    return this.goals.commands.setActiveGoal(boardId, input, write);
  }

  /** A dedicated read path for a later trash UI/MCP; ordinary work lists exclude these Goals. */
  listTrashedGoals(boardId: string): GoalRecord[] {
    return this.goalQueries.listTrashedGoals(boardId);
  }

  queryReady(input: ReadyQuery): ReadyQueryResult {
    return this.availability.queryReady(input);
  }

  /**
   * Returns every action this Runtime may take now. Unlike the legacy
   * role-scoped `queryReady`, this is the Runtime's menu, not a dispatcher.
   */
  queryAvailable(input: AvailableQuery): AvailableQueryResult {
    return this.availability.queryAvailable(input);
  }

  /** Read the canonical effective policy without running a full readiness evaluation. */
  getResolvedGoalPolicy(input: { board_id: string; goal_id: string }): GoalPolicy {
    return this.goalQueries.getResolvedGoalPolicy(input);
  }

  explainGoal(input: ReadyQuery & { goal_id: string }): ExplainGoalResult {
    return this.availability.explainGoal(input);
  }

  readGoalContract(boardId: string, goalId: string): GoalContractView {
    return this.goalQueries.readGoalContract(boardId, goalId);
  }

  private readRun(boardId: string, runId: string): RunRecord {
    const run = this.execution.query.getRun(boardId, runId);
    if (!run) throw new Error(`Run 写入后无法读取: ${runId}`);
    return run;
  }

  private readReview(boardId: string, reviewId: string): ReviewRecord {
    const review = this.governance.query.listReviews(boardId)
      .find((item) => item.review_id === reviewId);
    if (!review) throw new Error(`Review 写入后无法读取: ${reviewId}`);
    return review;
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

export type GoalBoardDatabase = SqliteDatabase;
import { GoalInputBindings } from "@adeptify/goalboard-module-goals";
import type { GoalInputBindingsApi } from "@adeptify/goalboard-contracts/modules/goals";
