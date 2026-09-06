import type { RiskRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsSafetyView } from "./safety-ui-model.js";

export const RISK_STATE_LABELS: Record<RiskRecord["state"], string> = {
  open: "待处理",
  triggered: "已发生",
  resolved: "已解决",
  accepted: "已接受",
  expired: "已过期",
};

export const RISK_TREATMENT_LABELS: Record<RiskRecord["treatment"], string> = {
  accept: "接受",
  mitigate: "缓解",
  avoid: "规避",
  defer: "延后",
};

export const RISK_BLOCKING_LABELS: Record<RiskRecord["blocking_mode"], string> = {
  none: "不阻塞",
  claim: "阻止领取",
  completion: "阻止完成",
  invalidate_on_trigger: "触发后失效",
};

export function goalRiskStateEffect(
  L: (text: string) => string,
  blockingMode: RiskRecord["blocking_mode"],
  state: RiskRecord["state"],
): string {
  const active = state === "open" || state === "triggered";
  if (!active) {
    return blockingMode === "invalidate_on_trigger"
      ? L("当前不再使 Goal 失效；若此前触发，关联 Goal 必须重新验证。")
      : L("当前状态不再施加领取或完成门禁。");
  }
  if (blockingMode === "claim") return L("当前会阻止新的执行工具领取所有关联 Goal。");
  if (blockingMode === "completion") return L("当前会阻止所有关联 Goal 被标记为完成。");
  if (blockingMode === "invalidate_on_trigger") {
    return state === "triggered"
      ? L("风险已发生，所有关联 Goal 立即失效。")
      : L("风险仍待处理；一旦标记为已经发生，所有关联 Goal 会失效。");
  }
  return L("这是一条持续观察的事实，不直接阻塞领取或完成。");
}


/** Consume returned user actions; never reconstruct decision eligibility. */
export function goalRiskHasUserAction(risk: RiskRecord, view: GoalsSafetyView): boolean {
  return [...view.goals, ...view.archived_goals].some(item => item.action_projection.actions.some(action =>
    action.actor === "user" && action.target_type === "risk" && action.target_id === risk.risk_id));
}
