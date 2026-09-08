import { randomUUID } from "node:crypto";
import type { GoalsHttpContext } from "./types.js";
import type { GoalRelationRecord } from "@adeptify/goalboard-contracts/modules/goals";

const RELATION_TYPES = new Set<GoalRelationRecord["type"]>([
  "part_of",
  "depends_on",
  "conflicts_with",
  "mitigates",
  "extends",
  "replaces",
  "corrects",
  "invalidates",
  "migrates_from",
]);

export async function handleGoalRelationsHttp(context: GoalsHttpContext): Promise<boolean> {
  const goalRelationMatch = context.pathname.match(/^\/api\/goals\/([^/]+)\/relations$/);
  if (context.method === "POST" && goalRelationMatch) {
    const body = await context.readBody();
    const goalId = decodeURIComponent(goalRelationMatch[1]);
    const targetGoalId = String(body.target_goal_id ?? "").trim();
    const type = String(body.type ?? "") as GoalRelationRecord["type"];
    const direction = String(body.direction ?? "outgoing");
    const reason = String(body.reason ?? "").trim();
    if (!targetGoalId) {
      context.respond( 400, { error: "请选择另一个 Goal" });
      return true;
    }
    if (!RELATION_TYPES.has(type)) {
      context.respond( 400, { error: "关系类型不受支持" });
      return true;
    }
    if (direction !== "outgoing" && direction !== "incoming") {
      context.respond( 400, { error: "关系方向必须是 outgoing 或 incoming" });
      return true;
    }
    if (!reason) {
      context.respond( 400, { error: "请说明为什么要建立这条关系" });
      return true;
    }
    try {
      const result = context.commands.addRelation(
        context.options.boardId,
        {
          from_goal_id: direction === "outgoing" ? goalId : targetGoalId,
          to_goal_id: direction === "outgoing" ? targetGoalId : goalId,
          type,
          state: "active",
          reason,
        },
        {
          actor_id: "web-user",
          idempotency_key: String(body.idempotency_key ?? `web-relation-${randomUUID()}`),
        },
      );
      context.respond( 201, result);
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  const relationDeactivateMatch = context.pathname.match(
    /^\/api\/relations\/([^/]+)\/deactivate$/,
  );
  if (context.method === "POST" && relationDeactivateMatch) {
    const body = await context.readBody();
    const reason = String(body.reason ?? "").trim();
    if (!reason) {
      context.respond( 400, { error: "解除关系时必须说明原因" });
      return true;
    }
    try {
      const result = context.commands.deactivateRelation(
        context.options.boardId,
        {
          relation_id: decodeURIComponent(relationDeactivateMatch[1]),
          reason,
        },
        {
          actor_id: "web-user",
          idempotency_key: String(
            body.idempotency_key ?? `web-relation-deactivate-${randomUUID()}`,
          ),
        },
      );
      context.respond( 200, result);
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  return false;
}
