import type {
  GovernanceApplicationApi,
  GovernanceQueryApi,
  GovernanceRecordsApi,
} from "@adeptify/goalboard-contracts/modules/governance-collaboration";

import {
  GovernanceRepository,
  type GovernanceSqliteDatabase,
} from "./repository.js";
import {
  GovernanceReviewLifecycle,
  type GovernanceReviewLifecycleOptions,
} from "./review-lifecycle.js";
import { GovernanceRecordStore } from "./record-store.js";
import { GovernanceProvenance } from "./provenance.js";
import { GovernanceClarificationStore } from "./clarification-store.js";
import { GovernanceDecisionTransactions } from "./decision-transactions.js";
import { GovernanceEventDecisions } from "./event-decisions.js";
export { GovernanceClarificationStore } from "./clarification-store.js";

export const packageDescriptor = {
  packageName: "@adeptify/goalboard-module-governance-collaboration",
  packagePath: "modules/governance-collaboration",
  kind: "module",
  maturity: "partial",
  contract: "@adeptify/goalboard-contracts/modules/governance-collaboration",
  migrationGoals: ["goal-reorg-f2","goal-reorg-ex3","goal-reorg-ex4"],
  ssot: "docs/SSOT-MATRIX.md",
  capabilities: [
    "governance.review-obligations.v1",
    "governance.reviews.v1",
    "governance.proposals.v1",
    "governance.decisions.v1",
  ],
} as const;

export type GoalBoardPackageDescriptor = typeof packageDescriptor;

export interface GovernanceCollaborationModuleOptions extends GovernanceReviewLifecycleOptions {
  db: GovernanceSqliteDatabase;
}

export class GovernanceCollaborationModule implements GovernanceApplicationApi {
  readonly clarification: GovernanceClarificationStore;
  readonly provenance: GovernanceProvenance;
  readonly repository: GovernanceRepository;
  readonly reviews: GovernanceReviewLifecycle;
  readonly records: GovernanceRecordsApi;
  readonly decisions: GovernanceApplicationApi["decisions"];
  readonly eventDecisions: GovernanceApplicationApi["eventDecisions"];
  readonly query: GovernanceQueryApi;

  constructor(options: GovernanceCollaborationModuleOptions) {
    this.clarification = new GovernanceClarificationStore(options.db, options.now, options.errorFactory);
    this.provenance = new GovernanceProvenance(options.errorFactory);
    this.repository = new GovernanceRepository(options.db);
    this.reviews = new GovernanceReviewLifecycle(this.repository, options);
    this.records = new GovernanceRecordStore(options.db, options.errorFactory);
    this.decisions = new GovernanceDecisionTransactions(options.db);
    this.eventDecisions = new GovernanceEventDecisions(
      options.db,
      options.now,
      options.errorFactory,
    );
    this.query = governanceQueries(this.repository);
  }
}

export { GovernanceError, type GovernanceErrorFactory } from "./errors.js";
export { GovernanceProvenance } from "./provenance.js";
export {
  json as governanceJson,
  mapCandidate,
  mapContractProposal,
  mapGoalTreeProposal,
  mapGoalTreeProposalDecision,
  mapGoalTreeProposalItem,
  mapReview,
  mapReviewObligation,
  mapRewire,
  parseJson as parseGovernanceJson,
} from "./mappers.js";
export {
  GOVERNANCE_SCHEMA_SQL,
  createGovernanceSchema,
  type GovernanceSchemaDatabase,
} from "./schema.js";
export {
  GovernanceEventDecisions,
  GOAL_EVENT_TRUSTED_DECISIONS_SQL,
  migrateGoalEventTrustedDecisions,
} from "./event-decisions.js";
export {
  GovernanceRepository,
  type GovernanceSqliteDatabase,
  type GovernanceSqliteStatement,
} from "./repository.js";
export {
  GovernanceReviewLifecycle,
  type GovernanceReviewLifecycleOptions,
} from "./review-lifecycle.js";
export {
  GovernanceRecordStore,
} from "./record-store.js";
export {
  governanceLegacySupersessionMigrationRequired,
  governanceNarrativeMigrationRequired,
  migrateContractProposals,
  migrateGoalTreeLegacySupersession,
  migrateGoalTreeProposalDecisions,
  migrateGoalTreeProposalNarrative,
  migrateGoalTreeProposals,
  migrateReviewContractRevisionColumn,
  migrateRuntimeDialogueAuthority,
} from "./migrations.js";
export { assertGovernanceTransition, deriveGoalTreeProposalState } from "./state-machine.js";

export { CLARIFICATION_SCHEMA_SQL, migrateClarificationDialogue } from "./clarification-schema.js";

function governanceQueries(repository: GovernanceRepository): GovernanceQueryApi {
  return {
      hasCandidateBootstrap: (boardId, candidateId, goalId, proposalId) =>
        repository.hasCandidateBootstrap(boardId, candidateId, goalId, proposalId),
      listLifecycleEvents: boardId => repository.listLifecycleEvents(boardId),
      eventCursor: (boardId) => repository.eventCursor(boardId),
      snapshot: (boardId) => repository.snapshot(boardId),
      getReviewObligation: (boardId, obligationId) =>
        repository.getReviewObligation(boardId, obligationId),
      listReviewObligations: (boardId, goalId) =>
        repository.listReviewObligations(boardId, goalId),
      listReviews: (boardId, goalId) => repository.listReviews(boardId, goalId),
      getCandidate: (boardId, candidateId) => repository.getCandidate(boardId, candidateId),
      getContractProposal: (boardId, proposalId) =>
        repository.getContractProposal(boardId, proposalId),
      getRewire: (boardId, rewireId) => repository.getRewire(boardId, rewireId),
      getGoalTreeProposal: (boardId, proposalId) =>
        repository.getGoalTreeProposal(boardId, proposalId),
      listGoalTreeProposals: (boardId) => repository.listGoalTreeProposals(boardId),
      latestNeedsChangesReviewEventSeq: (boardId, goalId) =>
        repository.latestNeedsChangesReviewEventSeq(boardId, goalId),
    };
}

export function createGovernanceReadServices(db: GovernanceSqliteDatabase): {
  query: GovernanceQueryApi;
  clarification: Pick<GovernanceApplicationApi["clarification"], "listSessions" | "listTurns">;
} {
  const clarification = new GovernanceClarificationStore(db);
  return { query: governanceQueries(new GovernanceRepository(db)), clarification };
}
