export interface GoalArchiveHooks {
  blockingWork?(boardId: string, goalId: string, now: string): {
    claim_ids: string[];
    run_ids: string[];
  };
}

export type GoalsLifecycleHooks = GoalArchiveHooks;
