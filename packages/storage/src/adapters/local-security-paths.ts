import { AsyncLocalStorage } from "node:async_hooks";
import os from "node:os";
import path from "node:path";

const homeScope = new AsyncLocalStorage<string>();

/** Explicit host context inherited by async work, without changing process.env. */
export function runWithGoalBoardHome<T>(homeDirectory: string, operation: () => T): T {
  return homeScope.run(path.resolve(homeDirectory), operation);
}

export function resolveGoalBoardHome(): string {
  const configured = homeScope.getStore() ?? process.env.GOALBOARD_HOME?.trim();
  return path.resolve(configured || path.join(os.homedir(), ".goalboard"));
}

export function resolveFeedSecurityDirectory(): string {
  return path.join(resolveGoalBoardHome(), "feed");
}
