export { createWorkbenchDecisionCenterRenderer, type WorkbenchDecisionGroup } from "./decision-center.js";
export { decisionTypeCounts } from "@adeptify/goalboard-plugin-goals";
import { goalsDecisionResultsUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsDecisionResultsWorkbenchRenderer } from "./goals-decision-results-ui.js";
export { buildDecisionGroups, pendingDecisionCount, decisionGroupCount, goalTreeProposalNeedsDecision, createGoalsDecisionResults, type GoalsDecisionGroup, type GoalsDecisionEvent } from "@adeptify/goalboard-plugin-goals";
import { goalsLegacyProposalUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsLegacyProposalWorkbenchRenderer } from "./goals-legacy-proposal-ui.js";
export { candidateOwnerGoalId, resolvedProposalGoalId } from "@adeptify/goalboard-plugin-goals";
import { goalsProposalUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsProposalWorkbenchRenderer } from "./goals-proposal-ui.js";
export { allGoalViews, findGoalView } from "@adeptify/goalboard-plugin-goals";
import { workUiContribution, workTerminalUiContribution, WORK_TERMINAL_UI_CONTRIBUTION_ID, type WorkTerminalUiModel } from "@adeptify/goalboard-plugin-work";
import { createWorkSessionRenderer } from "./work-ui.js";
export { createWorkbenchGoalsPageRenderer } from "./goals-page-renderer.js";
export { renderWorkbenchPlanningRequest } from "./goals-planning-request.js";
export type { WorkbenchPlanningPageOwners } from "./goals-planning-request.js";
export type { WorkbenchGoalsPageView, WorkbenchGoalsPageOwners } from "./goals-page-renderer.js";
import { createArtifactWorkbenchRenderer } from "./artifact-ui.js";
export type { ArtifactWorkbenchRequest } from "./artifact-ui.js";
export { ARTIFACT_EMBED_STYLES } from "./artifact-ui.js";
export type { ArtifactBrowserUiModel } from "@adeptify/goalboard-plugin-artifacts";
export { PROJECT_OPERATIONS_STYLES, PROJECT_OPERATIONS_CLIENT_SCRIPT } from "@adeptify/goalboard-plugin-work";
export type { ProjectOperationsProject, ProjectOperationsData, ProjectOperationsSlice, ProjectSessionRecord, ProjectWorkspaceRecord } from "@adeptify/goalboard-plugin-work";
import type {
  UiRenderRequest,
  UiSlotDescriptor,
  WorkbenchDocumentRenderRequest,
} from "@adeptify/goalboard-contracts/platform/ui";
import type { GoalsApplicationApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionValidationApplicationApi } from "@adeptify/goalboard-plugin-goals";
import {
  FEED_UI_CONTRIBUTION_ID,
  feedUiContribution,
  type FeedUiSurface,
  type FeedUiModel,
  type PersistedFeedDetailModel,
} from "@adeptify/goalboard-plugin-feed";
import { UiHost } from "@adeptify/goalboard-ui-host";
import { goalsPolicyUiContribution, goalsSafetyUiContribution, goalsRelationUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsRelationWorkbenchRenderer } from "./goals-relation-ui.js";
import { goalsTreeUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsTreeWorkbenchRenderer } from "./goals-tree-ui.js";
import { goalsMomentumUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsMomentumWorkbenchRenderer } from "./goals-momentum-ui.js";
import { goalsDocumentUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsDocumentWorkbenchRenderer } from "./goals-document-ui.js";
import { goalsContextUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsContextWorkbenchRenderer } from "./goals-context-ui.js";
import { goalsPlanningUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsPlanningWorkbenchRenderer } from "./goals-planning-ui.js";
import { goalsStatusUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsStatusWorkbenchRenderer } from "./goals-status-ui.js";
import { goalsFactorsUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsFactorsWorkbenchRenderer } from "./goals-factors-ui.js";
import { goalsDialogsUiContribution } from "@adeptify/goalboard-plugin-goals";
import { createGoalsDialogsWorkbenchRenderer } from "./goals-dialogs-ui.js";
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
import { createGoalsSafetyWorkbenchRenderer } from "./goals-safety-ui.js";
export { goalRiskStateEffect, goalRiskHasUserAction, RISK_STATE_LABELS, RISK_TREATMENT_LABELS, GOAL_TREE_STATUS_ORDER, sortGoalTreeItems, type GoalsSafetyRisk } from "@adeptify/goalboard-plugin-goals";
import { createGoalsPolicyWorkbenchRenderer } from "./goals-policy-ui.js";
export { mergeGoalPolicyFormValues, type GoalsPolicyBinding, type GoalsPolicyItem } from "@adeptify/goalboard-plugin-goals";
import { artifactReferenceUiContribution, artifactBrowserUiContribution, ARTIFACT_REFERENCE_UI_CONTRIBUTION_ID, type ArtifactReferenceUiPrimitives } from "@adeptify/goalboard-plugin-artifacts";
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

export type WorkbenchGoalsAdapter<TTransition = unknown> = GoalsApplicationApi<TTransition>;

export const WORKBENCH_UI_SLOTS = {
  directory: { slot_id: "workbench.directory", version: 1, accepts: ["declarative-html"] },
  main: { slot_id: "workbench.main", version: 1, accepts: ["declarative-html"] },
  overlay: { slot_id: "workbench.overlay", version: 1, accepts: ["declarative-html"] },
} as const satisfies Record<string, UiSlotDescriptor>;

