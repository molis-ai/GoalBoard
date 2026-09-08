import { randomUUID } from "node:crypto";
import type { GoalsHttpContext } from "./types.js";

export async function handleGoalCreateHttp(context: GoalsHttpContext): Promise<boolean> {
  if (context.method === "POST" && context.pathname === "/api/goals") {
    const body = await context.readBody();
    const requiredText = (name: string, maximum = 4_000): string => {
      const result = typeof body[name] === "string" ? body[name].trim() : "";
      if (!result) throw new Error(`${name} 不能为空`);
      if (result.length > maximum) throw new Error(`${name} 内容过长`);
      return result;
    };
    const optionalText = (name: string): string | undefined => {
      const result = typeof body[name] === "string" ? body[name].trim() : "";
      return result || undefined;
    };
    const draftText = (name: string, maximum = 4_000): string => {
      const result = typeof body[name] === "string" ? body[name].trim() : "";
      if (result.length > maximum) throw new Error(`${name} 内容过长`);
      return result;
    };
    const priority = Number(body.priority ?? 50);
    if (!Number.isFinite(priority) || priority < 0 || priority > 100) {
      context.respond( 400, { error: "priority 必须是 0 到 100 的数字" });
      return true;
    }
    const goalId = optionalText("goal_id");
    const parentGoalId = optionalText("parent_goal_id");
    const dependencyGoalIds = [
      ...new Set(
        (Array.isArray(body.dependency_goal_ids) ? body.dependency_goal_ids : [])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const acceptanceStatements = [
      ...new Set(
        (Array.isArray(body.acceptance_criteria) ? body.acceptance_criteria : [])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const knownGoalIds = new Set(
      context.snapshot().goals.map((goal) => goal.goal_id),
    );
    const relationTargets = [...(parentGoalId ? [parentGoalId] : []), ...dependencyGoalIds];
    const missingTargets = relationTargets.filter((target) => !knownGoalIds.has(target));
    if (missingTargets.length) {
      context.respond( 400, {
        error: `找不到关联 Goal: ${[...new Set(missingTargets)].join("、")}`,
      });
      return true;
    }
    if (goalId && relationTargets.includes(goalId)) {
      context.respond( 400, { error: "新 Goal 不能依赖或属于自身" });
      return true;
    }
    let created;
    try {
      created = context.commands.createGoal(
        context.options.boardId,
        {
          ...(goalId ? { goal_id: goalId } : {}),
          title: requiredText("title", 120),
          outcome: draftText("outcome"),
          why: draftText("why"),
          business_logic: draftText("business_logic"),
          definition_state: "draft",
          decomposition_state: "abstract",
          priority,
          acceptance_criteria: acceptanceStatements.map((statement) => ({
            statement,
            decision_method: "inspection",
            pass_condition: statement,
            required_evidence: ["inspection"],
          })),
        },
        {
          actor_id: "web-user",
          idempotency_key: String(body.idempotency_key ?? `web-goal-${randomUUID()}`),
          reason: "用户从 GoalBoard 手动录入 Goal",
        },
      );
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
      return true;
    }
    if (parentGoalId) {
      context.commands.addRelation(
        context.options.boardId,
        {
          from_goal_id: created.goal.goal_id,
          to_goal_id: parentGoalId,
          type: "part_of",
          state: "active",
          reason: "用户创建 Goal 时指定上级 Goal",
        },
        {
          actor_id: "web-user",
          idempotency_key: `web-parent-${created.goal.goal_id}-${randomUUID()}`,
        },
      );
    }
    for (const dependencyGoalId of dependencyGoalIds) {
      context.commands.addRelation(
        context.options.boardId,
        {
          from_goal_id: created.goal.goal_id,
          to_goal_id: dependencyGoalId,
          type: "depends_on",
          state: "active",
          reason: "用户创建 Goal 时指定上游依赖",
        },
        {
          actor_id: "web-user",
          idempotency_key: `web-dependency-${created.goal.goal_id}-${dependencyGoalId}-${randomUUID()}`,
        },
      );
    }
    context.respond( 201, {
      goal: created.goal,
      goal_path: `${context.options.routePrefix}/goals/${encodeURIComponent(created.goal.goal_id)}`,
      observed_event_cursor: context.snapshot().cursor,
    });
    return true;
  }
  return false;
}
