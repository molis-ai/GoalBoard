import type { GoalLifecycleMigrationDatabase } from "./migrations.js";

export const GOAL_EVENT_STATE_MIGRATION_ID = 33;
export const GOAL_EVENT_OWNER_CONTINUE_MIGRATION_ID = 34;
export const GOAL_EVENT_AGREEMENT_CHANGE_MIGRATION_ID = 35;
export const GOAL_EVENT_WORKFLOW_MIGRATION_ID = 36;

export const GOAL_EVENT_STATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS goal_event_state_owners (
    board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
    owner TEXT NOT NULL CHECK (owner = 'event_work'),
    source TEXT NOT NULL CHECK (source IN ('intent', 'configuration', 'continue', 'migration')),
    adopted_at TEXT NOT NULL,
    adopted_by TEXT NOT NULL,
    PRIMARY KEY (goal_id)
  );
  CREATE INDEX IF NOT EXISTS goal_event_state_owners_board_idx
    ON goal_event_state_owners(board_id, goal_id);

  CREATE TABLE IF NOT EXISTS goal_event_agreements (
    board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    event_id TEXT,
    PRIMARY KEY (board_id, goal_id, version)
  );

  CREATE TABLE IF NOT EXISTS goal_event_progress_summaries (
    summary_id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    based_on_cursor INTEGER NOT NULL,
    next_step TEXT,
    next_actor TEXT,
    actor_id TEXT NOT NULL,
    recorded_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS goal_event_progress_summaries_goal_idx
    ON goal_event_progress_summaries(board_id, goal_id, recorded_at);

  CREATE TABLE IF NOT EXISTS goal_event_concerns (
    concern_id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    statement TEXT NOT NULL,
    scope_json TEXT NOT NULL,
    blocks_closure INTEGER NOT NULL CHECK (blocks_closure IN (0, 1)),
    status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'accepted', 'overturned')),
    resolution_reason TEXT,
    resolution_event_id TEXT,
    cited_decision_id TEXT,
    previous_status TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS goal_event_concerns_goal_idx
    ON goal_event_concerns(board_id, goal_id, status);

  CREATE TABLE IF NOT EXISTS goal_event_decision_requests (
    request_id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,
    scope_json TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'suggestion' CHECK (purpose IN ('suggestion', 'requirement_acceptance', 'action', 'agreement_change')),
    proposed_change_json TEXT,
    commitment_json TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'decided')),
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS goal_event_decision_requests_goal_idx
    ON goal_event_decision_requests(board_id, goal_id, status);

  CREATE TABLE IF NOT EXISTS goal_event_applied_decisions (
    decision_id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
    governance_decision_id TEXT NOT NULL,
    request_id TEXT,
    event_id TEXT NOT NULL,
    selected_option_id TEXT,
    conclusion TEXT NOT NULL,
    accepts_requirements INTEGER NOT NULL CHECK (accepts_requirements IN (0, 1)),
    effects_json TEXT NOT NULL DEFAULT '[]',
    scope_json TEXT NOT NULL,
    commitment_json TEXT NOT NULL DEFAULT '{"outcome":"","requirements":[]}',
    authorized_change_json TEXT,
    config_version INTEGER,
    agreement_version INTEGER,
    actor_id TEXT NOT NULL,
    authority_source TEXT NOT NULL CHECK (authority_source IN ('web', 'management')),
    recorded_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS goal_event_applied_decisions_goal_idx
    ON goal_event_applied_decisions(board_id, goal_id, recorded_at);

  CREATE TABLE IF NOT EXISTS goal_event_requirement_conclusions (
    board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
    requirement_id TEXT NOT NULL,
    decision_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('accepted', 'rejected')),
    received_at TEXT NOT NULL,
    journal_seq INTEGER NOT NULL,
    PRIMARY KEY (board_id, goal_id, requirement_id, decision_id)
  );
  CREATE INDEX IF NOT EXISTS goal_event_requirement_conclusions_latest_idx
    ON goal_event_requirement_conclusions(board_id, goal_id, requirement_id, journal_seq);

  CREATE TABLE IF NOT EXISTS goal_event_closures (
    closure_id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('complete', 'cancel')),
    result TEXT,
    reason TEXT NOT NULL,
    completion_applied INTEGER NOT NULL CHECK (completion_applied IN (0, 1)),
    expected_config_version INTEGER NOT NULL,
    expected_agreement_version INTEGER NOT NULL DEFAULT 0,
    config_version INTEGER,
    agreement_version INTEGER,
    unmet_reasons_json TEXT NOT NULL DEFAULT '[]',
    superseded INTEGER NOT NULL CHECK (superseded IN (0, 1)),
    superseded_reason TEXT,
    recorded_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS goal_event_closures_goal_idx
    ON goal_event_closures(board_id, goal_id, recorded_at);

  CREATE TABLE IF NOT EXISTS goal_event_work_status (
    board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
    work_status TEXT NOT NULL CHECK (work_status IN ('open', 'completed', 'cancelled')),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (goal_id)
  );
