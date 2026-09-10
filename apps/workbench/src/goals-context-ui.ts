import type { UiHostApi, UiSlotDescriptor } from "@adeptify/goalboard-contracts/platform/ui";
import { GOALS_CONTEXT_UI_CONTRIBUTION_ID, type GoalsContextRenderer, type GoalsContextUiPrimitives } from "@adeptify/goalboard-plugin-goals";

export function createGoalsContextWorkbenchRenderer(host: UiHostApi, slot: UiSlotDescriptor) {
  return (primitives: GoalsContextUiPrimitives): GoalsContextRenderer => ({
    renderAcceptanceSummary: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "acceptance-summary", model: { kind: "acceptance-summary", args, primitives } } }).html,
    renderDraftEditor: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "draft-editor", model: { kind: "draft-editor", args, primitives } } }).html,
    renderDraftGaps: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "draft-gaps", model: { kind: "draft-gaps", args, primitives } } }).html,
    renderChildProgress: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "child-progress", model: { kind: "child-progress", args, primitives } } }).html,
    renderContractCoverage: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, surface: "contract-coverage", model: { kind: "contract-coverage", args, primitives } } }).html,
  });
}
