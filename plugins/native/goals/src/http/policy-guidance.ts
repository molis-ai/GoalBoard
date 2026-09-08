import { randomUUID } from "node:crypto";
import type { GoalsHttpContext } from "./types.js";
import type { GoalPolicy, GoalsCommandApi } from "@adeptify/goalboard-contracts/modules/goals";

export async function handleGoalPolicyGuidanceHttp(context: GoalsHttpContext): Promise<boolean> {
  if (context.method === "POST" && context.pathname === "/api/policy-bindings") {
    const body = await context.readBody();
    const scope = String(body.scope ?? "");
    if (scope !== "project_default" && scope !== "goal") {
      context.respond( 400, { error: "scope 必须是 project_default 或 goal" });
      return true;
    }
    const goalId = scope === "goal" ? String(body.goal_id ?? "").trim() : null;
    if (scope === "goal" && !goalId) {
      context.respond( 400, { error: "当前 Goal 规则必须指定 goal_id" });
      return true;
    }
    const policyInput = body.policy as Record<string, unknown> | undefined;
    if (!policyInput || typeof policyInput !== "object" || Array.isArray(policyInput)) {
      context.respond( 400, { error: "policy 必须是完整规则对象" });
      return true;
    }
    const policy: GoalPolicy = {
      goal_mode: String(policyInput.goal_mode) as GoalPolicy["goal_mode"],
      required_capabilities: Array.isArray(policyInput.required_capabilities)
        ? policyInput.required_capabilities.map(String)
        : [],
      self_verification: policyInput.self_verification === true,
      cross_reviewers: Number(policyInput.cross_reviewers),
      adversarial_reviewers: Number(policyInput.adversarial_reviewers),
      human_approval: policyInput.human_approval === true,
      max_lease_seconds: Number(policyInput.max_lease_seconds),
    };
    const reason = String(body.reason ?? "").trim();
    try {
      const result = context.commands.setPolicy(
        context.options.boardId,
        { goal_id: goalId, policy, reason },
        {
          actor_id: "web-user",
          idempotency_key: String(body.idempotency_key ?? `web-policy-${randomUUID()}`),
        },
      );
      context.respond( 200, {
        ...result,
        resolved_policy: goalId
          ? context.query.readGoalContract(context.options.boardId, goalId).resolved_policy
          : null,
      });
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  if (context.method === "GET" && context.pathname === "/api/project-guidance") {
    context.respond( 200, context.query.readProjectGuidance(context.options.boardId));
    return true;
  }
  if (context.method === "POST" && context.pathname === "/api/project-guidance") {
    const body = await context.readBody();
    try {
      const result = context.commands.addProjectGuidance({
        board_id: context.options.boardId,
        actor_id: "web-user",
        kind: String(body.kind ?? "") as Parameters<GoalsCommandApi["addProjectGuidance"]>[0]["kind"],
        content: String(body.content ?? ""),
        source_refs: Array.isArray(body.source_refs) ? body.source_refs.map(String) : [],
        reason: String(body.reason ?? ""),
        confirmation_summary: "用户在项目说明页面直接提交新增",
        user_confirmed: body.user_confirmed === true,
        idempotency_key: String(body.idempotency_key ?? `web-project-guidance-${randomUUID()}`),
      });
      context.respond( 200, {
        ...result,
        project_guidance: context.query.readProjectGuidance(context.options.boardId),
      });
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  const projectGuidanceUpdateMatch = context.pathname.match(/^\/api\/project-guidance\/([^/]+)$/);
  if (context.method === "PATCH" && projectGuidanceUpdateMatch) {
    const body = await context.readBody();
    const action = String(body.action ?? "");
    const confirmationSummary = action === "edit"
      ? "用户在项目说明页面直接提交修改"
      : action === "deactivate"
        ? "用户在项目说明页面直接停用"
        : "用户在项目说明页面直接恢复";
    try {
      const result = context.commands.updateProjectGuidance({
        board_id: context.options.boardId,
        guidance_id: decodeURIComponent(projectGuidanceUpdateMatch[1]),
        actor_id: "web-user",
        action: action as Parameters<GoalsCommandApi["updateProjectGuidance"]>[0]["action"],
        kind: body.kind == null
          ? undefined
          : String(body.kind) as Parameters<GoalsCommandApi["updateProjectGuidance"]>[0]["kind"],
        content: body.content == null ? undefined : String(body.content),
        source_refs: Array.isArray(body.source_refs) ? body.source_refs.map(String) : undefined,
        reason: String(body.reason ?? ""),
        confirmation_summary: confirmationSummary,
        user_confirmed: body.user_confirmed === true,
        idempotency_key: String(body.idempotency_key ?? `web-project-guidance-update-${randomUUID()}`),
      });
      context.respond( 200, {
        ...result,
        project_guidance: context.query.readProjectGuidance(context.options.boardId),
      });
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  return false;
}
