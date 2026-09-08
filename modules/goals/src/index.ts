import { GoalBoardCommands } from "./board-commands.js";
import type {
  AddGoalRelationInput,
  AddProjectGuidanceInput,
  CreateGoalInput,
  GoalPolicy,
  PlanningMethodPack,
  GoalsCommandApi,
  GoalsLifecycleApi,
  GoalsQueryApi,
  GoalsActorWrite,
  GoalsImpactApi,
  RiskFactsInput,
  SetRiskStateInput,
  UpdateProjectGuidanceInput,
  UpdateRiskInput,
} from "@adeptify/goalboard-contracts/modules/goals";

import {
  GoalsCommandContext,
  type GoalsCommandContextOptions,
} from "./command-support.js";
import {
  GoalCommands,
  type GoalRelationGraphIssue,
  type GoalsCommandLifecycleHooks,
} from "./goal-commands.js";
import { GuidanceCommands } from "./guidance-commands.js";
import { LegacyGoalCoverage } from "./legacy-coverage.js";
import { GoalImpactCommands } from "./impact-commands.js";
import { ConfirmedPolicyCommands } from "./confirmed-policy.js";
import { ConfirmedGoalCommands } from "./confirmed-goal.js";
import { ConfirmedRiskCommands } from "./confirmed-risk.js";
import { ConfirmedRelationCommands } from "./confirmed-relations.js";
import { AcceptedRewireRelations } from "./accepted-rewire-relations.js";
import {
  GoalLifecycleCommands,
  type GoalsLifecycleHooks,
} from "./lifecycle-commands.js";
import type { GoalRevisionHooks } from "./lifecycle-revisions.js";
import {
  migrateActiveGoalLifecycle,
  migrateGoalArchiveSchema,
  migrateGoalContractCoverageSchema,
  migrateGoalLifecycleState,
  migratePlanningMethodPacksSchema,
  migrateGoalTrashSchema,
  type GoalLifecycleMigrationDatabase,
} from "./migrations.js";
import {
  RiskCommands,
  type GoalsRiskLifecycleHooks,
} from "./risk-commands.js";
import { GoalsPlanningEngine } from "./planning/engine.js";
import { GoalsQueryService } from "./query.js";
import { GoalsRepository, type GoalsSqliteDatabase } from "./repository.js";

export const packageDescriptor = {
  packageName: "@adeptify/goalboard-module-goals",
  packagePath: "modules/goals",
  kind: "module",
  maturity: "partial",
  contract: "@adeptify/goalboard-contracts/modules/goals",
  migrationGoals: [
    "goal-reorg-f2",
    "goal-f826dfb8-bf63-4e98-b6b7-57f6b4b7c3b8",
    "goal-reorg-gw1",
    "goal-reorg-gw2",
    "goal-reorg-gw3",
    "goal-reorg-gw4",
  ],
  ssot: "docs/SSOT-MATRIX.md",
  capabilities: [
    "goals.command.v1",
    "goals.repository.v1",
    "goals.lifecycle.v1",
    "goals.planning.v1",
    "goals.query.v1",
  ],
} as const;

export type GoalBoardPackageDescriptor = typeof packageDescriptor;

export interface GoalsModuleHooks<TTransition>
  extends GoalsLifecycleHooks<TTransition>, GoalsRiskLifecycleHooks<TTransition>, Pick<GoalRevisionHooks, "transitionRevisionDependents">,
    Pick<GoalsCommandLifecycleHooks, "supersedePendingContractProposals"> {
  validateRelationGraph?(boardId: string, input: AddGoalRelationInput): GoalRelationGraphIssue | null;
}

export interface GoalsModuleOptions extends GoalsCommandContextOptions {
  personalPlanningMethodPacks?: readonly PlanningMethodPack[];
}

export class GoalsModule<TTransition> {
  readonly impacts: GoalsImpactApi;
  readonly repository: GoalsRepository;
  readonly commands: GoalsCommandApi<TTransition> & {
    normalizeRiskFacts: RiskCommands<TTransition>["normalizeRiskFacts"];
  };
  readonly lifecycle: GoalsLifecycleApi<TTransition> & Pick<
    GoalLifecycleCommands<TTransition>,
    | "reopenSatisfiedCompoundParent"
    | "markSatisfiedGoalForEvidenceRevalidation"
    | "reopenCompoundAncestorsForUntrustedChild"
    | "reconcileCompoundGoalAndAncestors"
    | "reconcileAllClosedCompoundGoals"
    | "reconcileCompoundAncestors"
    | "acceptDraft"
    | "applyAcceptedContractRevision"
    | "reopenForLifecycleFacts"
    | "satisfyForLifecycleFacts"
    | "setValidityState"
    | "closeAcceptedCompound"
  >;
  readonly planning: GoalsPlanningEngine;
  readonly query: GoalsQueryApi;