const FEED_SURFACE_SLOTS: Readonly<Record<FeedUiSurface, UiSlotDescriptor>> = {
  directory: WORKBENCH_UI_SLOTS.directory,
  workbench: WORKBENCH_UI_SLOTS.main,
  "workbench-fragment": WORKBENCH_UI_SLOTS.main,
  "source-directory": WORKBENCH_UI_SLOTS.directory,
  "source-workbench": WORKBENCH_UI_SLOTS.main,
  overlays: WORKBENCH_UI_SLOTS.overlay,
  "persisted-detail": WORKBENCH_UI_SLOTS.main,
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderAttributes(attributes: WorkbenchDocumentRenderRequest["body_attributes"]): string {
  return Object.entries(attributes ?? {})
    .filter((entry): entry is [string, string | boolean] => entry[1] !== null && entry[1] !== undefined && entry[1] !== false)
    .map(([name, value]) => value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`)
    .join("");
}

/** Own the stable HTML document shell while product Plugins own their rendered surfaces. */
export function renderWorkbenchDocument(request: WorkbenchDocumentRenderRequest): string {
  return `${request.preamble_html ?? ""}<!doctype html>
<html lang="${escapeHtml(request.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${request.head_before_title_html ?? ""}
  <title>${escapeHtml(request.title)}</title>
  ${request.head_html ?? ""}
</head>
  <body${renderAttributes(request.body_attributes)}>
${request.body_html}
</body>
</html>`;
}

/** Bind Workbench routes to the public Goals Contract without copying Module rules. */
export function createWorkbenchGoalsAdapter<TTransition>(
  goals: GoalsApplicationApi<TTransition>,
): WorkbenchGoalsAdapter<TTransition> {
  return {
    impacts: goals.impacts,
    commands: goals.commands,
    lifecycle: goals.lifecycle,
    planning: goals.planning,
  };
}

export type WorkbenchExecutionValidationAdapter<TSnapshot = unknown> =
  ExecutionValidationApplicationApi<TSnapshot>;

/** Bind Workbench routes and projections to one execution/review application port. */
export function createWorkbenchExecutionValidationAdapter<TSnapshot>(
  application: ExecutionValidationApplicationApi<TSnapshot>,
): WorkbenchExecutionValidationAdapter<TSnapshot> {
  return { query: application.query, commands: application.commands };
}

/** Shared Workbench composition root. Product renderers never import a Plugin implementation directly. */
export function createWorkbenchUiHost(): UiHost {
  const host = new UiHost();
  host.register(feedUiContribution);
  host.register(workUiContribution);
  host.register(workTerminalUiContribution);
  host.register(artifactReferenceUiContribution);
  host.register(artifactBrowserUiContribution);
  host.register(goalsPolicyUiContribution);
  host.register(goalsProposalUiContribution);
  host.register(goalsLegacyProposalUiContribution);
  host.register(goalsDecisionResultsUiContribution);
  host.register(goalsSafetyUiContribution);
  host.register(goalsRelationUiContribution);
  host.register(goalsTreeUiContribution);
  host.register(goalsMomentumUiContribution);
  host.register(goalsDocumentUiContribution);
  host.register(goalsContextUiContribution);
  host.register(goalsPlanningUiContribution);
  host.register(goalsStatusUiContribution);
  host.register(goalsFactorsUiContribution);
  host.register(goalsDialogsUiContribution);
  return host;
}

const workbenchUiHost = createWorkbenchUiHost();
export const createWorkbenchGoalsDecisionResultsRenderer = createGoalsDecisionResultsWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsLegacyProposalRenderer = createGoalsLegacyProposalWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsProposalRenderer = createGoalsProposalWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsPolicyRenderer = createGoalsPolicyWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsSafetyRenderer = createGoalsSafetyWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsRelationRenderer = createGoalsRelationWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsTreeRenderer = createGoalsTreeWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.directory);
export const createWorkbenchGoalsMomentumRenderer = createGoalsMomentumWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsDocumentRenderer = createGoalsDocumentWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsContextRenderer = createGoalsContextWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsPlanningRenderer = createGoalsPlanningWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsStatusRenderer = createGoalsStatusWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsFactorsRenderer = createGoalsFactorsWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.main);
export const createWorkbenchGoalsDialogsRenderer = createGoalsDialogsWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS.overlay);
export const artifactWorkbench = createArtifactWorkbenchRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS, renderWorkbenchDocument);
export function createArtifactReferenceRenderer(primitives: ArtifactReferenceUiPrimitives) {
  return (value: string, label = value, evidenceId?: string): string => workbenchUiHost.mount({
    slot: WORKBENCH_UI_SLOTS.main,
    contribution: {
      contribution_id: ARTIFACT_REFERENCE_UI_CONTRIBUTION_ID,
      surface: "reference",
      model: { value, label, evidenceId, primitives },
    },
  }).html;
}
export const renderProjectOperations = createWorkSessionRenderer(workbenchUiHost, WORKBENCH_UI_SLOTS);
export const renderWorkTerminal = (model: WorkTerminalUiModel): string => workbenchUiHost.mount({
  slot: WORKBENCH_UI_SLOTS.main,
  contribution: { contribution_id: WORK_TERMINAL_UI_CONTRIBUTION_ID, surface: "terminal", model },
}).html;

export function renderFeedContribution(
  surface: UiRenderRequest<FeedUiModel | PersistedFeedDetailModel>["surface"],
  model: FeedUiModel | PersistedFeedDetailModel,
): string {
  return workbenchUiHost.mount({
    slot: FEED_SURFACE_SLOTS[surface as FeedUiSurface],
    contribution: {
      contribution_id: FEED_UI_CONTRIBUTION_ID,
      surface,
      model,
    },
  }).html;
}

export function listWorkbenchUiContributions() {
  return workbenchUiHost.list();
}
export { explainGoalDecision, createGoalsDecisionPresentation, type DecisionEventKind } from "@adeptify/goalboard-plugin-goals";
