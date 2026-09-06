import type { UiHostApi, UiSlotDescriptor } from "@adeptify/goalboard-contracts/platform/ui";
import { GOALS_CONTEXT_UI_CONTRIBUTION_ID, type GoalsContextRenderer, type GoalsContextUiPrimitives } from "@adeptify/goalboard-plugin-goals";

export function createGoalsContextWorkbenchRenderer(host: UiHostApi, slot: UiSlotDescriptor) {
  return (primitives: GoalsContextUiPrimitives): GoalsContextRenderer => ({
    renderAcceptanceSummary: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "acceptance-summary", model: { kind: "acceptance-summary", args, primitives } } }).html,
    renderGoalCompletionPanel: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "panel", model: { kind: "panel", args, primitives } } }).html,
    renderAcceptance: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "acceptance", model: { kind: "acceptance", args, primitives } } }).html,
    renderScope: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "scope", model: { kind: "scope", args, primitives } } }).html,
    renderDraftEditor: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "draft-editor", model: { kind: "draft-editor", args, primitives } } }).html,
    renderDraftGaps: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "draft-gaps", model: { kind: "draft-gaps", args, primitives } } }).html,
    renderGoalRecordBasics: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "record-basics", model: { kind: "record-basics", args, primitives } } }).html,
    renderGoalRecordRelations: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "record-relations", model: { kind: "record-relations", args, primitives } } }).html,
  });
}
