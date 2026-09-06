import type { BoardSnapshot } from "./goal-entry-contract.js";
import type { GoalsQueryApi, GoalLifecycleReason as DecisionReason } from "@adeptify/goalboard-contracts/modules/goals";

import { executionValidationReason as reason } from "./execution-validation-support.js";
export function activeGoalReplacement(
  goals: GoalsQueryApi,
    boardId: string,
    goalId: string,
    snapshot?: BoardSnapshot,
  ): { relation_id: string; replacement_goal_id: string; replacement_goal_title: string } | null {
    if (snapshot) {
      const relation = snapshot.relations
        .filter(
          (item) =>
            item.board_id === boardId &&
            item.to_goal_id === goalId &&
            item.type === "replaces" &&
            item.state === "active",
        )
        .sort(
          (left, right) =>
            right.created_at.localeCompare(left.created_at) ||
            right.relation_id.localeCompare(left.relation_id),
        )[0];
      if (!relation) return null;
      const replacement = snapshot.goals.find((item) => item.goal_id === relation.from_goal_id);
      if (!replacement) return null;
      return {
        relation_id: relation.relation_id,
        replacement_goal_id: replacement.goal_id,
        replacement_goal_title: replacement.title,
      };
    }
    return goals.activeReplacement(boardId, goalId);
  }

export function goalReplacedReason(
    goalId: string,
    replacement: { relation_id: string; replacement_goal_id: string; replacement_goal_title: string },
  ): DecisionReason {
    return reason(
      "goal.replaced",
      "goal",
      goalId,
      `这条 Goal 已被「${replacement.replacement_goal_title}」替代，不再接受新的 Runtime 工作`,
      replacement,
      "请推进替代 Goal；如果替代关系有误，由用户停用对应的 replaces 关系后再查询 Ready。",
    );
  }
