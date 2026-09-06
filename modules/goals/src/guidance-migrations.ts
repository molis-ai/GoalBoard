import type { GoalLifecycleMigrationDatabase } from "./migrations.js";

export function migrateRiskTreatmentPlan(db: GoalLifecycleMigrationDatabase): void {
  db.transaction(() => {
    const columns = db.pragma("table_info(risks)") as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "treatment_plan")) {
      db.exec("ALTER TABLE risks ADD COLUMN treatment_plan TEXT NOT NULL DEFAULT ''");
    }
    db
      .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (15, ?)")
      .run(new Date().toISOString());
  }).immediate();
}

export function migrateProjectGuidance(db: GoalLifecycleMigrationDatabase): void {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_guidance_entries (
        guidance_id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        kind TEXT NOT NULL CHECK (kind IN ('context', 'requirement', 'constraint', 'convention', 'workflow', 'quality_bar')),
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        source_refs_json TEXT NOT NULL DEFAULT '[]',
        created_by TEXT NOT NULL,
        confirmation_summary TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(board_id, position),
        UNIQUE(board_id, kind, content_hash)
      );
      CREATE INDEX IF NOT EXISTS project_guidance_board_idx
        ON project_guidance_entries(board_id, position, guidance_id);
    `);
    db
      .prepare("INSERT OR IGNORE INTO schema_migrations (migration_id, applied_at) VALUES (25, ?)")
      .run(new Date().toISOString());
  }).immediate();
}

export function migrateProjectGuidanceRevisions(db: GoalLifecycleMigrationDatabase): void {
  db.transaction(() => {
    const columns = db.pragma("table_info(project_guidance_entries)") as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has("revision")) {
      db.exec("ALTER TABLE project_guidance_entries ADD COLUMN revision INTEGER NOT NULL DEFAULT 1");
    }
    if (!names.has("active")) {
      db.exec("ALTER TABLE project_guidance_entries ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))");
    }
    if (!names.has("updated_by")) {
      db.exec("ALTER TABLE project_guidance_entries ADD COLUMN updated_by TEXT");
    }
    if (!names.has("updated_at")) {
      db.exec("ALTER TABLE project_guidance_entries ADD COLUMN updated_at TEXT");
    }
    db.exec(`
      UPDATE project_guidance_entries
      SET updated_by = COALESCE(updated_by, created_by),
          updated_at = COALESCE(updated_at, created_at);

      CREATE TABLE IF NOT EXISTS project_guidance_revisions (
        revision_id TEXT PRIMARY KEY,
        guidance_id TEXT NOT NULL REFERENCES project_guidance_entries(guidance_id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('context', 'requirement', 'constraint', 'convention', 'workflow', 'quality_bar')),
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        source_refs_json TEXT NOT NULL DEFAULT '[]',
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        changed_by TEXT NOT NULL,
        change_kind TEXT NOT NULL CHECK (change_kind IN ('created', 'edited', 'deactivated', 'restored')),
        confirmation_summary TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(guidance_id, revision)
      );
      CREATE INDEX IF NOT EXISTS project_guidance_revisions_board_idx
        ON project_guidance_revisions(board_id, guidance_id, revision DESC);

      INSERT OR IGNORE INTO project_guidance_revisions (
        revision_id, guidance_id, board_id, revision, kind, content, content_hash,
        source_refs_json, active, changed_by, change_kind, confirmation_summary, reason, created_at
      )
      SELECT 'migration:' || guidance_id || ':1', guidance_id, board_id, 1, kind, content,
        content_hash, source_refs_json, 1, created_by, 'created', confirmation_summary, reason, created_at
      FROM project_guidance_entries;
    `);
    db
      .prepare("INSERT OR IGNORE INTO schema_migrations (migration_id, applied_at) VALUES (26, ?)")
      .run(new Date().toISOString());
  }).immediate();
}
