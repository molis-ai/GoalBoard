import path from "node:path";
import { LocalHost } from "./local-host.js";
import { GoalProjectApplication } from "./goal-project-application.js";
import { LocalProjectDatabase } from "./project-database.js";
import { registerProjectCapabilities } from "./project-capabilities.js";
import type { LocalHostProjectClient, LocalHostProjectReference, LocalHostStatus } from "@adeptify/goalboard-contracts/platform/app-host";
import type { PlanningMethodPack } from "@adeptify/goalboard-contracts/modules/goals";

export interface GoalBoardProjectRuntime {
  store: LocalProjectDatabase;
  coordinator: GoalProjectApplication;
}

export interface GoalBoardLocalHostOptions {
  planningMethods?: () => readonly PlanningMethodPack[];
  clock?: () => Date;
  instanceId?: string;
  onRuntimeOpen?: (reference: LocalHostProjectReference) => void;
  onRuntimeClose?: (reference: LocalHostProjectReference) => void;
}

export function goalBoardHostProjectReference(input: {
  databasePath: string;
  boardId: string;
  projectId?: string | null;
}): LocalHostProjectReference {
  const storageKey = path.resolve(input.databasePath);
  const boardId = input.boardId.trim() || `database:${storageKey}`;
  return {
    project_id: input.projectId?.trim() || boardId,
    board_id: boardId,
    storage_key: storageKey,
  };
}

/**
 * The project composition owner: one database and application per Host runtime.
 */
export class GoalBoardLocalHost {
  private readonly host: LocalHost<GoalBoardProjectRuntime>;

  constructor(options: GoalBoardLocalHostOptions = {}) {
    this.host = new LocalHost({
      instanceId: options.instanceId,
      runtimeFactory: {
        open: (reference) => {
          options.onRuntimeOpen?.(reference);
          const store = new LocalProjectDatabase(reference.storage_key);
          const coordinator = new GoalProjectApplication(
            store,
            options.clock ?? (() => new Date()),
            [...(options.planningMethods?.() ?? [])],
          );
          return {
            store,
            coordinator,
          };
        },
        close: (runtime, reference) => {
          runtime.store.close();
          options.onRuntimeClose?.(reference);
        },
      },
    });
    registerProjectCapabilities(this.host);
  }

  client(reference: LocalHostProjectReference): LocalHostProjectClient {
    return this.host.client(reference);
  }

  withProject<Result>(
    reference: LocalHostProjectReference,
    operation: (runtime: GoalBoardProjectRuntime) => Result | Promise<Result>,
  ): Promise<Result> {
    return this.host.withRuntime(reference, operation);
  }

  closeProject(referenceOrStorageKey: LocalHostProjectReference | string): Promise<boolean> {
    return this.host.closeProject(referenceOrStorageKey);
  }

  close(): Promise<void> {
    return this.host.close();
  }

  status(): LocalHostStatus {
    return this.host.status();
  }
}

export function createGoalBoardLocalHost(options: GoalBoardLocalHostOptions = {}): GoalBoardLocalHost {
  return new GoalBoardLocalHost(options);
}
