import type { BoardSnapshot } from "./goal-entry-contract.js";
import type { GoalRecord, ImpactBindingRecord, RiskRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionClaimRecord as ClaimRecord, ExecutionRunRecord as RunRecord } from "@adeptify/goalboard-contracts/modules/execution";
import type { ContractProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
export interface SnapshotEvaluationIndex {
  goals_by_id: Map<string, GoalRecord>;
  dependencies_by_goal: Map<string, GoalRecord[]>;
  risks_by_goal: Map<string, RiskRecord[]>;
  claims_by_goal: Map<string, ClaimRecord[]>;
  impacts_by_goal: Map<string, ImpactBindingRecord[]>;
  pending_contract_proposal_by_goal: Map<string, ContractProposalRecord>;
  pending_review_keys: Set<string>;
  latest_work_run_by_goal: Map<string, RunRecord>;
}

const snapshotEvaluationIndexes = new WeakMap<BoardSnapshot, SnapshotEvaluationIndex>();

function pushSnapshotGroup<T>(target: Map<string, T[]>, key: string, value: T): void {
  const current = target.get(key);
  if (current) current.push(value);
  else target.set(key, [value]);
}

export function snapshotEvaluationIndex(snapshot: BoardSnapshot): SnapshotEvaluationIndex {
  const cached = snapshotEvaluationIndexes.get(snapshot);
  if (cached) return cached;
  const goalsById = new Map(snapshot.goals.map((goal) => [goal.goal_id, goal]));
  const dependenciesByGoal = new Map<string, GoalRecord[]>();
  for (const relation of snapshot.relations) {
    if (relation.type !== "depends_on" || relation.state !== "active") continue;
    const dependency = goalsById.get(relation.to_goal_id);
    if (dependency) pushSnapshotGroup(dependenciesByGoal, relation.from_goal_id, dependency);
  }
  for (const dependencies of dependenciesByGoal.values()) {
    dependencies.sort((left, right) => left.goal_id.localeCompare(right.goal_id));
  }
  const risksById = new Map(snapshot.risks.map((risk) => [risk.risk_id, risk]));
  const risksByGoal = new Map<string, RiskRecord[]>();
  for (const link of snapshot.goal_risks) {
    const risk = risksById.get(link.risk_id);
    if (risk && (risk.state === "open" || risk.state === "triggered")) {
      pushSnapshotGroup(risksByGoal, link.goal_id, risk);
    }
  }
  for (const risks of risksByGoal.values()) {
    risks.sort((left, right) => left.risk_id.localeCompare(right.risk_id));
  }
  const claimsByGoal = new Map<string, ClaimRecord[]>();
  for (const claim of snapshot.claims) pushSnapshotGroup(claimsByGoal, claim.goal_id, claim);
  const impactsByGoal = new Map<string, ImpactBindingRecord[]>();
  for (const impact of snapshot.impacts) {
    if (impact.state !== "inactive") pushSnapshotGroup(impactsByGoal, impact.goal_id, impact);
  }
  const pendingContractProposalByGoal = new Map<string, ContractProposalRecord>();
  for (const proposal of snapshot.contract_proposals) {
    if (proposal.state !== "pending") continue;
    const current = pendingContractProposalByGoal.get(proposal.goal_id);
    if (!current || proposal.created_at > current.created_at) {
      pendingContractProposalByGoal.set(proposal.goal_id, proposal);
    }
  }
  const pendingReviewKeys = new Set(
    snapshot.review_obligations
      .filter((obligation) => obligation.state === "pending")
      .map((obligation) => `${obligation.goal_id}\u0000${obligation.role}`),
  );
  const latestWorkRunByGoal = new Map<string, RunRecord>();
  for (const run of snapshot.runs) {
    if (run.role !== "executor" && run.role !== "revalidator") continue;
    const current = latestWorkRunByGoal.get(run.goal_id);
    if (
      !current ||
      run.started_at > current.started_at ||
      (run.started_at === current.started_at && run.run_id > current.run_id)
    ) {
      latestWorkRunByGoal.set(run.goal_id, run);
    }
  }
  const index: SnapshotEvaluationIndex = {
    goals_by_id: goalsById,
    dependencies_by_goal: dependenciesByGoal,
    risks_by_goal: risksByGoal,
    claims_by_goal: claimsByGoal,
    impacts_by_goal: impactsByGoal,
    pending_contract_proposal_by_goal: pendingContractProposalByGoal,
    pending_review_keys: pendingReviewKeys,
    latest_work_run_by_goal: latestWorkRunByGoal,
  };
  snapshotEvaluationIndexes.set(snapshot, index);
  return index;
}

