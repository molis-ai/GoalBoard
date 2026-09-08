export { createWorkbenchDecisionCenterRenderer, type WorkbenchDecisionGroup } from "./decision-center.js";

export { decisionTypeCounts } from "@adeptify/goalboard-plugin-goals";

export { buildDecisionGroups, pendingDecisionCount, decisionGroupCount, goalTreeProposalNeedsDecision, createGoalsDecisionResults, type GoalsDecisionGroup, type GoalsDecisionEvent } from "@adeptify/goalboard-plugin-goals";

export { candidateOwnerGoalId, resolvedProposalGoalId } from "@adeptify/goalboard-plugin-goals";

export { allGoalViews, findGoalView } from "@adeptify/goalboard-plugin-goals";

export { createWorkbenchGoalsPageRenderer } from "./goals-page-renderer.js";

export { renderWorkbenchPlanningRequest } from "./goals-planning-request.js";

export type { WorkbenchPlanningPageOwners } from "./goals-planning-request.js";

export type { WorkbenchGoalsPageView, WorkbenchGoalsPageOwners } from "./goals-page-renderer.js";

export type { ArtifactWorkbenchRequest } from "./artifact-ui.js";

export { ARTIFACT_EMBED_STYLES } from "./artifact-ui.js";

export type { ArtifactBrowserUiModel } from "@adeptify/goalboard-plugin-artifacts";

export { PROJECT_OPERATIONS_STYLES, PROJECT_OPERATIONS_CLIENT_SCRIPT } from "@adeptify/goalboard-plugin-work";

export type { ProjectOperationsProject, ProjectOperationsData, ProjectOperationsSlice, ProjectSessionRecord, ProjectWorkspaceRecord } from "@adeptify/goalboard-plugin-work";

export { createGoalActionPresenter, createGoalStateExplainer, goalPresentationState, GOAL_DISPLAY_STATUSES, type GoalPresentationState } from "@adeptify/goalboard-plugin-goals";

export { PLANNING_SETTINGS_STYLES, type GoalsPlanningPrimitives } from "@adeptify/goalboard-plugin-goals";

export { matchGoalsPlanningRoute } from "@adeptify/goalboard-plugin-goals";

export { resolveGoalsReadRoute, resolveGoalsPageRoute, type GoalDocumentCollection, type LazyGoalPanel } from "@adeptify/goalboard-plugin-goals";

export { buildGoalsNavigationItems } from "@adeptify/goalboard-plugin-goals";

export { buildGoalCollectionModel } from "@adeptify/goalboard-plugin-goals";

export { createWorkbenchGoalsFragmentRenderer, type GoalsFragmentRenderers } from "./goals-fragment-renderer.js";

export { renderWorkbenchGoalsReadRoute, renderWorkbenchGoalsReadRequest, renderWorkbenchGoalsPageRequest,
  type GoalsReadRenderers, type WorkbenchGoalPageSelection } from "./goals-document-routes.js";

export { visibleGoalStatus, partOfChildViews, activeOutgoingDependsOn, goalWorkSatisfied, displayedPassedCriterionIds, isBlockedWorkStatus, firstBlockedDescendant, unsatisfiedOutgoingDependencies, goalTreeReferenceLabel, goalTreeReferenceLabels } from "@adeptify/goalboard-plugin-goals";

export { GOALS_RELATION_LABELS } from "@adeptify/goalboard-plugin-goals";

export { goalRiskStateEffect, goalRiskHasUserAction, RISK_STATE_LABELS, RISK_TREATMENT_LABELS, GOAL_TREE_STATUS_ORDER, sortGoalTreeItems, type GoalsSafetyRisk } from "@adeptify/goalboard-plugin-goals";

export { mergeGoalPolicyFormValues, type GoalsPolicyBinding, type GoalsPolicyItem } from "@adeptify/goalboard-plugin-goals";

export { isProjectReference } from "@adeptify/goalboard-plugin-artifacts";


export {
  CLIENT_SCRIPT,
  CONTROL_CLIENT_SCRIPT,
  MORE_STYLES,
  ONBOARDING_CLIENT_SCRIPT,
  PROJECT_GUIDANCE_CLIENT_SCRIPT,
  PROJECT_GUIDANCE_SETTINGS_STYLES,
  PROJECT_INDEX_CLIENT_SCRIPT,
  PROJECT_INDEX_STYLES,
  PROJECT_RULES_CLIENT_SCRIPT,
  PROJECT_RULES_SETTINGS_STYLES,
  RESPONSIVE_STYLES,
  SETTINGS_CLIENT_SCRIPT,
  SETTINGS_STYLES,
  STYLES,
  WORK_TAB_VISIBILITY_CLIENT_SCRIPT,
} from "./browser-assets.js";

