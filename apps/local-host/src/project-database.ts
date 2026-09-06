import { LocalSqliteStorage } from "@adeptify/goalboard-storage";
import { createGoalReadServices } from "@adeptify/goalboard-module-goals";
import { createExecutionQueryApi } from "@adeptify/goalboard-module-execution";
import { createEvidenceQueryApi } from "@adeptify/goalboard-module-evidence-verification";
import { createGovernanceReadServices } from "@adeptify/goalboard-module-governance-collaboration";
import type { GoalsQueryApi } from "@adeptify/goalboard-contracts/modules/goals";
import { readGoalBoardSnapshot, type BoardSnapshot, type GoalBoardSnapshotPorts } from "@adeptify/goalboard-plugin-goals";
import { migrateLocalProjectDatabase } from "./project-migrations.js";

/** One local connection, owner migrations and public read services for a Project. */
export class LocalProjectDatabase extends LocalSqliteStorage {
  readonly goalsQuery: GoalsQueryApi;
  private readonly snapshotQueries: GoalBoardSnapshotPorts;

  constructor(path: string) {
    super(path);
    migrateLocalProjectDatabase(this);
    const goals = createGoalReadServices(this.db);
    const governance = createGovernanceReadServices(this.db);
    this.goalsQuery = goals.query;
    this.snapshotQueries = {
      goals: goals.query, impacts: goals.impacts,
      execution: createExecutionQueryApi(this.db), evidence: createEvidenceQueryApi(this.db),
      governance: governance.query, clarification: governance.clarification,
    };
  }

  snapshot(boardId: string): BoardSnapshot {
    return readGoalBoardSnapshot(this.snapshotQueries, boardId);
  }
}
