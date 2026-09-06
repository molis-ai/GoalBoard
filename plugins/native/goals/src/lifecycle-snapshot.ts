import type { GoalsQueryApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionQueryApi } from "@adeptify/goalboard-contracts/modules/execution";
import type { EvidenceQueryApi } from "@adeptify/goalboard-contracts/modules/evidence-verification";
import type { GovernanceQueryApi } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { ExecutionValidationSnapshot } from "./execution-validation-contract.js";

export interface LifecycleSnapshotPorts {
  goals: Pick<GoalsQueryApi, "snapshot" | "listContractRevisions" | "listCoverageRevisions" | "listLifecycleEvents">;
  execution: Pick<ExecutionQueryApi, "listClaims" | "listRuns" | "listLifecycleEvents">;
  evidence: Pick<EvidenceQueryApi, "listEvidence" | "listLifecycleEvents">;
  governance: Pick<GovernanceQueryApi, "snapshot" | "listLifecycleEvents">;
}

/** Compose owner facts on the caller's transaction; no application-owned persistence. */
export class LifecycleSnapshotQuery {
  constructor(private readonly ports: LifecycleSnapshotPorts) {}

  read(boardId: string): ExecutionValidationSnapshot {
    const { goals, execution, evidence, governance } = this.ports;
    const goalFacts = goals.snapshot(boardId);
    return {
      cursor: goalFacts.observed_event_cursor,
      goals: goalFacts.goals,
      relations: goalFacts.relations,
      risks: goalFacts.risks,
      goal_risks: goalFacts.goal_risks,
      claims: execution.listClaims(boardId),
      runs: execution.listRuns(boardId),
      evidence: evidence.listEvidence(boardId),
      ...governance.snapshot(boardId),
      goal_contract_revisions: goals.listContractRevisions(boardId),
      coverage_contract_revisions: goals.listCoverageRevisions(boardId),
      lifecycle_events: [
        ...goals.listLifecycleEvents(boardId),
        ...execution.listLifecycleEvents(boardId),
        ...evidence.listLifecycleEvents(boardId),
        ...governance.listLifecycleEvents(boardId),
      ].sort((left, right) => left.seq - right.seq),
    };
  }
}
