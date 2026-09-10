import type { UiContribution } from "@adeptify/goalboard-contracts/platform/ui";
import type { GoalsContextUiPrimitives } from "./context-ui-model.js";
import { createGoalContextRecordsRenderer } from "./context-records-ui.js";
import { createGoalContextCoverageRenderer } from "./context-coverage-ui.js";
import { createGoalDraftRenderer } from "./draft-ui.js";

function createContextRenderer(primitives: GoalsContextUiPrimitives) {
  const { renderAcceptanceSummary } = createGoalContextRecordsRenderer(primitives);
  const { renderDraftEditor, renderDraftGaps } = createGoalDraftRenderer(primitives);
  const { renderChildProgress, renderContractCoverage } = createGoalContextCoverageRenderer(primitives);
  return { renderAcceptanceSummary, renderDraftEditor, renderDraftGaps, renderChildProgress, renderContractCoverage };
}
export type GoalsContextRenderer = ReturnType<typeof createContextRenderer>;
export const GOALS_CONTEXT_UI_CONTRIBUTION_ID = "io.goalboard.native.goals.context.v1";
export type GoalsContextUiModel = { primitives: GoalsContextUiPrimitives } & (
  | { kind: "acceptance-summary"; args: Parameters<GoalsContextRenderer["renderAcceptanceSummary"]> }
  | { kind: "draft-editor"; args: Parameters<GoalsContextRenderer["renderDraftEditor"]> }
  | { kind: "draft-gaps"; args: Parameters<GoalsContextRenderer["renderDraftGaps"]> }
  | { kind: "child-progress"; args: Parameters<GoalsContextRenderer["renderChildProgress"]> }
  | { kind: "contract-coverage"; args: Parameters<GoalsContextRenderer["renderContractCoverage"]> }
);
export const goalsContextUiContribution: UiContribution<GoalsContextUiModel> = {
  descriptor: {
    contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, plugin_id: "io.goalboard.native.goals", kind: "embedded", label: "Goal context and draft",
    surfaces: ["acceptance-summary", "draft-editor", "draft-gaps", "child-progress", "contract-coverage"].map(surface_id => ({ surface_id, target_slot_id: "workbench.main", format: "declarative-html" })), slots: [],
  },
  render({ surface, model }) {
    if (surface !== model.kind) throw new Error("Goals context surface does not match its model");
    const renderer = createContextRenderer(model.primitives);
    switch (model.kind) {
      case "acceptance-summary": return renderer.renderAcceptanceSummary(...model.args);
      case "draft-editor": return renderer.renderDraftEditor(...model.args);
      case "draft-gaps": return renderer.renderDraftGaps(...model.args);
      case "child-progress": return renderer.renderChildProgress(...model.args);
      case "contract-coverage": return renderer.renderContractCoverage(...model.args);
    }
  },
};
