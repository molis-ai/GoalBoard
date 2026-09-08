import type { GoalsCommandApi, RiskRecord } from "@adeptify/goalboard-contracts/modules/goals";

export function uniqueTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))];
}

export function webRiskFacts(
  body: Record<string, unknown>,
  fallbackGoalId?: string,
): Omit<Parameters<GoalsCommandApi["addRisk"]>[1], "risk_id"> {
  const treatment = String(body.treatment ?? "mitigate") as RiskRecord["treatment"];
  const blockingMode = String(body.blocking_mode ?? "none") as RiskRecord["blocking_mode"];
  if (!["accept", "mitigate", "avoid", "defer"].includes(treatment)) {
    throw new Error("Risk 处理方式无效");
  }
  if (!["none", "claim", "completion", "invalidate_on_trigger"].includes(blockingMode)) {
    throw new Error("Risk 阻塞方式无效");
  }
  const suppliedGoalIds = uniqueTextArray(body.goal_ids);
  return {
    goal_ids: suppliedGoalIds.length ? suppliedGoalIds : fallbackGoalId ? [fallbackGoalId] : [],
    description: String(body.description ?? "").trim(),
    probability: String(body.probability ?? "").trim(),
    impact: String(body.impact ?? "").trim(),
    affected_surfaces: uniqueTextArray(body.affected_surfaces),
    trigger: String(body.trigger ?? "").trim(),
    treatment,
    treatment_plan: String(body.treatment_plan ?? "").trim(),
    blocking_mode: blockingMode,
    revisit_condition: String(body.revisit_condition ?? "").trim(),
    owner: String(body.owner ?? "").trim(),
  };
}

export function webImpactFacts(
  body: Record<string, unknown>,
  fallbackGoalId?: string,
): Omit<import("@adeptify/goalboard-contracts/modules/goals").ImpactFactsInput, "binding_id"> {
  const access = String(body.access ?? "read") as import("@adeptify/goalboard-contracts/modules/goals").ImpactAccess;
  const state = String(body.state ?? "confirmed") as "proposed" | "confirmed";
  if (!["read", "write", "decide", "exclusive"].includes(access)) {
    throw new Error("Impact access 无效");
  }
  if (!["proposed", "confirmed"].includes(state)) {
    throw new Error("Impact 状态必须是提议中或已确认");
  }
  return {
    goal_id: String(fallbackGoalId ?? body.goal_id ?? "").trim(),
    surface: String(body.surface ?? "").trim(),
    access,
    input_snapshot: String(body.input_snapshot ?? "").trim() || null,
    state,
    reason: String(body.reason ?? "").trim(),
  };
}