  constructor(
    db: GoalsSqliteDatabase,
    hooks: GoalsModuleHooks<TTransition>,
    options: GoalsModuleOptions = {},
  ) {
    this.repository = new GoalsRepository(db);
    const context = new GoalsCommandContext(this.repository, options);
    this.impacts = new GoalImpactCommands(context);
    const query = new GoalsQueryService(this.repository, options);
    this.planning = new GoalsPlanningEngine(
      context,
      options.personalPlanningMethodPacks,
    );
    let lifecycle!: GoalLifecycleCommands<TTransition>;
    const goals = new GoalCommands(context, {
      supersedePendingContractProposals: (...args) => hooks.supersedePendingContractProposals(...args),
      validateRelationGraph: hooks.validateRelationGraph,
      reopenSatisfiedCompoundParent: (...args) => lifecycle.reopenSatisfiedCompoundParent(...args),
      reconcileCompoundAncestors: (...args) => lifecycle.reconcileCompoundAncestors(...args),
      reopenCompoundAncestorsForUntrustedChild: (...args) =>
        lifecycle.reopenCompoundAncestorsForUntrustedChild(...args),
    });
    lifecycle = new GoalLifecycleCommands(context, hooks, {
      validateGoalInput: (input) => goals.validateGoalInput(input),
      transitionRevisionDependents: (input) => hooks.transitionRevisionDependents(input),
    });
    const risks = new RiskCommands(context, {
      currentActionToken: (...args) => hooks.currentActionToken(...args),
      authorizeRiskUpdate: (...args) => hooks.authorizeRiskUpdate(...args),
      authorizeRiskState: (...args) => hooks.authorizeRiskState(...args),
      reconcileLifecycle: (...args) => hooks.reconcileLifecycle(...args),
      reopenCompoundAncestorsForUntrustedChild: (...args) =>
        lifecycle.reopenCompoundAncestorsForUntrustedChild(...args),
    });
    const guidance = new GuidanceCommands(context);
    const confirmedPolicy = new ConfirmedPolicyCommands(context);
    const confirmedGoals = new ConfirmedGoalCommands(context, input => goals.validateGoalInput(input),
      input => lifecycle.acceptDraft(input));
    const confirmedRisks = new ConfirmedRiskCommands(context,
      (boardId, input) => risks.normalizeRiskFacts(boardId, input),
      (boardId, goalId, state, at) => lifecycle.setValidityState(boardId, goalId, state, at));
    const confirmedRelations = new ConfirmedRelationCommands(context, lifecycle);
    const acceptedRewireRelations = new AcceptedRewireRelations(context, lifecycle, this.planning);
    const boards = new GoalBoardCommands(context);
    this.commands = {
      initializeBoard: input => boards.initializeBoard(input),
      completeLegacyBoardImport: input => boards.completeLegacyBoardImport(input),
      setActiveGoal: (...args) => boards.setActiveGoal(...args),
      importLegacyCoverage: (boardId, rows) => new LegacyGoalCoverage(context).import(boardId, rows),
      applyAcceptedRewireRelations: input => acceptedRewireRelations.apply(input),
      registerAcceptedRisk: (facts, at) => confirmedRisks.registerAcceptedRisk(facts, at),
      registerAcceptedRewireRisk: (facts, actorId, at) => confirmedRisks.registerAcceptedRewireRisk(facts, actorId, at),
      registerAcceptedPolicy: input => confirmedPolicy.registerAcceptedPolicy(input),
      updateConfirmedDraft: input => confirmedGoals.updateConfirmedDraft(input),
      recordConfirmedDraftUpdate: input => confirmedGoals.recordConfirmedDraftUpdate(input),
      applyConfirmedRelations: input => confirmedRelations.applyConfirmedRelations(input),
      applyConfirmedRisk: input => confirmedRisks.applyConfirmedRisk(input),
      createConfirmedGoal: input => confirmedGoals.createConfirmedGoal(input),
      applyConfirmedPolicy: input => confirmedPolicy.applyConfirmedPolicy(input),
      createGoal: (boardId: string, input: CreateGoalInput, write: GoalsActorWrite) =>
        goals.createGoal(boardId, input, write),
      updateDraftGoal: (
        boardId: string,
        goalId: string,
        input: CreateGoalInput,
        write: GoalsActorWrite,
      ) => goals.updateDraftGoal(boardId, goalId, input, write),
      addRelation: (boardId: string, input: AddGoalRelationInput, write: GoalsActorWrite) =>
        goals.addRelation(boardId, input, write),
      deactivateRelation: (
        boardId: string,
        input: { relation_id: string; reason: string },
        write: GoalsActorWrite,
      ) => goals.deactivateRelation(boardId, input, write),
      setPolicy: (
        boardId: string,
        input: { goal_id?: string | null; policy: Partial<GoalPolicy>; reason: string },
        write: GoalsActorWrite,
      ) => goals.setPolicy(boardId, input, write),
      validateGoalInput: (input: CreateGoalInput) => goals.validateGoalInput(input),
      addRisk: (boardId: string, input: RiskFactsInput, write: GoalsActorWrite) =>
        risks.addRisk(boardId, input, write),
      updateRisk: (boardId: string, input: UpdateRiskInput, write: GoalsActorWrite) =>
        risks.updateRisk(boardId, input, write),
      setRiskState: (boardId: string, input: SetRiskStateInput, write: GoalsActorWrite) =>
        risks.setRiskState(boardId, input, write),
      normalizeRiskFacts: (boardId: string, input: Omit<RiskFactsInput, "risk_id">) =>
        risks.normalizeRiskFacts(boardId, input),
      addProjectGuidance: (input: AddProjectGuidanceInput) => guidance.add(input),
      updateProjectGuidance: (input: UpdateProjectGuidanceInput) => guidance.update(input),
    };
    this.lifecycle = lifecycle;
    this.query = {
      listBoardIds: () => query.listBoardIds(),
      listActivePolicyBindings: (...args) => query.listActivePolicyBindings(...args),
      listLegacyCoverage: boardId => query.listLegacyCoverage(boardId),
      listPolicyHistory: boardId => query.listPolicyHistory(boardId),
      listGoalRiskLinks: boardId => query.listGoalRiskLinks(boardId),
      listDependencies: (boardId, goalId) => query.listDependencies(boardId, goalId),
      listOpenGoalRisks: (boardId, goalId) => query.listOpenGoalRisks(boardId, goalId),
      activeReplacement: (boardId, goalId) => query.activeReplacement(boardId, goalId),
      listLifecycleEvents: boardId => query.listLifecycleEvents(boardId),
      listContractRevisions: boardId => query.listContractRevisions(boardId),
      listCoverageRevisions: boardId => query.listCoverageRevisions(boardId),
      getRelation: (boardId, relationId) => query.getRelation(boardId, relationId),
      policyBindingState: (boardId, bindingId) => query.policyBindingState(boardId, bindingId),
      criterionGoalId: criterionId => query.criterionGoalId(criterionId),
      policyBindingVersion: (boardId, bindingId, mode) => query.policyBindingVersion(boardId, bindingId, mode),
      getBoard: (boardId: string) => query.getBoard(boardId),
      getGoal: (boardId: string, goalId: string) => query.getGoal(boardId, goalId),
      hasGoalIdentity: goalId => query.hasGoalIdentity(goalId),
      listGoals: (boardId: string, queryOptions) => query.listGoals(boardId, queryOptions),
      listRelations: (boardId: string, goalId?: string) => query.listRelations(boardId, goalId),
      listTrashedGoals: (boardId: string) => query.listTrashedGoals(boardId),
      snapshot: (boardId: string) => query.snapshot(boardId),
      resolvePolicy: (boardId: string, goalId: string, strengthen?: Partial<GoalPolicy>) =>
        query.resolvePolicy(boardId, goalId, strengthen),
      readGoal: (boardId: string, goalId: string) => query.readGoal(boardId, goalId),
      getRisk: (boardId: string, riskId: string) => this.repository.getRisk(boardId, riskId),
      readProjectGuidance: (boardId: string) => query.readProjectGuidance(boardId),
    };
  }
}

