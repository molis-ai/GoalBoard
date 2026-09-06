import { LOCAL_OPAQUE_BLOB_SCHEMA_SQL, type SqliteDatabase } from "@adeptify/goalboard-storage";
import { migrateSources } from "@adeptify/goalboard-module-sources";
import { migrateSignals } from "@adeptify/goalboard-module-signals";
import { migrateListenerHost } from "@adeptify/goalboard-service-listener-host";
import { AttentionModule, migrateAttention } from "@adeptify/goalboard-module-attention-resumption";
import { migrateFeed, migrateInfoflowContractV2 as migrateModuleInfoflowContractV2 } from "@adeptify/goalboard-module-feed";
import type { InfoflowContractMigrationReport } from "@adeptify/goalboard-contracts/modules/feed";
/** Ordered Feed-related Module initialization for existing Project databases. */
export function migrateFeedTables(db: SqliteDatabase): void {
  migrateSources(db);
  migrateSignals(db);
  migrateListenerHost(db);
  migrateAttention(db);
  migrateFeed(db);
  db.exec(LOCAL_OPAQUE_BLOB_SCHEMA_SQL);
}

export function migrateInfoflowContractV2(db: SqliteDatabase): InfoflowContractMigrationReport {
  migrateFeedTables(db);
  const attention = new AttentionModule(db, { exists: () => true });
  return migrateModuleInfoflowContractV2(db, attention);
}
