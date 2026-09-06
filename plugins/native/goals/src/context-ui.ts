import type { UiContribution } from "@adeptify/goalboard-contracts/platform/ui";
import type { GoalsContextItem, GoalsContextView, GoalsContextUiPrimitives } from "./context-ui-model.js";
import { createGoalContextRecordsRenderer } from "./context-records-ui.js";
import { createGoalContextCoverageRenderer } from "./context-coverage-ui.js";
import { createGoalDraftRenderer } from "./draft-ui.js";

function createContextRenderer(primitives: GoalsContextUiPrimitives) {
  const { translate: L, escapeHtml, icon, subsectionHeading, renderFocusSectionDeck } = primitives;
  const records = createGoalContextRecordsRenderer(primitives);
  const { renderAcceptanceSummary } = records;
  const { renderDraftEditor, renderDraftGaps } = createGoalDraftRenderer(primitives);
  const { renderCompletionBoundaries, renderChildProgress, renderDependencySummary, renderContractCoverage } = createGoalContextCoverageRenderer(primitives);
function renderGoalCompletionPanel(item: GoalsContextItem, view: GoalsContextView, artifactContext = ""): string {
  const goal = item.goal;
  const goalId = escapeHtml(goal.goal_id);
  const purposeBody = `${item.status === "clarification_decision_pending" ? "" : `<div class="goal-purpose"><section><h3>${L("完成后会得到什么")}</h3><p>${escapeHtml(goal.outcome || L("还没有写清预期结果。"))}</p></section><section><h3>${L("为什么现在做")}</h3><p>${escapeHtml(goal.why || L("还没有写清为什么要做。"))}</p></section><section><h3>${L("它会怎样运转")}</h3><p>${escapeHtml(goal.business_logic || L("还没有写清实际使用方式。"))}</p></section></div>`}
    ${goal.definition_state === "draft" ? `<details class="goal-edit-disclosure" id="goal-definition-${goalId}"><summary>${icon("settings")}<span><strong>${L("修改这条草稿")}</strong><small>${L("补全目标、范围和完成标准；保存后仍要经过确认才能开始。")}</small></span>${icon("chevron-down")}</summary>${renderDraftEditor(item)}</details>` : ""}`;
  const completionBody = `<div class="document-subsection" id="acceptance-${goalId}">${subsectionHeading("check", "完成标准", "每一条都应该能明确判断是否达到。")}${renderAcceptanceSummary(item)}</div>
    ${renderContractCoverage(item, view)}
    ${renderChildProgress(item, view)}
    <div class="document-subsection">${subsectionHeading("folder", "工作边界", "明确这次做什么、不做什么。")}${renderCompletionBoundaries(item)}</div>
    <div class="document-subsection">${subsectionHeading("link", "前置事项", "未完成的前置事项会阻止这条 Goal 开始。")}${renderDependencySummary(item, view)}</div>`;
  const contextDeck = renderFocusSectionDeck([
    { key: "purpose", iconName: "book", title: L("目标说明"), description: L("结果、原因和实际运转方式"), body: purposeBody, active: true, cardId: `purpose-${goalId}`, cardAttributes: `data-goal-section="purpose"` },
    { key: "completion", iconName: "clipboard", title: L("完成要求"), description: L("完成标准、工作边界、子 Goal 和前置事项"), body: completionBody, cardId: `completion-${goalId}`, cardAttributes: `data-goal-section="completion"` },
    ...(artifactContext ? [{ key: "artifacts", iconName: "file" as const, title: L("关联结果"), description: L("明确关联的 Artifact 版本；查看不会改变 Goal 或 Evidence。"), body: artifactContext }] : []),
  ], L("上下文"), "focus-section-deck--context");
  return `<header class="focus-panel-heading">${icon("book")}<div><h2>${L("目标上下文")}</h2><p>${L("先扫一眼结构，再展开现在需要阅读或修改的部分。")}</p></div></header>${contextDeck}`;
}


  return { renderGoalCompletionPanel, renderAcceptance: records.renderAcceptance, renderAcceptanceSummary, renderScope: records.renderScope, renderDraftEditor, renderDraftGaps, renderGoalRecordBasics: records.renderGoalRecordBasics, renderGoalRecordRelations: records.renderGoalRecordRelations };
}
export type GoalsContextRenderer = ReturnType<typeof createContextRenderer>;
export const GOALS_CONTEXT_UI_CONTRIBUTION_ID = "io.goalboard.native.goals.context.v1";
export type GoalsContextUiModel = { primitives: GoalsContextUiPrimitives } & (
  | { kind: "panel"; args: Parameters<GoalsContextRenderer["renderGoalCompletionPanel"]> }
  | { kind: "acceptance"; args: Parameters<GoalsContextRenderer["renderAcceptance"]> }
  | { kind: "acceptance-summary"; args: Parameters<GoalsContextRenderer["renderAcceptanceSummary"]> }
  | { kind: "scope"; args: Parameters<GoalsContextRenderer["renderScope"]> }
  | { kind: "draft-editor"; args: Parameters<GoalsContextRenderer["renderDraftEditor"]> }
  | { kind: "draft-gaps"; args: Parameters<GoalsContextRenderer["renderDraftGaps"]> }
  | { kind: "record-basics"; args: Parameters<GoalsContextRenderer["renderGoalRecordBasics"]> }
  | { kind: "record-relations"; args: Parameters<GoalsContextRenderer["renderGoalRecordRelations"]> }
);
export const goalsContextUiContribution: UiContribution<GoalsContextUiModel> = {
  descriptor: {
    contribution_id: GOALS_CONTEXT_UI_CONTRIBUTION_ID, plugin_id: "io.goalboard.native.goals", kind: "embedded", label: "Goal context and draft",
    surfaces: ["panel", "acceptance", "acceptance-summary", "scope", "draft-editor", "draft-gaps", "record-basics", "record-relations"].map(surface_id => ({ surface_id, target_slot_id: "workbench.main", format: "declarative-html" })), slots: [],
  },
  render({ surface, model }) {
    if (surface !== model.kind) throw new Error("Goals context surface does not match its model");
    const renderer = createContextRenderer(model.primitives);
    switch (model.kind) {
      case "panel": return renderer.renderGoalCompletionPanel(...model.args);
      case "acceptance": return renderer.renderAcceptance(...model.args);
      case "acceptance-summary": return renderer.renderAcceptanceSummary(...model.args);
      case "scope": return renderer.renderScope(...model.args);
      case "draft-editor": return renderer.renderDraftEditor(...model.args);
      case "draft-gaps": return renderer.renderDraftGaps(...model.args);
      case "record-basics": return renderer.renderGoalRecordBasics(...model.args);
      case "record-relations": return renderer.renderGoalRecordRelations(...model.args);
    }
  },
};
