import type { CandidateGoalRecord, RewireRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalRecord, GoalPolicy } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsPolicyBinding } from "./policy-ui-model.js";
import type { GoalsDecisionPresentationPrimitives } from "./decision-common-ui.js";

export interface GoalsLegacyProposalView {
  goals: Array<{ goal: Pick<GoalRecord, "goal_id" | "title" | "in_scope" | "outcome"> }>;
  archived_goals: Array<{ goal: Pick<GoalRecord, "goal_id" | "title" | "in_scope" | "outcome"> }>;
  events: Array<{ object_id: string; type: string; at: string }>;
  snapshot: { rewires: RewireRecord[]; runs: Array<{ run_id: string; goal_id: string }> };
  policy_bindings: GoalsPolicyBinding[];
}
export interface GoalsLegacyProposalUiPrimitives extends GoalsDecisionPresentationPrimitives {
  defaultPolicy: GoalPolicy;
  icon(name: "tree" | "chevron-down" | "chevron-right" | "clipboard" | "plus"): string;
  renderList(values: string[], empty: string): string;
  renderReference(value: string): string;
}
export function resolvedProposalGoalId(
  value: unknown,
  rewire: RewireRecord,
): string {
  const goalId = String(value ?? "");
  return goalId === "$new_goal" ? String(rewire.proposal.formal_goal_id ?? goalId) : goalId;
}

export function candidateOwnerGoalId(candidate: CandidateGoalRecord, view: { snapshot: { runs: Array<{ run_id: string; goal_id: string }> } }): string | null {
  if (!candidate.discovered_in_run_id) return null;
  return view.snapshot.runs.find((run) => run.run_id === candidate.discovered_in_run_id)?.goal_id ?? null;
}
