import Database from "better-sqlite3";
import { GOALS_SCHEMA_SQL, migrateRiskTreatmentPlan, migrateProjectGuidance, migrateProjectGuidanceRevisions, migrateGoalContractRevisionColumn, backfillGoalContractRevisions } from "@adeptify/goalboard-module-goals";
import { GOAL_INPUT_BINDINGS_SCHEMA_SQL, GOAL_IMPACTS_SCHEMA_SQL, GoalImpactRepository, migrateGoalImpactHistory } from "@adeptify/goalboard-module-goals";
import {
  ARTIFACTS_SCHEMA_SQL,
  migrateArtifactsSchema,
  type ArtifactsSqliteDatabase,
} from "@adeptify/goalboard-module-artifacts";
import {
  EVIDENCE_SCHEMA_SQL,
  EvidenceRepository,
  evidenceCorrectionsMigrationRequired,
  migrateEvidenceContractRevisionColumns,
  migrateEvidenceCorrections,
  migrateEvidenceLocatorSource,
  migrateEvidenceLocatorValidation,
  migrateEvidenceLocatorWorkspace,
  type EvidenceMigrationDatabase,
  type EvidenceSqliteDatabase,
} from "@adeptify/goalboard-module-evidence-verification";
import {
  EXECUTION_SCHEMA_SQL,
  ExecutionRepository,
  migrateClarifierRoles,
  migrateExecutionActionColumns,
  migrateReviewerRunRoles,
  migrateUnifiedClaimRolesAndExclusivity,
  type ExecutionMigrationDatabase,
  type ExecutionSqliteDatabase,
} from "@adeptify/goalboard-module-execution";
import {
  GOVERNANCE_SCHEMA_SQL,
  GovernanceRepository,
  GovernanceClarificationStore,
  governanceLegacySupersessionMigrationRequired,
  governanceNarrativeMigrationRequired,
  migrateContractProposals,
  migrateGoalTreeLegacySupersession,
  migrateGoalTreeProposalDecisions,
  migrateGoalTreeProposalNarrative,
  migrateGoalTreeProposals,
  migrateReviewContractRevisionColumn,
  migrateRuntimeDialogueAuthority,
  type GovernanceSqliteDatabase,
} from "@adeptify/goalboard-module-governance-collaboration";
import {
  migrateActiveGoalLifecycle,
  migrateGoalArchiveSchema,
  migrateGoalContractCoverageSchema,
  migrateGoalLifecycleState,
  migratePlanningMethodPacksSchema,
  migrateGoalTrashSchema,
  GoalsRepository,
  GoalsQueryService,
  type GoalLifecycleMigrationDatabase,
} from "@adeptify/goalboard-module-goals";
import { migrateFeedTables, migrateInfoflowContractV2 } from "../feed/store.js";
import type { PlanningMethodPack } from "@adeptify/goalboard-contracts/modules/goals";
import type {
  BoardSnapshot,
  GoalPolicy,
  GoalRecord,

  ProjectGuidanceEntryRecord,
  ProjectGuidanceRevisionRecord,
} from "./types.js";

type Row = Record<string, unknown>;

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function number(value: unknown): number {
  return Number(value ?? 0);
}

export class SqliteGoalBoardStore {
  readonly db: Database.Database;

