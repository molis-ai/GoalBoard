import type { GoalsDecisionPresentationPrimitives } from "./decision-common-ui.js";

export interface GoalsProposalView {
  goals: Array<{ goal: { goal_id: string; title: string } }>;
  archived_goals: Array<{ goal: { goal_id: string; title: string } }>;
  events: Array<{ object_id: string; type: string; at: string }>;
  snapshot?: {
    goals?: ReadonlyArray<{ goal_id: string }>;
    relations?: ReadonlyArray<{ from_goal_id?: string; to_goal_id?: string; type?: string; state?: string }>;
  };
}
export interface GoalsProposalUiPrimitives extends GoalsDecisionPresentationPrimitives {
  icon(name: "tree" | "chevron-down" | "blocked" | "check"): string;
  renderList(values: string[], empty: string): string;
}

/** Active and archived Goal projections; trashed Goals are deliberately excluded. */
export function allGoalViews<T>(view: { goals: T[]; archived_goals: T[] }): T[] {
  return [...view.goals, ...view.archived_goals];
}
export function findGoalView<T extends { goal: { goal_id: string } }>(view: { goals: T[]; archived_goals: T[] }, goalId: string | null | undefined): T | null {
  return goalId ? allGoalViews(view).find((item) => item.goal.goal_id === goalId) ?? null : null;
}
