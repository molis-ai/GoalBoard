import { createLocalHostWorkbenchRenderer } from "@adeptify/goalboard-app-local-host";
import { desktopWorkbenchRendererPorts } from "@adeptify/goalboard-app-desktop";
export { countGoalDecisions } from "@adeptify/goalboard-plugin-goals";
export type { GoalBoardWebView } from "@adeptify/goalboard-app-workbench";
export type { WebSettingsProject, WebInstallationDiagnostics, GoalBoardSettingsView } from "@adeptify/goalboard-app-workbench";
export { GOAL_EVENT_PAGE_SIZE as WEB_GOAL_EVENT_PAGE_SIZE } from "@adeptify/goalboard-app-workbench";
export { type GoalPresentationState as WebGoalStatus, GOALS_PRESENTATION_STATES as WEB_GOAL_STATUSES, type GoalsCoverageItem as WebCoverageItem, type GoalsInputBinding as WebInputBinding, type GoalsPolicyBinding as WebPolicyBinding, type GoalsDecisionEvent as WebEventRecord, type GoalsSafetyRisk as WebRiskRecord, type GoalsDocumentView as WebGoalView } from "@adeptify/goalboard-app-workbench";
export { WORK_TAB_VISIBILITY_CLIENT_SCRIPT } from "@adeptify/goalboard-app-workbench";
export type { WebProjectNavigation, WebSettingsSection } from "@adeptify/goalboard-app-workbench";
export { GOAL_TREE_STATUS_ORDER, sortGoalTreeItems } from "@adeptify/goalboard-app-workbench";
export {
  activeOutgoingDependsOn, goalWorkSatisfied, displayedPassedCriterionIds, isBlockedWorkStatus,
  firstBlockedDescendant, unsatisfiedOutgoingDependencies, goalTreeReferenceLabel, goalTreeReferenceLabels,
} from "@adeptify/goalboard-app-workbench";
export type { GoalDocumentCollection, LazyGoalPanel } from "@adeptify/goalboard-app-workbench";
export type { GoalBoardOnboardingRenderOptions } from "@adeptify/goalboard-app-workbench";

export const { renderGoalBoardProjectIndex, renderGoalBoardSettings, renderDecisionCenter, renderPersistedFeedItemDetail, renderFeedWorkbenchFragment, renderGoalDocumentFragment, renderGoalPanelFragment, renderGoalQuickRecordFragment, renderGoalRecordsFragment, renderGoalRecordEventsFragment, renderGoalBoardMomentumFragment, renderGoalBoardOnboarding, renderGoalBoardProjectSettings, renderGoalBoardProjectGuidanceSettings, renderGoalBoardPlanningLibrary, renderGoalBoardPlanningMethodPage, renderGoalBoardPlanningSettings, renderGoalBoardWorkbenchStylesheet, renderGoalBoardOnboardingStylesheet, renderGoalBoardProjectIndexStylesheet, renderGoalBoardSettingsStylesheet, renderGoalBoardWorkbenchClientScript, renderGoalBoardWeb, renderGoalBoardRefreshFragment } = createLocalHostWorkbenchRenderer(desktopWorkbenchRendererPorts);
