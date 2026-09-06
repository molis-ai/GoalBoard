import { createContextLedger } from "@adeptify/goalboard-module-context-ledger";
import { GoalBoardSessionRegistry, type GoalBoardSessionRegistryOptions } from "@adeptify/goalboard-module-private-work-context";

/** Same connection gives Session writes and private Ledger relations one atomic commit. */
export function openWorkSessionRegistry(options: Omit<GoalBoardSessionRegistryOptions, "createLedger"> = {}): Promise<GoalBoardSessionRegistry> {
  return GoalBoardSessionRegistry.open({ ...options, createLedger: (db) => createContextLedger(db, {
    now: options.now,
    authorize: (access) => access.scope.kind === "personal" && access.scope.id === "private-work-context",
  }) });
}