`;

export function migrateGoalEventStateSchema(
  db: GoalLifecycleMigrationDatabase,
  now: () => Date = () => new Date(),
): void {
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(GOAL_EVENT_STATE_SCHEMA_SQL);
      expandWorkEventKinds(db);
      ensureGoalEventDecisionAuthorizationColumns(db);
      backfillEventStateOwners(db);
      db.prepare("INSERT OR IGNORE INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)")
        .run(GOAL_EVENT_STATE_MIGRATION_ID, now().toISOString());
    }).immediate();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

export function ensureGoalEventDecisionAuthorizationColumns(db: {
  prepare(sql: string): { all(): unknown[] };
  exec(sql: string): unknown;
}): void {
  const decisionColumns = db.prepare("PRAGMA table_info(goal_event_applied_decisions)").all() as Array<{ name: string }>;
  if (decisionColumns.length && !decisionColumns.some((column) => column.name === "effects_json")) {
    db.exec("ALTER TABLE goal_event_applied_decisions ADD COLUMN effects_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (decisionColumns.length && !decisionColumns.some((column) => column.name === "commitment_json")) {
    db.exec("ALTER TABLE goal_event_applied_decisions ADD COLUMN commitment_json TEXT NOT NULL DEFAULT '{\"outcome\":\"\",\"requirements\":[]}'");
  }
  const closureColumns = db.prepare("PRAGMA table_info(goal_event_closures)").all() as Array<{ name: string }>;
  if (closureColumns.length && !closureColumns.some((column) => column.name === "expected_agreement_version")) {
    db.exec("ALTER TABLE goal_event_closures ADD COLUMN expected_agreement_version INTEGER");
  }
}

export function ensureGoalEventAgreementChangeColumns(db: {
  prepare(sql: string): { all(): unknown[] };
  exec(sql: string): unknown;
}): void {
  const requestColumns = db.prepare("PRAGMA table_info(goal_event_decision_requests)").all() as Array<{ name: string }>;
  if (requestColumns.length && !requestColumns.some((column) => column.name === "purpose")) {
    db.exec("ALTER TABLE goal_event_decision_requests ADD COLUMN purpose TEXT NOT NULL DEFAULT 'suggestion'");
  }
  if (requestColumns.length && !requestColumns.some((column) => column.name === "proposed_change_json")) {
    db.exec("ALTER TABLE goal_event_decision_requests ADD COLUMN proposed_change_json TEXT");
  }
  if (requestColumns.length && !requestColumns.some((column) => column.name === "commitment_json")) {
    db.exec("ALTER TABLE goal_event_decision_requests ADD COLUMN commitment_json TEXT");
  }
  const decisionColumns = db.prepare("PRAGMA table_info(goal_event_applied_decisions)").all() as Array<{ name: string }>;
  if (decisionColumns.length && !decisionColumns.some((column) => column.name === "authorized_change_json")) {
    db.exec("ALTER TABLE goal_event_applied_decisions ADD COLUMN authorized_change_json TEXT");
  }
}

export function migrateGoalEventAgreementChange(
  db: GoalLifecycleMigrationDatabase,
  now: () => Date = () => new Date(),
): void {
  db.transaction(() => {
    ensureGoalEventAgreementChangeColumns(db);
    db.prepare("INSERT OR IGNORE INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)")
      .run(GOAL_EVENT_AGREEMENT_CHANGE_MIGRATION_ID, now().toISOString());
  }).immediate();
}

function expandWorkEventKinds(db: GoalLifecycleMigrationDatabase): void {
  const sql = String(
    (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'goal_work_events'").get() as { sql?: string } | undefined)?.sql ?? "",
  );
  if (!sql || sql.includes("'system'")) return;
  const judgmentTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'goal_work_event_judgments'",
  ).get() as { name?: string } | undefined;
  db.exec(`
    CREATE TABLE IF NOT EXISTS goal_work_event_judgments_keep (
      event_id TEXT NOT NULL,
      requirement_id TEXT NOT NULL,
      verdict TEXT NOT NULL,
      PRIMARY KEY (event_id, requirement_id)
    );
    DELETE FROM goal_work_event_judgments_keep;
    ${judgmentTable ? "INSERT INTO goal_work_event_judgments_keep SELECT event_id, requirement_id, verdict FROM goal_work_event_judgments;" : ""}
    CREATE TABLE goal_work_events_next (
      event_id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
      goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('configuration', 'report', 'system')),
      type_id TEXT,
      type_version INTEGER,
      title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_kind TEXT,
      received_at TEXT NOT NULL,
      journal_seq INTEGER NOT NULL,
      config_version INTEGER
    );
    INSERT INTO goal_work_events_next SELECT * FROM goal_work_events;
    DROP TABLE goal_work_events;
    ALTER TABLE goal_work_events_next RENAME TO goal_work_events;
    CREATE INDEX IF NOT EXISTS goal_work_events_goal_seq_idx
      ON goal_work_events(board_id, goal_id, journal_seq);
    INSERT OR IGNORE INTO goal_work_event_judgments (event_id, requirement_id, verdict)
      SELECT event_id, requirement_id, verdict FROM goal_work_event_judgments_keep;
    DROP TABLE goal_work_event_judgments_keep;
  `);
}

function backfillEventStateOwners(db: GoalLifecycleMigrationDatabase): void {
  db.exec(`
    INSERT OR IGNORE INTO goal_event_state_owners (
      board_id, goal_id, owner, source, adopted_at, adopted_by
    )
    SELECT board_id, goal_id, 'event_work', 'configuration', updated_at, updated_by
    FROM goal_event_configs;

    INSERT OR IGNORE INTO goal_event_work_status (board_id, goal_id, work_status, updated_at)
    SELECT board_id, goal_id, 'open', adopted_at FROM goal_event_state_owners;
  `);
}

export function migrateGoalEventOwnerContinueSource(
  db: GoalLifecycleMigrationDatabase,
  now: () => Date = () => new Date(),
): void {
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      const sql = String(
        (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'goal_event_state_owners'").get() as { sql?: string } | undefined)?.sql ?? "",
      );
      if (sql && !sql.includes("'continue'")) {
        db.exec(`
          CREATE TABLE goal_event_state_owners_next (
            board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
            goal_id TEXT NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,
            owner TEXT NOT NULL CHECK (owner = 'event_work'),
            source TEXT NOT NULL CHECK (source IN ('intent', 'configuration', 'continue')),
            adopted_at TEXT NOT NULL,
            adopted_by TEXT NOT NULL,
            PRIMARY KEY (goal_id)
          );
          INSERT INTO goal_event_state_owners_next SELECT * FROM goal_event_state_owners;
          DROP TABLE goal_event_state_owners;
          ALTER TABLE goal_event_state_owners_next RENAME TO goal_event_state_owners;
          CREATE INDEX IF NOT EXISTS goal_event_state_owners_board_idx
            ON goal_event_state_owners(board_id, goal_id);
        `);
      }
      db.prepare("INSERT OR IGNORE INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)")
        .run(GOAL_EVENT_OWNER_CONTINUE_MIGRATION_ID, now().toISOString());
    }).immediate();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}