export { EN } from "./i18n/en.js";

export {
  createWorkbenchExecutionValidationRenderer,
  EXECUTION_EVIDENCE_KIND_LABELS,
  EXECUTION_EVIDENCE_RESULT_LABELS,
  type WorkbenchExecutionGoalView,
  type WorkbenchExecutionValidationRenderer,
  type WorkbenchExecutionValidationUiDependencies,
} from "./execution-validation-ui.js";


export const packageDescriptor = {
  packageName: "@adeptify/goalboard-app-workbench",
  packagePath: "apps/workbench",
  kind: "app",
  maturity: "partial",
  contract: "@adeptify/goalboard-contracts/platform/app-host",
  migrationGoals: ["goal-reorg-f2", "goal-reorg-fd4", "goal-reorg-ap3", "goal-reorg-gw4", "goal-reorg-gw5", "goal-reorg-ex4"],
  ssot: "docs/SSOT-MATRIX.md",
  capabilities: [
    "workbench.shell.v1",
    "workbench.ui-slots.v1",
    "workbench.feed-composition.v1",
    "workbench.goals-command-adapter.v1",
    "workbench.execution-validation-adapter.v1",
    "workbench.work-composition.v1", "workbench.goals-policy-composition.v1", "workbench.goals-safety-composition.v1", "workbench.goals-relation-composition.v1", "workbench.goals-tree-composition.v1", "workbench.goals-momentum-composition.v1", "workbench.goals-document-composition.v1", "workbench.goals-context-composition.v1", "workbench.goals-planning-composition.v1", "workbench.goals-status-composition.v1", "workbench.goals-factors-composition.v1", "workbench.goals-dialogs-composition.v1", "workbench.goals-document-routes.v1",
  ],
} as const;


export type GoalBoardPackageDescriptor = typeof packageDescriptor;

export { explainGoalDecision, createGoalsDecisionPresentation, type DecisionEventKind } from "@adeptify/goalboard-plugin-goals";


export { createWorkbenchOnboardingRenderer, type GoalBoardOnboardingRenderOptions, type OnboardingRenderPrimitives } from "./onboarding-renderer.js";

export { ONBOARDING_INTENT_FRAMES, onboardingIntentFrame, onboardingIntentFrameDefinition, onboardingPlanningHint, type OnboardingIntentFrame } from "./onboarding-intent.js";

export { TRASH_GOAL_STYLES } from "@adeptify/goalboard-plugin-goals";


export { createWorkbenchSettingsNavigation, type WebProjectNavigation, type WebSettingsSection, type SettingsNavigationPrimitives } from "./settings-navigation.js";

export { createWorkbenchProjectDirectoryRenderer, type ProjectDirectoryPrimitives } from "./project-directory-renderer.js";


export { GOALS_PRESENTATION_STATES, type GoalsDocumentView, type GoalsCoverageItem, type GoalsInputBinding } from "@adeptify/goalboard-plugin-goals";

export { createWorkbenchHumanReviewRenderer, type HumanReviewPrimitives } from "./human-review-renderer.js";

export { createWorkbenchGoalRecordsRenderer, GOAL_EVENT_PAGE_SIZE, type GoalRecordsPrimitives } from "./goal-records-renderer.js";


export type { WebSettingsProject, WebInstallationDiagnostics, GoalBoardSettingsView } from "./settings-view.js";

export { createWorkbenchSettingsRenderer, type SettingsRenderPrimitives } from "./settings-renderer.js";


export type { GoalBoardWebView } from "./page-view.js";


export * from "./i18n.js";

export * from "./ui-composition.js";

export { createWorkbenchFeedProjectionRenderer, type FeedSupplementalEntry } from "./feed-projection-ui.js";

export { createWorkbenchFocusSections, type FocusSectionCardOptions } from "./focus-sections.js";
export { createWorkbenchGoalDocumentPanels, type GoalDocumentPanelOwners } from "./goal-document-panels.js";

export { createWorkbenchProjectSettingsPages, type ProjectSettingsPagePorts } from "./project-settings-pages.js";

export { createWorkbenchRenderer, type WorkbenchRendererPorts, type WorkbenchRenderer } from "./renderer.js";

export { createCapsuleWorkbench, type CapsuleRendererPorts } from "./capsule.js";
export type * from "./capsule-view.js";
