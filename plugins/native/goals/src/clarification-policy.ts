import { recordedContractCoverageBlocksClosure } from "@adeptify/goalboard-module-goals";
import type { GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionValidationSnapshot } from "./execution-validation-contract.js";
import { projectionIndex } from "./action-projection-index.js";
import { compatibleContractRevisions } from "./contract-revisions.js";

export function goalNeedsDefinitionClarification(goal: GoalRecord): boolean {
  return goal.definition_state !== "accepted" || goal.decomposition_state === "abstract" ||
    goal.decomposition_state === "frontier_open" || goal.acceptance_criteria.length === 0;
}

/** Coverage completeness and revision freshness are separate: missing mappings cannot be claimed. */
export function compoundCoverageState(goal: GoalRecord, snapshot: ExecutionValidationSnapshot): {
  status: "not_compound" | "missing" | "stale" | "current";
  child_ids: string[];
  stale_child_ids: string[];
} {
  if (goal.decomposition_state !== "closed_compound") {
    return { status: "not_compound", child_ids: [], stale_child_ids: [] };
  }
  const index = projectionIndex(snapshot);
  const childIds = [...(index.child_ids_by_parent.get(goal.goal_id) ?? [])].sort();
  if (childIds.length === 0 || recordedContractCoverageBlocksClosure(goal, snapshot)) {
    return { status: "missing", child_ids: childIds, stale_child_ids: [] };
  }
  const parentRevisions = compatibleContractRevisions(goal, snapshot);
  const coverage = index.coverage_by_parent.get(goal.goal_id) ?? [];
  const staleChildIds = childIds.filter(childId => {
    const child = index.goals_by_id.get(childId);
    if (!child) return true;
    const childRevisions = compatibleContractRevisions(child, snapshot);
    return !coverage.some(item => item.child_goal_id === childId &&
      parentRevisions.has(item.parent_contract_revision) && childRevisions.has(item.child_contract_revision));
  });
  return { status: staleChildIds.length > 0 ? "stale" : "current", child_ids: childIds, stale_child_ids: staleChildIds };
}

/** Keep the projection's existing revalidation priority; this is not permission to reopen any completed Goal. */
export function goalNeedsCoverageClarification(goal: GoalRecord, snapshot: ExecutionValidationSnapshot): boolean {
  return goal.validity_state === "valid" && compoundCoverageState(goal, snapshot).status === "stale";
}
