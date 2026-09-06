import type { GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalActionProjection } from "@adeptify/goalboard-plugin-goals";

export interface McpResumeFacts {
  goals: readonly Pick<GoalRecord, "goal_id" | "title" | "updated_at" | "priority" | "trashed_at">[];
  projections: readonly GoalActionProjection[];
}

/** Display existing project work without claiming it or deriving new lifecycle facts. */
export function buildMcpResumeView(
  facts: McpResumeFacts,
  explicitGoalId: string | null,
  sessionGoalId: string | null,
) {
  const goalsById = new Map(facts.goals.map((goal) => [goal.goal_id, goal]));
  const projections = facts.projections;
  const projectionsById = new Map(projections.map((projection) => [projection.goal_id, projection]));
  const preferred = [
    { goal_id: explicitGoalId, source: "host_focus" },
    { goal_id: sessionGoalId, source: "session_focus" },
  ].find((candidate) => candidate.goal_id && projectionsById.has(candidate.goal_id));
  const fallbackOrder: Record<GoalActionProjection["display_status"], number> = {
    in_progress: 0,
    waiting_user: 1,
    continue: 3,
    waiting: 4,
    blocked: 5,
    completed: 6,
  };
  const ordered = projections
    .filter((projection) => !goalsById.get(projection.goal_id)?.trashed_at)
    .sort((left, right) => {
      const leftWorkRecorded = left.progress === "work_recorded" && left.display_status !== "completed" ? 2 : null;
      const rightWorkRecorded = right.progress === "work_recorded" && right.display_status !== "completed" ? 2 : null;
      const leftOrder = leftWorkRecorded ?? fallbackOrder[left.display_status];
      const rightOrder = rightWorkRecorded ?? fallbackOrder[right.display_status];
      const leftGoal = goalsById.get(left.goal_id);
      const rightGoal = goalsById.get(right.goal_id);
      return leftOrder - rightOrder
        || (rightGoal?.updated_at ?? "").localeCompare(leftGoal?.updated_at ?? "")
        || (rightGoal?.priority ?? 0) - (leftGoal?.priority ?? 0)
        || left.goal_id.localeCompare(right.goal_id);
    });
  const focusedProjection = preferred
    ? projectionsById.get(preferred.goal_id!)!
    : ordered[0] ?? null;
  const focusedGoal = focusedProjection ? goalsById.get(focusedProjection.goal_id) ?? null : null;
  const source = preferred?.source ?? (focusedProjection ? "project_recovery_order" : null);
  const nextGoals = ordered
    .filter((projection) => projection.goal_id !== focusedProjection?.goal_id && projection.display_status !== "completed")
    .slice(0, 5)
    .map((projection) => ({
      goal_id: projection.goal_id,
      title: goalsById.get(projection.goal_id)?.title ?? projection.goal_id,
      projection,
    }));
  return {
    focus: focusedProjection
      ? {
          goal_id: focusedProjection.goal_id,
          title: focusedGoal?.title ?? focusedProjection.goal_id,
          source,
          projection: focusedProjection,
        }
      : null,
    next_goals: nextGoals,
    auto_claimed: false,
  };
}
