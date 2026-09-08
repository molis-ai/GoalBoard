import { randomUUID } from "node:crypto";
import type { GoalsHttpContext } from "./types.js";

export async function handleGoalDraftHttp(context: GoalsHttpContext): Promise<boolean> {
  const draftGoalMatch = context.pathname.match(/^\/api\/goals\/([^/]+)\/draft$/);
  if (context.method === "POST" && draftGoalMatch) {
    const body = await context.readBody();
    const goalId = decodeURIComponent(draftGoalMatch[1]);
    const text = (name: string, maximum = 4_000): string => {
      const value = typeof body[name] === "string" ? body[name].trim() : "";
      if (value.length > maximum) throw new Error(`${name} 内容过长`);
      return value;
    };
    const list = (name: string): string[] => [
      ...new Set(
        (Array.isArray(body[name]) ? body[name] : [])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const decompositionState = String(body.decomposition_state ?? "abstract");
    if (!["abstract", "frontier_open", "closed_leaf", "closed_compound"].includes(decompositionState)) {
      context.respond( 400, { error: "拆分状态不受支持" });
      return true;
    }
    const priority = Number(body.priority ?? 0);
    if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
      context.respond( 400, { error: "priority 必须是 0 到 100 的整数" });
      return true;
    }
    const criteriaInput = Array.isArray(body.acceptance_criteria)
      ? body.acceptance_criteria
      : [];
    const allowedMethods = new Set([
      "automated_check",
      "measurement",
      "inspection",
      "human_decision",
    ]);
    try {
      const acceptanceCriteria = criteriaInput.map((raw, index) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          throw new Error(`第 ${index + 1} 条验收条件格式无效`);
        }
        const criterion = raw as Record<string, unknown>;
        const decisionMethod = String(criterion.decision_method ?? "inspection");
        if (!allowedMethods.has(decisionMethod)) {
          throw new Error(`第 ${index + 1} 条验收条件的判断方式无效`);
        }
        const target = criterion.target;
        if (
          target != null &&
          (typeof target !== "object" || Array.isArray(target))
        ) {
          throw new Error(`第 ${index + 1} 条验收条件的目标值格式无效`);
        }
        return {
          ...(String(criterion.criterion_id ?? "").trim()
            ? { criterion_id: String(criterion.criterion_id).trim() }
            : {}),
          statement: String(criterion.statement ?? "").trim(),
          decision_method: decisionMethod as
            | "automated_check"
            | "measurement"
            | "inspection"
            | "human_decision",
          pass_condition: String(criterion.pass_condition ?? "").trim(),
          target: (target as Record<string, unknown> | null | undefined) ?? null,
          required_evidence: [
            ...new Set(
              (Array.isArray(criterion.required_evidence)
                ? criterion.required_evidence
                : [])
                .map(String)
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ],
        };
      });
      const title = text("title", 120);
      if (!title) throw new Error("title 不能为空");
      const result = context.commands.updateDraftGoal(
        context.options.boardId,
        goalId,
        {
          goal_id: goalId,
          title,
          outcome: text("outcome"),
          why: text("why"),
          business_logic: text("business_logic"),
          in_scope: list("in_scope"),
          out_of_scope: list("out_of_scope"),
          constraints: list("constraints"),
          required_inputs: list("required_inputs"),
          promised_outputs: list("promised_outputs"),
          definition_state: "draft",
          decomposition_state: decompositionState as
            | "abstract"
            | "frontier_open"
            | "closed_leaf"
            | "closed_compound",
          priority,
          acceptance_criteria: acceptanceCriteria,
        },
        {
          actor_id: "web-user",
          idempotency_key: String(body.idempotency_key ?? `web-draft-${randomUUID()}`),
          reason: text("reason", 1_000),
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