export { GoalsCommandError, type GoalsErrorFactory } from "./errors.js";
export { GOAL_BOARDS_SCHEMA_SQL, GOALS_SCHEMA_SQL } from "./schema.js";
export { migrateRiskTreatmentPlan, migrateProjectGuidance, migrateProjectGuidanceRevisions } from "./guidance-migrations.js";
export { migrateGoalContractRevisionColumn, backfillGoalContractRevisions } from "./revision-migration.js";
export { GoalImpactCommands } from "./impact-commands.js";
export { GoalImpactRepository, GOAL_IMPACTS_SCHEMA_SQL, migrateGoalImpactHistory } from "./impact-repository.js";
export {
  GoalLifecycleCommands,
  type GoalRevalidationRunView,
  type GoalsLifecycleHooks,
} from "./lifecycle-commands.js";
export {
  GoalRevisionCommands,
  type AcceptDraftGoalInput,
  type AppliedGoalContractRevision,
  type ApplyAcceptedContractRevisionInput,
  type GoalRevisionDependentTransition,
  type GoalRevisionHooks,
} from "./lifecycle-revisions.js";
export {
  migrateActiveGoalLifecycle,
  migrateGoalArchiveSchema,
  migrateGoalContractCoverageSchema,
  migrateGoalLifecycleState,
  migratePlanningMethodPacksSchema,
  migrateGoalTrashSchema,
  type GoalLifecycleMigrationDatabase,
};
export {
  type GoalsRiskLifecycleHooks,
} from "./risk-commands.js";
export {
  GoalsPlanningEngine,
} from "./planning/engine.js";
export { GoalsQueryService, resolveGoalPolicy } from "./query.js";
export {
  analyzeGoalChangeImpact,
  planningMetrics,
  projectPlanningRelations,
  validatePlanningGraph,
  validatePlanningProposalGraph,
  type GoalChangeImpact,
  type PlanningGraphIssue,
  type PlanningMetric,
  type PlanningRelationChange,
} from "./planning/goal-graph.js";
export {
  loadPlanningMethodSources,
  parsePlanningMethodMarkdown,
  type ParsedPlanningMethodSource,
} from "./planning/method-catalog.js";
export {
  BUILTIN_PLANNING_METHOD_PACKS,
  PLANNING_METHOD_CATALOG_DIRECTORY,
  TASK_CONTEXT_METHOD_IDS,
  compilePlanningMethodInstructions,
  composePlanningMethodPacks,
  hydratePlanningMethodPack,
  loadBuiltinPlanningMethodPacks,
  mergedCoverageRules,
  methodPacksForReview,
  normalizePlanningMethodPack,
  resolvePlanningMethodPacks,
  validatePlanningMethodPack,
  type PlanningCoverageRule,
  type PlanningDependencyRule,
  type PlanningMethodComposition,
  type PlanningMethodKind,
  type PlanningMethodPack,
  type PlanningMethodPackInput,
  type PlanningMethodPath,
  type PlanningMethodScope,
  type ResolvedPlanningMethodPack,
} from "./planning/method-packs.js";
export {
  PRODUCT_PATH_AREAS,
  PRODUCT_PATH_AREA_LABELS,
  TASK_CONTEXT_AREAS,
  TASK_CONTEXT_LABELS,
  UNIVERSAL_RESULT_CHAIN_AREAS,
  goalProposalLeafReadinessIssues,
  readDecompositionReview,
  readLeafReadiness,
  type GoalDecompositionValidationContext,
  type GoalDecompositionValidationIssue,
  type ProductPathArea,
} from "./planning/decomposition-validation.js";
export {
  goalTreeProposalDecompositionIssues,
  recordedContractCoverageBlocksClosure,
} from "./planning/decomposition-coverage.js";
export type {
  GoalsPlanningApi,
  GoalsQueryApi,
  SaveProjectPlanningMethodInput,
  SetRiskStateInput,
  UpdateRiskInput,
} from "@adeptify/goalboard-contracts/modules/goals";
export { GoalsRepository, type GoalsSqliteDatabase } from "./repository.js";
export { GOAL_INPUT_BINDINGS_SCHEMA_SQL, GoalInputBindings } from "./input-bindings.js";
export { createPersonalPlanningMethodSchema, PersonalPlanningMethods, readPersonalPlanningMethods } from "./planning/personal-methods.js";

/** Read-only Module assembly; callers do not construct Goals repositories. */
export function createGoalReadServices(db: GoalsSqliteDatabase): {
  query: GoalsQueryApi; impacts: Pick<GoalsImpactApi, "list">;
} {
  const repository = new GoalsRepository(db);
  return { query: new GoalsQueryService(repository), impacts: new GoalImpactCommands(new GoalsCommandContext(repository)) };
}

export { DEFAULT_GOAL_POLICY } from "./query.js";
