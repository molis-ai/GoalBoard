import type { UiHostApi, UiSlotDescriptor } from "@adeptify/goalboard-contracts/platform/ui";
import { GOALS_SAFETY_UI_CONTRIBUTION_ID, type GoalsSafetyRenderer, type GoalsSafetyUiPrimitives } from "@adeptify/goalboard-plugin-goals";

export function createGoalsSafetyWorkbenchRenderer(host: UiHostApi, slot: UiSlotDescriptor) {
  return (primitives: GoalsSafetyUiPrimitives): GoalsSafetyRenderer => ({
    renderRiskDecision: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_SAFETY_UI_CONTRIBUTION_ID, surface: "risk-decision", model: { kind: "risk-decision", args, primitives } } }).html,
    renderQuickRiskForm: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_SAFETY_UI_CONTRIBUTION_ID, surface: "quick-risk", model: { kind: "quick-risk", args, primitives } } }).html,
    renderQuickImpactForm: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_SAFETY_UI_CONTRIBUTION_ID, surface: "quick-impact", model: { kind: "quick-impact", args, primitives } } }).html,
    renderRiskWorkbench: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_SAFETY_UI_CONTRIBUTION_ID, surface: "risk", model: { kind: "risk", args, primitives } } }).html,
    renderImpactWorkbench: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_SAFETY_UI_CONTRIBUTION_ID, surface: "impact", model: { kind: "impact", args, primitives } } }).html,
    renderSafety: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_SAFETY_UI_CONTRIBUTION_ID, surface: "safety", model: { kind: "safety", args, primitives } } }).html,
    renderProgressRiskSummary: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_SAFETY_UI_CONTRIBUTION_ID, surface: "risk-summary", model: { kind: "risk-summary", args, primitives } } }).html,
  });
}
