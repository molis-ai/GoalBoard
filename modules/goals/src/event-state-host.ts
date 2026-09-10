import type {
  GoalEventRequirementStatus,
  GoalEventScope,
  GoalEventSystemPayload,
  GoalRecord,
  GoalSystemWorkEventRecord,
  SetGoalEventAgreementInput,
} from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalEventCompletionContext } from "./event-state-completion.js";

export interface GoalEventStateHost {
  requireWritableGoal(boardId: string, goalId: string): GoalRecord;
  actorKind(kind: "user" | "runtime" | undefined): "user" | "runtime" | null;
  configVersion(boardId: string, goalId: string): number;
  readCurrentRequirements(boardId: string, goalId: string): GoalEventRequirementStatus[];
  addRequirements(input: SetGoalEventAgreementInput, goal: GoalRecord): void;
  readCompletionContext(boardId: string, goalId: string): GoalEventCompletionContext;
}

export interface GoalEventStateCore {
  mutate<T extends { event_id: string; observed_event_cursor: number; recorded: true }>(
    input: { board_id: string; goal_id: string; actor_id: string; actor_kind?: "user" | "runtime"; idempotency_key: string },
    operation: string,
    hash: string,
    write: (goal: GoalRecord, actorKind: "user" | "runtime" | null) => T,
  ): T & { replayed: boolean };
  insertSystem(
    goal: GoalRecord,
    actorId: string,
    actorKind: "user" | "runtime" | null,
    title: string,
    payload: GoalEventSystemPayload,
  ): GoalSystemWorkEventRecord;
  requireOwnedWritable(boardId: string, goalId: string): GoalRecord;
  requireLocalScope(goal: GoalRecord, raw?: Partial<GoalEventScope>): GoalEventScope;
  assertConfigVersion(goal: GoalRecord, expected: number): void;
  error: (code: string, message: string, details?: Record<string, unknown>) => Error;
}
