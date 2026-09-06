import type { SqliteDatabase } from "./sqlite.js";

/** Technical schema bookkeeping; Module code retains table and migration semantics. */
export class SqliteSchema {
  constructor(private readonly db: SqliteDatabase) {}
  initialize(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL
    );`);
  }
  hasMigration(id: number): boolean {
    return Boolean(this.db.prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = ?").get(id));
  }
  recordMigration(id: number, at: string, ifAbsent = false): void {
    this.db.prepare(ifAbsent
      ? "INSERT OR IGNORE INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)"
      : "INSERT INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)").run(id, at);
  }
  hasTable(name: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
  }
  columns(table: string): Array<{ name: string }> {
    return this.db.prepare("SELECT name FROM pragma_table_info(?)").all(table) as Array<{ name: string }>;
  }
}

/** Existing opaque search state; Storage does not interpret its contents. */
export const LOCAL_OPAQUE_BLOB_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS feed_runtime_blobs (
    namespace TEXT NOT NULL, key TEXT NOT NULL, opaque TEXT NOT NULL, cas_token TEXT NOT NULL,
    PRIMARY KEY (namespace, key)
  );
`;
