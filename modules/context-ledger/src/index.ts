import { ContextLedgerRepository, type ContextLedgerDatabase } from "./repository.js";
import { ContextLedgerService, type ContextLedgerOptions } from "./service.js";
export const packageDescriptor = {
  packageName: "@adeptify/goalboard-module-context-ledger",
  packagePath: "modules/context-ledger",
  kind: "module",
  maturity: "partial",
  contract: "@adeptify/goalboard-contracts/modules/context-ledger",
  migrationGoals: ["goal-reorg-f2","goal-reorg-ar2"],
  ssot: "docs/SSOT-MATRIX.md",
  capabilities: ["context.edges.v1"],
} as const;

export type GoalBoardPackageDescriptor = typeof packageDescriptor;

export function createContextLedger(db: ContextLedgerDatabase, options: ContextLedgerOptions): ContextLedgerService {
  return new ContextLedgerService(new ContextLedgerRepository(db), options);
}

export { createContextLedgerSchema, type ContextLedgerDatabase } from "./repository.js";
export { ContextLedgerError, type ContextLedgerOptions } from "./service.js";
export { createContextMaterializer } from "./materialization.js";
