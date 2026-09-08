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
export { LocalCatalogMetadata } from "./catalog-metadata.js";

export { atomicWriteFileSync } from "./adapters/atomic-write.js";

export { runWithGoalBoardHome, resolveGoalBoardHome, resolveFeedSecurityDirectory } from "./adapters/local-security-paths.js";

export { type SecretStore, type SecretStoreBackendKind, type SecretStoreBackendInfo, type SecretStoreMigrationResult, holdSecretsLockForTest, isLegacyEnvelope, sealLegacyForTest, assertNotReversibleBase64Only, safeEqualString, createFileSecretStore, resetSecretStoreCache, peekSealedEntry, readSecretsFileMeta } from "./adapters/file-secret-store.js";

export * from "./adapters/search-storage.js";

export { openRelaySecurity, readRelayContent, type RelaySecuritySnapshot } from "./adapters/relay-security.js";