  constructor(readonly path: string) {
    this.db = new Database(path, { timeout: 5000 });
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  immediate<T>(fn: () => T): T {
    return this.db.transaction(fn).immediate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const applied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 1")
      .get();
    if (!applied) {
      this.immediate(() => {
      this.db.exec(`
        CREATE TABLE boards (
          board_id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          active_goal_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        ${GOALS_SCHEMA_SQL}

        ${GOAL_INPUT_BINDINGS_SCHEMA_SQL}

        ${GOAL_IMPACTS_SCHEMA_SQL}

        ${EXECUTION_SCHEMA_SQL}

        ${EVIDENCE_SCHEMA_SQL}

        ${GOVERNANCE_SCHEMA_SQL}

        ${ARTIFACTS_SCHEMA_SQL}

        CREATE TABLE clarification_sessions (
          session_id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
          goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
          claim_id TEXT REFERENCES claims(claim_id),
          run_id TEXT REFERENCES runs(run_id),
          rough_idea TEXT NOT NULL,
          state TEXT NOT NULL CHECK (state IN ('clarifying', 'proposal_ready', 'closed')),
          current_understanding TEXT,
          next_question TEXT,
          proposal_summary TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          closed_at TEXT
        );
        CREATE UNIQUE INDEX clarification_one_open_session_per_goal
          ON clarification_sessions(goal_id)
          WHERE state != 'closed';
        CREATE INDEX clarification_sessions_goal_idx
          ON clarification_sessions(board_id, goal_id, updated_at DESC, session_id);

        CREATE TABLE clarification_turns (
          turn_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES clarification_sessions(session_id) ON DELETE CASCADE,
          board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
          goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
          run_id TEXT REFERENCES runs(run_id),
          actor_id TEXT NOT NULL,
          turn_index INTEGER NOT NULL,
          turn_kind TEXT NOT NULL CHECK (turn_kind IN ('rough_idea', 'user_answer')),
          user_message TEXT NOT NULL,
          current_understanding TEXT,
          known_facts_json TEXT NOT NULL DEFAULT '[]',
          assumptions_json TEXT NOT NULL DEFAULT '[]',
          next_question TEXT,
          proposal_summary TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(session_id, turn_index)
        );
        CREATE INDEX clarification_turns_session_idx
          ON clarification_turns(session_id, turn_index, turn_id);

        CREATE TABLE idempotency_records (
          board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
          actor_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          outcome_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (board_id, actor_id, operation, idempotency_key)
        );

        CREATE TABLE events (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL UNIQUE,
          board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
          actor_id TEXT NOT NULL,
          type TEXT NOT NULL,
          object_type TEXT NOT NULL,
          object_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          at TEXT NOT NULL
        );
        CREATE INDEX events_board_idx ON events(board_id, seq);
      `);
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (1, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (2, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (3, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (4, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (5, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (6, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (7, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (8, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (9, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (10, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (11, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (12, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (13, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (14, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (15, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (16, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (17, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (18, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (19, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (20, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (21, ?)")
        .run(new Date().toISOString());
      migrateFeedTables(this.db);
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (22, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (23, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (24, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (25, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (26, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (27, ?)")
        .run(new Date().toISOString());
      migrateInfoflowContractV2(this.db);
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (28, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (29, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (30, ?)")
        .run(new Date().toISOString());
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (31, ?)")
        .run(new Date().toISOString());
      });
      return;
    }

    const clarifierRolesApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 2")
      .get();
    if (!clarifierRolesApplied) {
      migrateClarifierRoles(this.db as unknown as ExecutionMigrationDatabase);
    }
    const contractProposalsApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 3")
      .get();
    if (!contractProposalsApplied) {
      migrateContractProposals(this.db as unknown as GovernanceSqliteDatabase);
    }
    const goalArchiveApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 4")
      .get();
    if (!goalArchiveApplied) {
      migrateGoalArchiveSchema(this.db as unknown as GoalLifecycleMigrationDatabase);
    }
    const impactHistoryApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 5")
      .get();
    if (!impactHistoryApplied) migrateGoalImpactHistory(this.db, new Date().toISOString());
    const reviewerRunRolesApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 6")
      .get();
    if (!reviewerRunRolesApplied) {
      migrateReviewerRunRoles(this.db as unknown as ExecutionMigrationDatabase);
    }
    const unifiedClaimRolesApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 7")
      .get();
    if (!unifiedClaimRolesApplied) {
      migrateUnifiedClaimRolesAndExclusivity(this.db as unknown as ExecutionMigrationDatabase);
    }
    const clarificationDialogueApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 8")
      .get();
    if (!clarificationDialogueApplied) this.migrateClarificationDialogue();
    const goalTreeProposalsApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 9")
      .get();
    if (!goalTreeProposalsApplied) {
      migrateGoalTreeProposals(this.db as unknown as GovernanceSqliteDatabase);
    }
    const goalTreeProposalDecisionsApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 10")
      .get();
    if (!goalTreeProposalDecisionsApplied) {
      migrateGoalTreeProposalDecisions(this.db as unknown as GovernanceSqliteDatabase);
    }
    const goalTrashApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 11")
      .get();
    if (!goalTrashApplied) {
      migrateGoalTrashSchema(this.db as unknown as GoalLifecycleMigrationDatabase);
    }
    const lifecycleReconciliationApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 12")
      .get();
    if (!lifecycleReconciliationApplied) {
      migrateGoalLifecycleState(this.db as unknown as GoalLifecycleMigrationDatabase);
    }
    const activeGoalLifecycleApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 13")
      .get();
    if (!activeGoalLifecycleApplied) {
      migrateActiveGoalLifecycle(this.db as unknown as GoalLifecycleMigrationDatabase);
    }
    const runtimeDialogueAuthorityApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 14")
      .get();
    if (!runtimeDialogueAuthorityApplied) {
      migrateRuntimeDialogueAuthority(this.db as unknown as GovernanceSqliteDatabase);
    }
    const riskTreatmentPlanApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 15")
      .get();
    if (!riskTreatmentPlanApplied) migrateRiskTreatmentPlan(this.db);
    const planningMethodPacksApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 16")
      .get();
    if (!planningMethodPacksApplied) {
      migratePlanningMethodPacksSchema(this.db as unknown as GoalLifecycleMigrationDatabase);
    }
    if (evidenceCorrectionsMigrationRequired(this.db as unknown as EvidenceMigrationDatabase)) {
      migrateEvidenceCorrections(this.db as unknown as EvidenceMigrationDatabase);
    }
    const evidenceLocatorValidationApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 18")
      .get();
    if (!evidenceLocatorValidationApplied) {
      migrateEvidenceLocatorValidation(this.db as unknown as EvidenceMigrationDatabase);
    }
    const evidenceLocatorWorkspaceApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 19")
      .get();
    if (!evidenceLocatorWorkspaceApplied) {
      migrateEvidenceLocatorWorkspace(this.db as unknown as EvidenceMigrationDatabase);
    }
    const evidenceLocatorSourceApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 20")
      .get();
    if (!evidenceLocatorSourceApplied) {
      migrateEvidenceLocatorSource(this.db as unknown as EvidenceMigrationDatabase);
    }
    const contractCoverageApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 21")
      .get();
    const goalColumns = this.db.pragma("table_info(goals)") as Array<{ name: string }>;
    const riskColumns = this.db.pragma("table_info(risks)") as Array<{ name: string }>;
    if (
      !contractCoverageApplied ||
      !goalColumns.some((column) => column.name === "decomposition_review_json") ||
      !riskColumns.some((column) => column.name === "resolution_basis_json")
    ) {
      migrateGoalContractCoverageSchema(this.db as unknown as GoalLifecycleMigrationDatabase);
    }
    const feedWorkbenchApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 22")
      .get();
    if (!feedWorkbenchApplied) {
      this.immediate(() => {
        migrateFeedTables(this.db);
        this.db
          .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (22, ?)")
          .run(new Date().toISOString());
      });
    }
    const feedSourcesApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 23")
      .get();
    if (!feedSourcesApplied) {
      this.immediate(() => {
        migrateFeedTables(this.db);
        this.db
          .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (23, ?)")
          .run(new Date().toISOString());
      });
    }
    const feedReadStateApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 24")
      .get();
    if (!feedReadStateApplied) {
      this.immediate(() => {
        migrateFeedTables(this.db);
        this.db
          .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (24, ?)")
          .run(new Date().toISOString());
      });
    }
    const projectGuidanceApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 25")
      .get();
    const projectGuidanceTable = this.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'project_guidance_entries'")
      .get();
    if (!projectGuidanceApplied || !projectGuidanceTable) migrateProjectGuidance(this.db);
    const projectGuidanceRevisionsApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 26")
      .get();
    const projectGuidanceRevisionsTable = this.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'project_guidance_revisions'")
      .get();
    if (!projectGuidanceRevisionsApplied || !projectGuidanceRevisionsTable) {
      migrateProjectGuidanceRevisions(this.db);
    }
    const goalTreeProposalNarrativeApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 27")
      .get();
    if (
      !goalTreeProposalNarrativeApplied ||
      governanceNarrativeMigrationRequired(this.db as unknown as GovernanceSqliteDatabase)
    ) migrateGoalTreeProposalNarrative(this.db as unknown as GovernanceSqliteDatabase);
    const goalTreeLegacySupersessionApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 28")
      .get();
    if (
      !goalTreeLegacySupersessionApplied ||
      governanceLegacySupersessionMigrationRequired(this.db as unknown as GovernanceSqliteDatabase)
    ) migrateGoalTreeLegacySupersession(this.db as unknown as GovernanceSqliteDatabase);
    const infoflowContractApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 29")
      .get();
    const inboxEntriesTable = this.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'inbox_entries'")
      .get();
    const sourceColumns = this.db.pragma("table_info(feed_sources)") as Array<{ name: string }>;
    if (
      !infoflowContractApplied
      || !inboxEntriesTable
      || !sourceColumns.some((column) => column.name === "schedule_json")
    ) this.migrateInfoflowContract();
    const continuousActionModelApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 30")
      .get();
    const currentGoalColumns = this.db.pragma("table_info(goals)") as Array<{ name: string }>;
    if (
      !continuousActionModelApplied ||
      !currentGoalColumns.some((column) => column.name === "current_contract_revision")
    ) this.migrateContinuousActionModel();
    const artifactsApplied = this.db
      .prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 31")
      .get();
    const artifactsTable = this.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'artifacts'")
      .get();
    const artifactVersionsTable = this.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'artifact_versions'")
      .get();
    if (!artifactsApplied || !artifactsTable || !artifactVersionsTable) {
      migrateArtifactsSchema(this.db as unknown as ArtifactsSqliteDatabase);
    }
  }

  private migrateContinuousActionModel(): void {
    this.immediate(() => {
      migrateGoalContractRevisionColumn(this.db);
      migrateExecutionActionColumns(this.db as unknown as ExecutionMigrationDatabase);
      migrateEvidenceContractRevisionColumns(this.db as unknown as EvidenceMigrationDatabase);
      migrateReviewContractRevisionColumn(this.db as unknown as GovernanceSqliteDatabase);
      backfillGoalContractRevisions(this.db);
      this.db
        .prepare("INSERT OR IGNORE INTO schema_migrations (migration_id, applied_at) VALUES (30, ?)")
        .run(new Date().toISOString());
    });
  }

  private migrateClarificationDialogue(): void {
    this.immediate(() => {
      this.db.exec(`
        CREATE TABLE clarification_sessions (
          session_id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
          goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
          claim_id TEXT REFERENCES claims(claim_id),
          run_id TEXT REFERENCES runs(run_id),
          rough_idea TEXT NOT NULL,
          state TEXT NOT NULL CHECK (state IN ('clarifying', 'proposal_ready', 'closed')),
          current_understanding TEXT,
          next_question TEXT,
          proposal_summary TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          closed_at TEXT
        );
        CREATE UNIQUE INDEX clarification_one_open_session_per_goal
          ON clarification_sessions(goal_id)
          WHERE state != 'closed';
        CREATE INDEX clarification_sessions_goal_idx
          ON clarification_sessions(board_id, goal_id, updated_at DESC, session_id);

        CREATE TABLE clarification_turns (
          turn_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES clarification_sessions(session_id) ON DELETE CASCADE,
          board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
          goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
          run_id TEXT REFERENCES runs(run_id),
          actor_id TEXT NOT NULL,
          turn_index INTEGER NOT NULL,
          turn_kind TEXT NOT NULL CHECK (turn_kind IN ('rough_idea', 'user_answer')),
          user_message TEXT NOT NULL,
          current_understanding TEXT,
          known_facts_json TEXT NOT NULL DEFAULT '[]',
          assumptions_json TEXT NOT NULL DEFAULT '[]',
          next_question TEXT,
          proposal_summary TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(session_id, turn_index)
        );
        CREATE INDEX clarification_turns_session_idx
          ON clarification_turns(session_id, turn_index, turn_id);
      `);
      this.db
        .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (8, ?)")
        .run(new Date().toISOString());
      });
  }

  private migrateInfoflowContract(): void {
    this.immediate(() => {
      migrateInfoflowContractV2(this.db);
      this.db
        .prepare("INSERT OR IGNORE INTO schema_migrations (migration_id, applied_at) VALUES (29, ?)")
        .run(new Date().toISOString());
    });
  }

  eventCursor(boardId: string): number {
    const row = this.db
      .prepare("SELECT COALESCE(MAX(seq), 0) AS cursor FROM events WHERE board_id = ?")
      .get(boardId) as Row;
    return number(row.cursor);
  }

  appendEvent(input: {
    eventId: string;
    boardId: string;
    actorId: string;
    type: string;
    objectType: string;
    objectId: string;
    reason: string;
    payload: unknown;
    at: string;
  }): number {
    const result = this.db
      .prepare(`
        INSERT INTO events (
          event_id, board_id, actor_id, type, object_type, object_id, reason, payload_json, at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.eventId,
        input.boardId,
        input.actorId,
        input.type,
        input.objectType,
        input.objectId,
        input.reason,
        json(input.payload),
        input.at,
      );
    return Number(result.lastInsertRowid);
  }

  getIdempotency(
    boardId: string,
    actorId: string,
    operation: string,
    key: string,
  ): { request_hash: string; outcome: unknown } | null {
    const row = this.db
      .prepare(`
        SELECT request_hash, outcome_json FROM idempotency_records
        WHERE board_id = ? AND actor_id = ? AND operation = ? AND idempotency_key = ?
      `)
      .get(boardId, actorId, operation, key) as Row | undefined;
    if (!row) return null;
    return {
      request_hash: text(row.request_hash),
      outcome: parseJson(row.outcome_json, null),
    };
  }

  putIdempotency(input: {
    boardId: string;
    actorId: string;
    operation: string;
    key: string;
    requestHash: string;
    outcome: unknown;
    at: string;
  }): void {
    this.db
      .prepare(`
        INSERT INTO idempotency_records (
          board_id, actor_id, operation, idempotency_key, request_hash, outcome_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.boardId,
        input.actorId,
        input.operation,
        input.key,
        input.requestHash,
        json(input.outcome),
        input.at,
      );
  }

  getGoal(goalId: string): GoalRecord | null {
    return new GoalsRepository(this.db as unknown as GoalLifecycleMigrationDatabase).getGoal(goalId);
  }

  listGoals(boardId: string): GoalRecord[] {
    return this.goalsQuery().listGoals(boardId);
  }

  listTrashedGoals(boardId: string): GoalRecord[] {
    return this.goalsQuery().listTrashedGoals(boardId);
  }

  listPlanningMethodPacks(boardId: string): PlanningMethodPack[] {
    return new GoalsRepository(this.db as unknown as GoalLifecycleMigrationDatabase)
      .listPlanningMethodPacks(boardId);
  }

  listProjectGuidanceEntries(boardId: string, includeInactive = false): ProjectGuidanceEntryRecord[] {
    return new GoalsRepository(this.db as unknown as GoalLifecycleMigrationDatabase)
      .listProjectGuidanceEntries(boardId, includeInactive);
  }

  listProjectGuidanceRevisions(boardId: string): ProjectGuidanceRevisionRecord[] {
    return new GoalsRepository(this.db as unknown as GoalLifecycleMigrationDatabase)
      .listProjectGuidanceRevisions(boardId);
  }

  snapshot(boardId: string): BoardSnapshot {
    const goals = this.goalsQuery().snapshot(boardId);
    const execution = new ExecutionRepository(this.db as unknown as ExecutionSqliteDatabase);
    const evidence = new EvidenceRepository(this.db as unknown as EvidenceSqliteDatabase);
    const governance = new GovernanceRepository(this.db as unknown as GovernanceSqliteDatabase)
      .snapshot(boardId);
    return {
      board: goals.board,
      cursor: goals.observed_event_cursor,
      goals: goals.goals,
      relations: goals.relations,
      impacts: new GoalImpactRepository(this.db).list(boardId),
      risks: goals.risks,
      goal_risks: goals.goal_risks,
      claims: execution.listClaims(boardId),
      runs: execution.listRuns(boardId),
      evidence: evidence.listEvidence(boardId),
      evidence_corrections: evidence.listCorrections(boardId),
      review_obligations: governance.review_obligations,
      reviews: governance.reviews,
      goal_contract_revisions: this.goalsQuery().listContractRevisions(boardId),
      coverage_contract_revisions: this.goalsQuery().listCoverageRevisions(boardId),
      lifecycle_events: [
        ...this.goalsQuery().listLifecycleEvents(boardId), ...execution.listLifecycleEvents(boardId),
        ...evidence.listLifecycleEvents(boardId),
        ...new GovernanceRepository(this.db as unknown as GovernanceSqliteDatabase).listLifecycleEvents(boardId),
      ].sort((left, right) => left.seq - right.seq),
      candidates: governance.candidates,
      contract_proposals: governance.contract_proposals,
      rewires: governance.rewires,
      clarification_sessions: new GovernanceClarificationStore(this.db).listSessions(boardId),
      clarification_turns: new GovernanceClarificationStore(this.db).listTurns(boardId),
      goal_tree_proposals: governance.goal_tree_proposals,
      planning_method_packs: goals.planning_method_packs,
      project_guidance: goals.project_guidance,
    };
  }

  activePolicyRows(boardId: string, goalId: string): Array<{
    scope: string;
    goal_id: string | null;
    policy: Partial<GoalPolicy>;
  }> {
    return new GoalsRepository(this.db as unknown as GoalLifecycleMigrationDatabase)
      .listActivePolicyBindings(boardId, goalId);
  }

  /** Load active policy inputs once for board-wide projections such as Available. */
  activePolicyRowsForBoard(boardId: string): Array<{
    scope: string;
    goal_id: string | null;
    policy: Partial<GoalPolicy>;
  }> {
    return new GoalsRepository(this.db as unknown as GoalLifecycleMigrationDatabase)
      .listActivePolicyBindings(boardId);
  }

  private goalsQuery(): GoalsQueryService {
    return new GoalsQueryService(
      new GoalsRepository(this.db as unknown as GoalLifecycleMigrationDatabase),
    );
  }
}



export const sqliteJson = json;
