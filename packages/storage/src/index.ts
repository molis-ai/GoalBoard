/** Local SQLite technical owner. */
export const packageDescriptor = {
  packageName: "@adeptify/goalboard-storage",
  packagePath: "packages/storage",
  kind: "foundation",
  maturity: "partial",
  contract: "@adeptify/goalboard-contracts/platform/storage",
  migrationGoals: ["goal-reorg-f2","goal-reorg-ap2"],
  ssot: "docs/SSOT-MATRIX.md",
  capabilities: [],
} as const;

export type GoalBoardPackageDescriptor = typeof packageDescriptor;

export { LocalSqliteJournal, LocalSqliteStorage, LOCAL_JOURNAL_SCHEMA_SQL, type SqliteDatabase } from "./sqlite.js";

export { SqliteSchema, LOCAL_OPAQUE_BLOB_SCHEMA_SQL } from "./schema.js";
