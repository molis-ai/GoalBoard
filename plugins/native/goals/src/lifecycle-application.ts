import type { GoalsLifecycleApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionCommandApi } from "@adeptify/goalboard-contracts/modules/execution";
import type { ActionTransitionReceipt } from "./execution-validation-contract.js";
import { compactGoalActionProjection, deriveGoalActionProjection, deriveGoalActionProjections } from "./action-projection.js";
import { planGoalLifecycleReconciliation } from "./lifecycle-reconciliation.js";
import { LifecycleSnapshotQuery, type LifecycleSnapshotPorts } from "./lifecycle-snapshot.js";

export interface LifecycleReconciliationPorts {
  query: LifecycleSnapshotPorts;
  goals: Pick<GoalsLifecycleApi, "reopenForLifecycleFacts" | "satisfyForLifecycleFacts">;
  execution: Pick<ExecutionCommandApi, "releaseClaimForLifecycleFacts">;
  errorFactory(code: string, message: string): Error;
}

/** Runs inside the initiating command's transaction; all mutations stay with their owner. */
export class LifecycleReconciliationApplication {
  readonly snapshots: LifecycleSnapshotQuery;
  constructor(private readonly ports: LifecycleReconciliationPorts) {
    this.snapshots = new LifecycleSnapshotQuery(ports.query);
  }

  projection(boardId: string, goalId: string, at: string) {
    const snapshot = this.snapshots.read(boardId);
    const goal = snapshot.goals.find(candidate => candidate.goal_id === goalId);
    if (!goal) throw this.ports.errorFactory("goal.not_found", `Goal 不存在: ${goalId}`);
    return deriveGoalActionProjection(goal, snapshot, at);
  }

  /** Apply mechanical close-out and return the exact state produced by the same transaction. */
  reconcile(
    boardId: string,
    goalId: string,
    actorId: string,
    previousActionToken: string,
    summary: string,
    at: string,
  ): ActionTransitionReceipt {
    const before = this.snapshots.read(boardId);
    const changedGoalIds = new Set<string>([goalId]);
    for (let iteration = 0; iteration < 6; iteration += 1) {
      const snapshot = this.snapshots.read(boardId);
      const goal = snapshot.goals.find((candidate) => candidate.goal_id === goalId);
      if (!goal) throw this.ports.errorFactory("goal.not_found", `找不到这个 Goal: ${goalId}`);
      const plan = planGoalLifecycleReconciliation(goal, snapshot, at);
      if (plan.release_claim) {
        this.ports.execution.releaseClaimForLifecycleFacts(
          boardId, plan.release_claim.claim_id, actorId, at,
          plan.release_reason ?? "角色产物齐全，自动释放 Claim",
        );
        continue;
      }
      if (plan.reopen_goal && goal.fulfillment_state === "satisfied") {
        this.ports.goals.reopenForLifecycleFacts(
          boardId,
          goalId,
          actorId,
          at,
          plan.reopen_reason ?? "新的当前事实使旧完成结论不再成立",
        );
        continue;
      }
      if (plan.satisfy_goal && goal.fulfillment_state !== "satisfied") {
        this.ports.goals.satisfyForLifecycleFacts(boardId, goalId, actorId, at);
        continue;
      }
      break;
    }

    const after = this.snapshots.read(boardId);
    const beforeById = new Map(before.goals.map((goal) => [goal.goal_id, goal]));
    for (const goal of after.goals) {
      const previous = beforeById.get(goal.goal_id);
      if (
        previous &&
        (previous.fulfillment_state !== goal.fulfillment_state || previous.validity_state !== goal.validity_state)
      ) changedGoalIds.add(goal.goal_id);
    }
    const projections = deriveGoalActionProjections(after, at);
    const projection = projections.find((item) => item.goal_id === goalId);
    if (!projection) throw this.ports.errorFactory("goal.not_found", `找不到这个 Goal: ${goalId}`);
    return {
      goal_id: goalId,
      previous_action_token: previousActionToken,
      projection,
      affected_goals: projections
        .filter((item) => changedGoalIds.has(item.goal_id))
        .map(compactGoalActionProjection),
      summary,
      observed_event_cursor: after.cursor,
    };
  }
}
