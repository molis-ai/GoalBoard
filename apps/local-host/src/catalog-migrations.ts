import { LocalCatalogMetadata, type LocalSqliteStorage, type SqliteDatabase } from "@adeptify/goalboard-storage";
import type { ContextLedgerApi } from "@adeptify/goalboard-contracts/modules/context-ledger";
import { createProjectsSchema, migrateProjectDataClassSchema } from "@adeptify/goalboard-module-projects";
import { createPersonalPlanningMethodSchema } from "@adeptify/goalboard-module-goals";
import { createRuntimeContextBindingTables, createRuntimeContextSetupRequestTable, createRuntimeContextSuggestionRejectionTable, migrateRuntimeContextBindingEventsForUnbind, migrateRuntimeContextProjectReferences } from "@adeptify/goalboard-module-private-work-context";
import { CATALOG_OWNER, CATALOG_SCHEMA_VERSION, GoalBoardProjectCatalogError, catalogSchemaCompatibilityError } from "./project-catalog-contract.js";

export type CatalogDesktopSchema = (db: SqliteDatabase) => void;

/** The Host sequences existing owner migrations on one local catalog connection. */
export function initializeCatalog(storage: LocalSqliteStorage, createDesktopPanelTables: CatalogDesktopSchema): void {
  const db = storage.db;
  const metadata = new LocalCatalogMetadata(db);
  metadata.create();
  createProjectsSchema(db);
  createRuntimeContextBindingTables(db);
  createRuntimeContextSetupRequestTable(db);
  createRuntimeContextSuggestionRejectionTable(db);
  createDesktopPanelTables(db);
  createPersonalPlanningMethodSchema(db);
  metadata.initialize(CATALOG_OWNER, CATALOG_SCHEMA_VERSION);
}

export function assertOwnedCatalog(storage: LocalSqliteStorage, databasePath: string): void {
  if (new LocalCatalogMetadata(storage.db).owner() !== CATALOG_OWNER) {
    throw new GoalBoardProjectCatalogError("catalog.unknown_database", `不会复用未知项目目录数据库: ${databasePath}`);
  }
}

export function migrateCatalog(storage: LocalSqliteStorage, databasePath: string, ledger: ContextLedgerApi, createDesktopPanelTables: CatalogDesktopSchema): void {
  const db = storage.db;
  const metadata = new LocalCatalogMetadata(db);
  const version = metadata.version();
  const compatibilityError = catalogSchemaCompatibilityError(version);
  if (compatibilityError) throw compatibilityError;
  if (version === CATALOG_SCHEMA_VERSION) return;

  db.transaction(() => {
    let current = version;
    if (current === 1) {
      createRuntimeContextBindingTables(db);
      metadata.setVersion(2);
      current = 2;
    }
    if (current === 2) {
      createRuntimeContextSetupRequestTable(db);
      metadata.setVersion(3);
      current = 3;
    }
    if (current === 3) {
      migrateRuntimeContextBindingEventsForUnbind(db);
      createProjectsSchema(db);
      metadata.setVersion(4);
      current = 4;
    }
    if (current === 4) {
      createRuntimeContextSuggestionRejectionTable(db);
      metadata.setVersion(5);
      current = 5;
    }
    if (current === 5) {
      createProjectsSchema(db);
      metadata.setVersion(6);
      current = 6;
    }
    if (current === 6) {
      migrateProjectDataClassSchema(db);
      metadata.setVersion(7);
      current = 7;
    }
    if (current === 7) {
      createDesktopPanelTables(db);
      metadata.setVersion(8);
      current = 8;
    }
    if (current === 8) {
      createPersonalPlanningMethodSchema(db);
      metadata.setVersion(9);
      current = 9;
    }
    if (current === 9) {
      migrateRuntimeContextProjectReferences(db, ledger);
      metadata.setVersion(10);
      current = 10;
    }
    if (current === 10) {
      createProjectsSchema(db);
      db.exec(`INSERT OR IGNORE INTO project_plugins (project_id, plugin_id, added_at)
        SELECT project_id, plugin_id, updated_at FROM projects CROSS JOIN
        (SELECT 'goals' AS plugin_id UNION ALL SELECT 'sessions' UNION ALL SELECT 'feed' UNION ALL SELECT 'artifacts')`);
      metadata.setVersion(11);
      current = 11;
    }
    if (current !== CATALOG_SCHEMA_VERSION) {
      throw new GoalBoardProjectCatalogError(
        "catalog.unsupported_schema",
        `GoalBoard 项目目录数据库无法迁移到版本 ${CATALOG_SCHEMA_VERSION}: ${databasePath}`,
      );
    }
  })();
}
