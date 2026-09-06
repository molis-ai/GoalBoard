import { createWorkbenchDecisionCenterRenderer, decisionTypeCounts, type WorkbenchDecisionGroup } from "@adeptify/goalboard-app-workbench";
const decisionCenterRenderer = createWorkbenchDecisionCenterRenderer({ translate: L, escapeHtml, icon, currentLocale, formatDate });
import { buildDecisionGroups, pendingDecisionCount, decisionGroupCount, createGoalsDecisionResults, createWorkbenchGoalsDecisionResultsRenderer, type GoalsDecisionGroup } from "@adeptify/goalboard-app-workbench";
const { recentDecisionResults } = createGoalsDecisionResults(L);
const renderRecentDecisionResults = createWorkbenchGoalsDecisionResultsRenderer({ translate: L, escapeHtml, icon, formatDate });
type DecisionGoalGroup = GoalsDecisionGroup<WebGoalView>;
import { createWorkbenchGoalsLegacyProposalRenderer } from "@adeptify/goalboard-app-workbench";
const { renderRewireDecision, renderResolvedDependencyHistory, renderContractProposal, renderCandidateDecision } =
  createWorkbenchGoalsLegacyProposalRenderer({ translate: L, escapeHtml, icon, renderList, renderReference, defaultPolicy: DEFAULT_GOAL_POLICY });
import { createWorkbenchGoalsFragmentRenderer } from "@adeptify/goalboard-app-workbench";
import type { GoalInputBindingRecord } from "@adeptify/goalboard-contracts/modules/goals";
import { createWorkbenchGoalsPageRenderer } from "@adeptify/goalboard-app-workbench";
import { buildGoalsNavigationItems } from "@adeptify/goalboard-app-workbench";
import type {
  BoardSnapshot,
  ClaimRecord,
  DecisionReason,
  EvidenceRecord,
  GoalActionProjection,
  GoalDisplayStatus,
  GoalPolicy,
  GoalRecord,
  GoalRelationRecord,
  GoalWorkState,
  GoalWorkStateView,
  ImpactBindingRecord,
  ProjectGuidanceView,
  ReviewObligationRecord,
  ReviewRecord,
  RiskRecord,
  RunRecord,
} from "../v1/types.js";
import { DEFAULT_GOAL_POLICY } from "../v1/types.js";
import { ARTIFACT_EMBED_STYLES } from "@adeptify/goalboard-app-workbench";
import {
  composePlanningMethodPacks,
  type PlanningMethodPack,
} from "@adeptify/goalboard-module-goals";
import type { RuntimeIntegrationDetection } from "@adeptify/goalboard-app-local-host";
import type { GoalBoardWebServiceDetection } from "@adeptify/goalboard-app-local-host";
import { icon, renderIconSprite, type GoalBoardIcon } from "./icons.js";
import { ONBOARDING_INTENT_FRAMES } from "./onboarding-intent.js";
import {
  L,
  currentLocale,
  htmlLang,
  dateTimeLocale,
  listJoin,
  localeSwitchHref,
  clientI18nScript,
} from "./i18n.js";
import {
  appendDesktopQueryToLocalHrefs,
  NATIVE_DESKTOP_BOOTSTRAP_SCRIPT,
  withDesktopQuery,
} from "@adeptify/goalboard-app-desktop";
import {
  THEME_BOOTSTRAP_SCRIPT as BASE_THEME_BOOTSTRAP_SCRIPT,
  VISUAL_FOUNDATION_CLIENT_SCRIPT,
  VISUAL_FOUNDATION_STYLES,
} from "@adeptify/goalboard-design-system";
import {
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
  createWorkbenchExecutionValidationRenderer,
  createWorkbenchGoalsPolicyRenderer,
  createWorkbenchGoalsSafetyRenderer,
  createWorkbenchGoalsRelationRenderer,
  createWorkbenchGoalsTreeRenderer,
  createWorkbenchGoalsMomentumRenderer,
  createWorkbenchGoalsDocumentRenderer,
  createWorkbenchGoalsContextRenderer,
  createWorkbenchGoalsPlanningRenderer,
  createWorkbenchGoalsStatusRenderer, createGoalStateExplainer,
  createWorkbenchGoalsFactorsRenderer,
  createWorkbenchGoalsDialogsRenderer,
  GOAL_DISPLAY_STATUSES, type GoalPresentationState,
  PLANNING_SETTINGS_STYLES,
  partOfChildViews, displayedPassedCriterionIds,
  goalRiskStateEffect,
  RISK_STATE_LABELS, RISK_TREATMENT_LABELS, sortGoalTreeItems,
  type GoalsPolicyBinding,
  createArtifactReferenceRenderer,
  isProjectReference,
  EXECUTION_EVIDENCE_KIND_LABELS as EVIDENCE_KIND_LABELS,
  EXECUTION_EVIDENCE_RESULT_LABELS as EVIDENCE_RESULT_LABELS,
  renderWorkbenchDocument,
} from "@adeptify/goalboard-app-workbench";
export { WORK_TAB_VISIBILITY_CLIENT_SCRIPT } from "@adeptify/goalboard-app-workbench";
import { explainGoalDecision, createGoalsDecisionPresentation } from "@adeptify/goalboard-app-workbench";
const explainDecision = (kind: Parameters<typeof explainGoalDecision>[0]) => explainGoalDecision(kind, L);
const { renderNewDecisionBadge, renderDecisionGuidance, renderDecisionScenario } =
  createGoalsDecisionPresentation({ translate: L, escapeHtml });
import { createWorkbenchGoalsProposalRenderer, allGoalViews } from "@adeptify/goalboard-app-workbench";
const { renderGoalTreeProposalDecision } = createWorkbenchGoalsProposalRenderer({ translate: L, escapeHtml, icon, renderList });
import type {
  FeedItemRecord,
  FeedItemType,
  FeedSnapshot,
  InboxEntryRecord,
  RelayImportAvailability,
} from "../feed/types.js";
import type { FeedSourceCatalogView } from "../feed/sources/service.js";
import type { ConnectorAuthStatus } from "../feed/connectors/service.js";
import {
  PROJECT_OPERATIONS_CLIENT_SCRIPT,
  PROJECT_OPERATIONS_STYLES,
  renderProjectOperations,
  renderWorkTerminal,
} from "@adeptify/goalboard-app-workbench";
import {
  renderFeedNativePluginPersistedDetail,
  renderFeedNativePluginSurface,
  type FeedSupplementalEntry,
} from "./feed-native-plugin-ui.js";
const { explainWorkState, explainParentCompletion } = createGoalStateExplainer(L);

const THEME_BOOTSTRAP_SCRIPT = `${BASE_THEME_BOOTSTRAP_SCRIPT}${NATIVE_DESKTOP_BOOTSTRAP_SCRIPT}`;

export type WebGoalStatus = GoalPresentationState;

export const WEB_GOAL_STATUSES: readonly WebGoalStatus[] = [
  "clarification_pending",
  "clarification_decision_pending",
  "compound_closure_pending",
  "clarifying",
  "clarification_blocked",
  "waiting_children",
  "execution_pending",
  "executing",
  "execution_blocked",
  "completion_pending",
  "completion_blocked",
  "review_pending",
  "reviewing",
  "review_blocked",
  "waiting_for_human",
  "revalidation_pending",
  "revalidating",
  "revalidation_blocked",
  "replaced",
  "invalidated",
  "satisfied",
  "trashed",
  "archived",
];

export interface WebCoverageItem {
  requirement_id: string;
  statement: string;
  disposition: string;
  owner_goal_id: string | null;
  reason: string | null;
  revisit_condition: string | null;
  blocking: boolean;
  created_at: string;
  updated_at: string;
}

export type WebInputBinding = Omit<GoalInputBindingRecord, "board_id">;

export type WebPolicyBinding = GoalsPolicyBinding;

export type WebEventRecord = import("@adeptify/goalboard-app-workbench").GoalsDecisionEvent;

export type WebRiskRecord = import("@adeptify/goalboard-app-workbench").GoalsSafetyRisk;

export interface WebGoalView {
  goal: GoalRecord;
  status: WebGoalStatus;
  action_projection: GoalActionProjection;
  display_status: GoalDisplayStatus;
  work_state: GoalWorkState;
  status_label: string;
  main_action_label: string;
  action_summary: string;
  reasons: DecisionReason[];
  active_claim_actor: string | null;
  active_claim: ClaimRecord | null;
  active_claim_lease: GoalWorkStateView["active_claim_lease"];
  claims: ClaimRecord[];
  runs: RunRecord[];
  evidence: EvidenceRecord[];
  review_obligations: ReviewObligationRecord[];
  reviews: ReviewRecord[];
  risks: WebRiskRecord[];
  impacts: ImpactBindingRecord[];
  relations: GoalRelationRecord[];
  coverage: WebCoverageItem[];
  input_bindings: WebInputBinding[];
  policy_bindings: WebPolicyBinding[];
  events: WebEventRecord[];
  resolved_policy: GoalPolicy;
  passed_criteria: string[];
  pending_reviews: string[];
}

const {
  renderClaimCell,
  renderRunCell,
  renderEvidenceForm,
  renderEvidenceCell,
  renderReviewCell,
} = createWorkbenchExecutionValidationRenderer({
  translate: L,
  escapeHtml,
  formatDate,
  renderIcon: (name) => icon(name as GoalBoardIcon),
  renderReference,
  isProjectReference,
  currentLocale,
});

export interface WebProjectNavigation {
  project_id: string;
  display_name: string;
  data_class?: "user" | "migrated_user" | "regenerable_demo";
}

export type WebSettingsSection = "appearance" | "runtimes" | "projects" | "diagnostics";

export interface WebSettingsProject extends WebProjectNavigation {
  database_path: string;
  source: "created" | "migrated";
  data_class: "user" | "migrated_user" | "regenerable_demo";
  created_at: string;
}

export interface WebInstallationDiagnostics {
  home_directory: string;
  installation_state: "ready" | "missing" | "invalid";
  version: string | null;
  release_directory: string | null;
  project_count: number;
  launchers: Array<{
    name: "CLI" | "MCP" | "Web";
    path: string;
    state: "ready" | "missing";
  }>;
}

export interface GoalBoardSettingsView {
  section: WebSettingsSection;
  context_project?: WebProjectNavigation | null;
  runtimes: RuntimeIntegrationDetection[];
  projects: WebSettingsProject[];
  web_service: GoalBoardWebServiceDetection;
  diagnostics: WebInstallationDiagnostics;
}

export interface GoalBoardWebView {
  snapshot: BoardSnapshot;
  project: WebProjectNavigation | null;
  projects: WebProjectNavigation[];
  /** Empty only for in-process test fixtures; normal Web URLs are project-scoped. */
  route_prefix: string;
  demo: boolean;
  active_goal_id: string | null;
  goals: WebGoalView[];
  archived_goals: WebGoalView[];
  trashed_goals: WebGoalView[];
  counts: Record<WebGoalStatus, number>;
  coverage: WebCoverageItem[];
  input_bindings: WebInputBinding[];
  policy_bindings: WebPolicyBinding[];
  events: WebEventRecord[];
  feed: FeedSnapshot;
  relay_import: RelayImportAvailability;
  feed_source_catalog?: FeedSourceCatalogView[];
  feed_connector_auth?: ConnectorAuthStatus;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function controlTokenMeta(controlToken: string): string {
  return `<meta name="goalboard-control-token" content="${escapeHtml(controlToken)}">`;
}

function dataJson(view: GoalBoardWebView): string {
  const summarize = (items: WebGoalView[]) => buildGoalsNavigationItems(
    items, goalId => partOfChildViews(goalId, view), visibleGoalStatusIcon,
  );
  return JSON.stringify({
    snapshot: {
      board: { board_id: view.snapshot.board.board_id },
      cursor: view.snapshot.cursor,
    },
    project: view.project,
    active_goal_id: view.active_goal_id,
    goals: summarize(view.goals),
    archived_goals: summarize(view.archived_goals),
    trashed_goals: summarize(view.trashed_goals),
  }).replaceAll("<", "\\u003c");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return L("未记录");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(dateTimeLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

const artifactReferenceRenderer = createArtifactReferenceRenderer({ escape: escapeHtml, icon, text: L });
function renderReference(value: string, label = value, evidenceId?: string): string {
  return artifactReferenceRenderer(value, label, evidenceId);
}

function renderList(values: string[], empty: string): string {
  if (values.length === 0) return `<p class="empty-row">${escapeHtml(L(empty))}</p>`;
  return `<ul class="doc-list">${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

const { renderStatus, renderActionStatus, renderVisibleGoalStatus, visibleGoalStatusIcon } = createWorkbenchGoalsStatusRenderer({ translate: L, escapeHtml, icon });

export { GOAL_TREE_STATUS_ORDER, sortGoalTreeItems } from "@adeptify/goalboard-app-workbench";

function sortGoals(items: WebGoalView[]): WebGoalView[] {
  return sortGoalTreeItems(items);
}

const goalsTreeRenderer = createWorkbenchGoalsTreeRenderer({
  translate: L, escapeHtml, currentLocale, listJoin, icon,
  renderStatus, renderActionStatus, renderVisibleGoalStatus, displayStatuses: GOAL_DISPLAY_STATUSES,
});

export {
  activeOutgoingDependsOn, goalWorkSatisfied, displayedPassedCriterionIds, isBlockedWorkStatus,
  firstBlockedDescendant, unsatisfiedOutgoingDependencies, goalTreeReferenceLabel, goalTreeReferenceLabels,
} from "@adeptify/goalboard-app-workbench";

const { renderGoalMomentum, renderMomentumPlaceholder } = createWorkbenchGoalsMomentumRenderer({
  translate: L, escapeHtml, currentLocale, icon, renderVisibleGoalStatus,
});

const goalsRelationRenderer = createWorkbenchGoalsRelationRenderer({ translate: L, escapeHtml, icon });
const renderRelationForm = goalsRelationRenderer.renderRelationForm;
function renderRelations(item: WebGoalView, view: GoalBoardWebView, editable = true): string {
  return goalsRelationRenderer.renderRelations(item, view, editable, renderResolvedDependencyHistory(item, view));
}

const { renderAcceptanceSummary, renderDraftGaps, renderGoalCompletionPanel, renderGoalRecordBasics, renderGoalRecordRelations } = createWorkbenchGoalsContextRenderer({
  translate: L, escapeHtml, icon, currentLocale, listJoin, renderList, renderReference, formatDate,
  subsectionHeading, renderFocusSectionDeck, explainWorkState, explainParentCompletion,
});

function renderReasons(item: WebGoalView): string {
  const blockers = item.reasons.filter((reason) => reason.severity === "blocker");
  if (!blockers.length) {
    return `<p class="clear-row"><span class="check-box is-checked">${icon("check")}</span>${L("当前没有阻塞项")}</p>`;
  }
  return `<ul class="blocker-list">${blockers
    .map(
      (reason) =>
        `<li>${icon("blocked")}<span><strong>${escapeHtml(reason.message)}</strong>${
          reason.remediation ? `<small>${L("建议：")}${escapeHtml(reason.remediation)}</small>` : ""
        }</span></li>`,
    )
    .join("")}</ul>`;
}

const { renderRiskWorkbench, renderImpactWorkbench, renderSafety, renderQuickRiskForm, renderQuickImpactForm, renderProgressRiskSummary } = createWorkbenchGoalsSafetyRenderer({
  translate: L, escapeHtml, formatDate, icon, currentLocale, renderReference, renderList,
});
const riskStateEffect = (blocking: RiskRecord["blocking_mode"], state: RiskRecord["state"]) => goalRiskStateEffect(L, blocking, state);

const { renderProjectPolicyDocument, renderPolicyEditor, renderProgressCheckSummary } = createWorkbenchGoalsPolicyRenderer({
  translate: L, escapeHtml, formatDate, icon, currentLocale, defaultPolicy: DEFAULT_GOAL_POLICY,
});

function riskDecisionCreatedAt(risk: RiskRecord, view: GoalBoardWebView): string {
  return view.events.find(
    (event) => event.object_id === risk.risk_id && (event.type === "risk.open" || event.type === "risk.triggered"),
  )?.at ?? risk.created_at;
}

function renderHumanReviewScenario(item: WebGoalView): string {
  const criteria = item.goal.acceptance_criteria;
  const pendingHumanCriterionIds = new Set(
    item.review_obligations
      .filter((obligation) => obligation.role === "human_approver" && obligation.state === "pending")
      .flatMap((obligation) => obligation.criterion_scope),
  );
  const criterion = criteria.find(
    (entry) =>
      entry.decision_method === "human_decision" &&
      pendingHumanCriterionIds.has(entry.criterion_id) &&
      !item.passed_criteria.includes(entry.criterion_id),
  ) ?? criteria.find((entry) => !item.passed_criteria.includes(entry.criterion_id)) ?? criteria[0];
  const linkedEvidence = criterion
    ? item.evidence.filter((evidence) => evidence.lifecycle_state === "effective" && evidence.criterion_ids.includes(criterion.criterion_id)).slice().reverse()
    : [];
  const evidence = linkedEvidence.find((entry) => entry.result === "passed") ?? linkedEvidence[0];
  let contextLabel = L("目前还缺");
  let contextEffect = L("这条 Goal 还没有完成标准，暂时无法判断结果是否完成。");
  if (criterion?.decision_method === "human_decision") {
    contextLabel = L("需要你判断");
    contextEffect = L("完成标准「{criterion}」只能由你根据实际体验判断。选择“通过”并说明理由后，GoalBoard 会把这次确认同时记录为该标准的人工结论依据。", {
      criterion: criterion.statement,
    });
  } else if (criterion && evidence?.result === "passed") {
    const evidenceSummary = evidence.digest?.trim() || evidence.locator;
    contextLabel = L("当前依据");
    contextEffect = L("完成标准「{criterion}」已有一条通过依据「{evidence}」。这份记录支持该标准，但不等于你已经确认通过。", {
      criterion: criterion.statement,
      evidence: evidenceSummary,
    });
  } else if (criterion && evidence) {
    contextEffect = L("完成标准「{criterion}」现有依据「{evidence}」，记录结果是“{result}”，还不能证明已经达到标准。", {
      criterion: criterion.statement,
      evidence: evidence.digest?.trim() || evidence.locator,
      result: L(EVIDENCE_RESULT_LABELS[evidence.result]),
    });
  } else if (criterion) {
    contextEffect = L("完成标准「{criterion}」还没有对应的通过依据，现在不应选择“通过”。", {
      criterion: criterion.statement,
    });
  }
  const unpassedNonHumanCriterionCount = criteria.filter(
    (entry) => entry.decision_method !== "human_decision" && !item.passed_criteria.includes(entry.criterion_id),
  ).length;
  const hasHumanDecisionCriterion = criteria.some(
    (entry) => entry.decision_method === "human_decision" && pendingHumanCriterionIds.has(entry.criterion_id),
  );
  const otherPendingReviewCount = item.review_obligations.filter(
    (obligation) => obligation.state === "pending" && obligation.role !== "human_approver",
  ).length;
  const blockingRiskCount = item.risks.filter(
    (risk) => (risk.state === "open" || risk.state === "triggered") && risk.blocking_mode !== "none",
  ).length;
  const remainingGateCount = otherPendingReviewCount + blockingRiskCount;
  const confirmEffect = unpassedNonHumanCriterionCount > 0
    ? L("即使选择“通过”，Goal「{title}」仍有 {count} 条由测试或检查判断的完成标准缺少通过依据，不会完成。请先补齐依据。", {
        title: item.goal.title,
        count: unpassedNonHumanCriterionCount,
      })
    : remainingGateCount > 0
      ? L("选择“通过”会记录这次用户检查{humanEvidence}；Goal「{title}」还会等待 {count} 项其他检查或风险处理，不会马上完成。", {
          humanEvidence: hasHumanDecisionCriterion ? L("和对应的人工结论依据") : "",
          title: item.goal.title,
          count: remainingGateCount,
        })
      : L("选择“通过”会记录这次用户检查{humanEvidence}；GoalBoard 会立即再核对全部门槛，都满足后 Goal「{title}」才会完成。", {
          humanEvidence: hasHumanDecisionCriterion ? L("和对应的人工结论依据") : "",
          title: item.goal.title,
        });
  return renderDecisionScenario({
    title: L("拿当前完成标准和依据来说"),
    contextLabel,
    contextEffect,
    confirmLabel: L("如果选择通过"),
    confirmEffect,
    rejectLabel: L("如果需要修改或依据不足"),
    rejectEffect: L("选择“需要修改”会把结果退回补充；选择“证据不足”会让 Goal 继续等待依据。两种情况都不会完成这条 Goal。"),
  });
}

function humanVerdictPrefill(
  item: WebGoalView,
  obligation: ReviewObligationRecord,
): EvidenceRecord | null {
  if (!obligation.criterion_scope.length) return null;
  const obligationCreatedAt = Date.parse(obligation.created_at);
  return item.evidence
    .filter((evidence) =>
      evidence.lifecycle_state === "effective" &&
      evidence.kind === "human_verdict" &&
      evidence.result === "passed" &&
      evidence.locator.startsWith("conversation://") &&
      Boolean(evidence.digest?.trim()) &&
      Number.isFinite(obligationCreatedAt) &&
      Date.parse(evidence.captured_at) >= obligationCreatedAt &&
      obligation.criterion_scope.every((criterionId) => evidence.criterion_ids.includes(criterionId))
    )
    .sort((left, right) => right.captured_at.localeCompare(left.captured_at))[0] ?? null;
}

function renderHumanVerdictPrefill(evidence: EvidenceRecord): string {
  return `<aside class="human-verdict-prefill" data-human-verdict-prefill>
    <span>${icon("user")}</span><div><strong>${L("已找到当前对话中的明确验收")}</strong>
    <p>${L("GoalBoard 已把结论、原话和对话来源预填到下方，但尚未记录为用户验收；请核对后只提交一次。")}</p>
    <dl><div><dt>${L("对话原话")}</dt><dd>${escapeHtml(evidence.digest ?? "")}</dd></div><div><dt>${L("对话来源")}</dt><dd>${escapeHtml(evidence.locator)}</dd></div></dl></div>
  </aside>`;
}

function renderHumanReview(item: WebGoalView, view: GoalBoardWebView): string {
  const pending = item.review_obligations.filter(
    (obligation) => obligation.role === "human_approver" && obligation.state === "pending",
  );
  if (!pending.length) return "";
  const copy = explainDecision("review");
  const allCriteriaPassed = item.goal.acceptance_criteria.length > 0 && item.passed_criteria.length === item.goal.acceptance_criteria.length;
  const hasPendingHumanDecision = pending.some((obligation) => obligation.criterion_scope.some((criterionId) =>
    item.goal.acceptance_criteria.some(
      (criterion) => criterion.criterion_id === criterionId && criterion.decision_method === "human_decision",
    ),
  ));
  const hasReliableRecommendation = !hasPendingHumanDecision && allCriteriaPassed && item.goal.acceptance_criteria.every((criterion) =>
    item.evidence.some((evidence) => evidence.lifecycle_state === "effective" && evidence.result === "passed" && evidence.criterion_ids.includes(criterion.criterion_id)),
  );
  const effectiveEvidence = item.evidence.filter((evidence) => evidence.lifecycle_state === "effective");
  const renderEvidenceChoices = (selectedEvidenceIds = new Set<string>()) => effectiveEvidence.length
    ? effectiveEvidence
        .slice()
        .reverse()
        .map(
          (evidence) =>
            `<label class="evidence-choice"><input type="checkbox" name="evidence_refs" value="${escapeHtml(evidence.evidence_id)}"${selectedEvidenceIds.has(evidence.evidence_id) ? " checked" : ""}><span><strong>${escapeHtml(L(EVIDENCE_KIND_LABELS[evidence.kind]))} · ${escapeHtml(L(EVIDENCE_RESULT_LABELS[evidence.result]))} · ${escapeHtml(evidence.locator_status === "verified" ? L("已验证") : "UNVERIFIED")}</strong><small>${escapeHtml(evidence.locator)}</small></span></label>`,
        )
        .join("")
    : `<p class="empty-row">${L("当前还没有已提交的完成依据。你可以在下方补充外部引用。")}</p>`;
  const evidenceChoices = renderEvidenceChoices();
  return `<div class="decision-record human-review-list"><header class="decision-record-heading"><span class="decision-kind">${icon("user")} ${L("确认工作结果")}${renderNewDecisionBadge(pending[0]!.created_at, view, "review", pending[0]!.obligation_id)}</span></header><div class="decision-record-body"><h3>${escapeHtml(copy.question)}</h3><p>${escapeHtml(copy.purpose)}</p><button class="human-review-jump" type="button" data-human-review-jump><span><strong>${L("填写确认结论")}</strong><small>${L("选择结论并写明判断理由")}</small></span>${icon("chevron-right")}</button>${renderDecisionGuidance({
    whyNow: L("工作结果已经提交，其他必要检查也已走到需要你确认的阶段。"),
    recommendation: hasReliableRecommendation ? L("建议确认通过") : null,
    recommendationBasis: L("{passed}/{total} 条完成标准已有通过依据，共 {evidence} 条当前有效记录。", { passed: item.passed_criteria.length, total: item.goal.acceptance_criteria.length, evidence: effectiveEvidence.length }),
    insufficient: copy.insufficientEvidence,
    consequences: [
      { choice: L("通过"), effect: L("这项用户检查会完成；其他门槛也满足后，Goal 才会完成。") },
      { choice: L("需要修改或不通过"), effect: L("结果不会完成，并会带着你的理由回到后续修改。") },
      { choice: L("证据不足"), effect: L("暂不判断结果，等待补充与完成标准对应的依据。") },
    ],
  })}${renderHumanReviewScenario(item)}<details class="decision-details"><summary>${L("查看完成标准和已有依据")}${icon("chevron-down")}</summary><div class="review-context"><section><h4>${L("完成标准")}</h4>${renderAcceptanceSummary(item)}</section><section><h4>${L("已有依据")}</h4><div class="evidence-choice-list">${evidenceChoices}</div></section></div></details></div>${pending
    .map(
      (obligation) => {
        const prefill = humanVerdictPrefill(item, obligation);
        const preselectedEvidence = prefill ? new Set([prefill.evidence_id]) : new Set<string>();
        const attentionToken = item.action_projection.actions
          .find((action) => action.actor === "user" && action.target_id === obligation.obligation_id)
          ?.reasons[0]?.facts?.attention_token ?? "";
        return `<form class="human-review-form" data-human-review-form data-live-form="human-review-${escapeHtml(obligation.obligation_id)}" data-goal-id="${escapeHtml(item.goal.goal_id)}" data-obligation-id="${escapeHtml(obligation.obligation_id)}" data-attention-token="${escapeHtml(attentionToken)}" data-contract-revision="${item.goal.current_contract_revision}" novalidate>
        ${prefill ? renderHumanVerdictPrefill(prefill) : ""}
        <label class="review-verdict"><span>${L("你的结论")}</span><select name="verdict"><option value=""${prefill ? "" : " selected"} disabled>${L("请选择结论")}</option><option value="pass"${prefill ? " selected" : ""}>${L("通过")}</option><option value="needs_changes">${L("需要修改")}</option></select></label>
        <fieldset><legend>${L("选择支持结论的已有依据")}</legend><div class="evidence-choice-list">${renderEvidenceChoices(preselectedEvidence)}</div></fieldset>
        <label><span>${L("补充依据链接")} <small>${L("可选，每行一条")}</small></span><textarea name="evidence_refs_extra" rows="2" placeholder="${L("https://… 或项目内文件引用")}"></textarea></label>
        <label><span>${L("判断理由")}（${L("必填")}）</span><textarea name="reasoning" rows="3" required placeholder="${L("说明为什么给出这个结论，以及哪些依据支撑判断")}">${escapeHtml(prefill?.digest ?? "")}</textarea></label>
        <p class="form-error" data-review-error role="alert" hidden></p>
        <footer><details class="decision-record-tech"><summary>${L("记录信息")}</summary><small>${escapeHtml(obligation.independence_rule)} · ${escapeHtml(obligation.obligation_id)}</small></details><button class="button-primary" type="submit">${L("提交结果确认")}</button></footer>
      </form>`;
      },
    )
    .join("")}</div>`;
}

function renderHistory(item: WebGoalView): string {
  if (!item.events.length) return '<p class="empty-row">暂无事件记录</p>';
  return `<ol class="history-list">${item.events
    .slice(0, 12)
    .map(
      (event) =>
        `<li><time>${formatDate(event.at)}</time><span><strong>${escapeHtml(event.reason || event.type)}</strong><small>${escapeHtml(event.actor_id)} · ${escapeHtml(event.type)} · #${event.seq}</small></span></li>`,
    )
    .join("")}</ol>`;
}

function renderEventPayload(payload: unknown): string {
  if (payload == null) return L("无结构化详情");
  try {
    return JSON.stringify(payload, null, 2) ?? L("无结构化详情");
  } catch {
    return String(payload);
  }
}

export const WEB_GOAL_EVENT_PAGE_SIZE = 40;

function renderEventLedgerItems(events: WebEventRecord[]): string {
  return events.map((event) => `<li data-goal-event-seq="${event.seq}"><details><summary><time>${formatDate(event.at)}</time><span><strong>${escapeHtml(event.type)}</strong><small>${escapeHtml(event.actor_id)} · ${escapeHtml(event.object_type)} · ${escapeHtml(event.object_id)} · #${event.seq}</small></span></summary><dl><div><dt>${L("事件 ID")}</dt><dd>${escapeHtml(event.event_id)}</dd></div><div><dt>${L("理由")}</dt><dd>${escapeHtml(event.reason || L("未记录"))}</dd></div></dl><pre>${escapeHtml(renderEventPayload(event.payload))}</pre></details></li>`).join("");
}

function renderEventLedgerPagination(total: number, shown: number): string {
  if (total === 0) return "";
  const hasMore = shown < total;
  return `<footer class="event-ledger-pagination" data-goal-event-pagination data-total="${total}" data-next-offset="${shown}"><span data-goal-event-progress>${L("已显示 {shown}/{total} 条事件", { shown, total })}</span>${hasMore ? `<button type="button" data-load-more-goal-events>${L("加载更早记录")}</button>` : ""}<p data-goal-event-error role="alert" hidden></p></footer>`;
}

function renderFullRecords(item: WebGoalView): string {
  const events = item.events.slice().sort((left, right) => right.seq - left.seq);
  const initialEvents = events.slice(0, WEB_GOAL_EVENT_PAGE_SIZE);
  return `<details class="full-records"><summary>${L("查看完整事实记录与事件账本 ")}<span>${L("{count} 条事件", { count: events.length })}</span></summary><div class="record-grid">
    <section><h3>${L("Claim 历史")}</h3>${
      item.claims.length
        ? item.claims.map((claim) => `<p><strong>${escapeHtml(claim.actor_id)}</strong><small>${escapeHtml(claim.claim_id)} · ${escapeHtml(claim.role)} · ${escapeHtml(claim.state)} · ${formatDate(claim.claimed_at)}${claim.release_reason ? ` · ${escapeHtml(claim.release_reason)}` : ""}</small></p>`).join("")
        : `<p class="empty-row">${L("暂无 Claim")}</p>`
    }</section>
    <section><h3>${L("Run 历史")}</h3>${
      item.runs.length
        ? item.runs.map((run) => `<p><strong>${escapeHtml(run.run_id)}</strong><small>${escapeHtml(run.state)} · ${escapeHtml(run.actor_id)} · ${formatDate(run.started_at)}${run.block_reason ? ` · ${escapeHtml(run.block_reason)}` : ""}</small></p>`).join("")
        : `<p class="empty-row">${L("暂无 Run")}</p>`
    }</section>
    <section><h3>${L("Evidence 记录")}</h3>${
      item.evidence.length
        ? item.evidence.map((evidence) => `<p><strong>${escapeHtml(evidence.evidence_id)}</strong><small>${escapeHtml(L(EVIDENCE_KIND_LABELS[evidence.kind]))} · ${escapeHtml(L(EVIDENCE_RESULT_LABELS[evidence.result]))} · ${escapeHtml(evidence.lifecycle_state === "effective" ? L("当前有效") : evidence.lifecycle_state === "superseded" ? L("已被替代") : L("已撤销"))} · ${escapeHtml(evidence.locator_status === "verified" ? L("已验证") : "UNVERIFIED")} · ${escapeHtml(evidence.criterion_ids.join(currentLocale() === "en" ? ", " : "、"))} · ${escapeHtml(evidence.producer_actor_id)}${evidence.correction ? ` · ${escapeHtml(evidence.correction.reason)}` : ""}</small></p>`).join("")
        : `<p class="empty-row">${L("暂无 Evidence")}</p>`
    }</section>
    <section><h3>${L("Review 记录")}</h3>${
      item.reviews.length
        ? item.reviews.map((review) => `<p><strong>${escapeHtml(review.verdict)}</strong><small>${escapeHtml(review.review_id)} · ${escapeHtml(review.actor_id)} · ${escapeHtml(review.reasoning)}${review.evidence_refs.length ? ` · ${escapeHtml(review.evidence_refs.join(currentLocale() === "en" ? ", " : "、"))}` : ""}</small></p>`).join("")
        : `<p class="empty-row">${L("暂无 Review")}</p>`
    }</section>
    <section><h3>${L("策略绑定")}</h3>${
      item.policy_bindings.length
        ? item.policy_bindings.map((binding) => `<p><strong>${escapeHtml(binding.scope)}</strong><small>${escapeHtml(binding.state)} · ${escapeHtml(binding.reason)} · ${escapeHtml(JSON.stringify(binding.policy))}</small></p>`).join("")
        : `<p class="empty-row">${L("使用默认策略")}</p>`
    }</section>
  </div><section class="event-ledger"><header><h3>${L("完整事件账本")}</h3><p>${L("按时间倒序保留 Claim、Run、Evidence、Review、Policy、Risk、Relation、Candidate、Rewire、Contract/Goal Tree Proposal 和澄清相关事件。")}</p></header>${events.length ? `<ol data-goal-event-list>${renderEventLedgerItems(initialEvents)}</ol>${renderEventLedgerPagination(events.length, initialEvents.length)}` : `<p class="empty-row">${L("暂无与这条 Goal 关联的事件")}</p>`}</section></details>`;
}

function renderDecisionGoalLink(item: WebGoalView | null): string {
  if (!item) return `<span class="decision-owner-link"><strong>${L("整个项目的事项")}</strong><small>${L("没有只属于某一条 Goal")}</small></span>`;
  const base = item.goal.archived_at ? "/archive/goals/" : "/goals/";
  return `<a class="decision-owner-link" href="${base}${encodeURIComponent(item.goal.goal_id)}"><strong>${escapeHtml(item.goal.title)}</strong><small>${L("返回这条 Goal 查看完整信息")}</small></a>`;
}

function renderRiskDecision(risk: RiskRecord, item: WebGoalView | null, view: GoalBoardWebView): string {
  const copy = explainDecision("risk");
  const href = item ? `${item.goal.archived_at ? "/archive/goals/" : "/goals/"}${encodeURIComponent(item.goal.goal_id)}#risk-${encodeURIComponent(risk.risk_id)}` : "#";
  const affectedGoals = allGoalViews(view).filter((goalView) => goalView.risks.some((itemRisk) => itemRisk.risk_id === risk.risk_id));
  const riskOwner = affectedGoals.find((goalView) => goalView.action_projection.actions.some((action) =>
    action.actor === "user" && action.target_type === "risk" && action.target_id === risk.risk_id
  )) ?? item;
  const riskAction = riskOwner?.action_projection.actions.find((action) =>
    action.actor === "user" && action.target_type === "risk" && action.target_id === risk.risk_id
  );
  const stateOptions = `<option value="" selected disabled>${L("请选择处理结果")}</option><option value="accepted">${L("接受这项风险")}</option><option value="rejected">${L("不接受，改为继续处理")}</option>`;
  return `<form class="decision-record risk-decision" data-risk-state-form data-live-form="risk-decision-${escapeHtml(risk.risk_id)}" data-risk-id="${escapeHtml(risk.risk_id)}" data-risk-blocking="${escapeHtml(risk.blocking_mode)}" data-goal-id="${escapeHtml(riskOwner?.goal.goal_id ?? "")}" data-action-id="${escapeHtml(riskAction?.action_id ?? "")}" data-action-token="${escapeHtml(riskOwner?.action_projection.action_token ?? "")}" data-contract-revision="${riskOwner?.goal.current_contract_revision ?? 1}" novalidate>
    <header class="decision-record-heading"><span class="decision-kind decision-kind--risk">${icon("risk")} ${L("风险处理")}${renderNewDecisionBadge(riskDecisionCreatedAt(risk, view), view, "risk", risk.risk_id)}</span><span class="risk-state risk-state--${escapeHtml(risk.state)}">${escapeHtml(L(RISK_STATE_LABELS[risk.state]))}</span></header>
    <div class="decision-record-body"><h3>${escapeHtml(copy.question)}</h3><p>${escapeHtml(copy.purpose)}</p><div class="risk-decision-fact"><strong>${escapeHtml(risk.description)}</strong><p>${L("发生概率：")}${escapeHtml(risk.probability)} · ${L("影响程度：")}${escapeHtml(risk.impact)}</p><small>${L("当前计划：")}${escapeHtml(L(RISK_TREATMENT_LABELS[risk.treatment]))}；${L("负责人：")}${escapeHtml(risk.owner)}</small></div>${renderDecisionGuidance({
      whyNow: riskStateEffect(risk.blocking_mode, risk.state),
      recommendation: null,
      insufficient: copy.insufficientEvidence,
      consequences: [
        { choice: L("继续跟踪"), effect: L("风险保持开放，并继续按照当前规则影响关联 Goal。") },
        { choice: L("标记为已处理或接受"), effect: L("风险不再阻止领取或完成；决定理由会保留在记录中。") },
        { choice: L("标记为已经发生"), effect: risk.blocking_mode === "invalidate_on_trigger" ? L("所有关联 Goal 会立即失效并需要重新确认。") : L("风险会进入已触发状态，并继续应用当前阻塞规则。") },
      ],
    })}<details class="decision-details"><summary>${L("查看触发条件和复查条件")}${icon("chevron-down")}</summary><dl class="risk-decision-details"><div><dt>${L("什么情况算已经发生")}</dt><dd>${escapeHtml(risk.trigger)}</dd></div><div><dt>${L("什么时候重新判断")}</dt><dd>${escapeHtml(risk.revisit_condition)}</dd></div></dl></details></div>
    <div class="risk-goal-links"><span>${L("关联 Goal")}</span><div>${affectedGoals.length ? affectedGoals.map((goalView) => renderDecisionGoalLink(goalView)).join("") : "未关联 Goal"}</div></div>
    <div class="risk-decision-choice"><label><span>${L("你决定怎么处理")}</span><select name="state" data-risk-state-select required>${stateOptions}</select></label><p class="risk-state-preview" data-risk-state-preview>${L("选择处理结果后，这里会说明会发生什么。")}</p></div>
    <div class="risk-resolution-fields" data-risk-resolution-basis hidden>
      <label><span>${L("解决摘要")}（${L("必填")}）</span><textarea name="resolution_summary" rows="2" placeholder="${L("说明什么事实证明这条风险已经按当前边界解决")}"></textarea></label>
      <label><span>${L("证据引用")}（${L("每行一条，至少一条")}）</span><textarea name="resolution_evidence_refs" rows="2" placeholder="evidence://...&#10;conversation://..."></textarea></label>
      <label><span>${L("剩余缺口")}（${L("每行一条；没有可留空")}）</span><textarea name="resolution_residual_gaps" rows="2" placeholder="${L("仍需观察或不在本次解决范围内的边界")}"></textarea></label>
    </div>
    <label class="decision-reason"><span>${L("决定理由")}（${L("必填")}）</span><textarea name="reason" rows="2" required placeholder="${L("说明为什么现在这样处理，以及你依据了什么")}"></textarea></label>
    <p class="form-error" data-risk-error role="alert" hidden></p>
    <footer class="decision-actions"><span>${item ? `<a href="${href}">${L("返回 Goal 查看完整风险记录")}</a>` : ""}</span><button class="button-primary" type="submit">${L("保存风险决定")}</button></footer>
  </form>`;
}

function decisionGroupModel(group: DecisionGoalGroup, view: GoalBoardWebView): WorkbenchDecisionGroup {
  return { ownerGoalId: group.ownerGoalId, item: group.item, humanReview: group.humanReview,
    counts: { goalTree: group.goalTreeProposals.length, contracts: group.contractProposals.length, candidates: group.candidates.length, rewires: group.rewires.length, risks: group.risks.length },
    ownerLinkHtml: renderDecisionGoalLink(group.item),
    content: {
      goalTree: group.goalTreeProposals.map((proposal) => renderGoalTreeProposalDecision(proposal, view)).join(""),
      rewires: group.rewires.map((rewire) => renderRewireDecision(rewire, view)).join(""),
      contracts: group.item ? group.contractProposals.map((proposal) => renderContractProposal(proposal, group.item!.goal, view)).join("") : "",
      candidates: group.candidates.map((candidate) => renderCandidateDecision(candidate, view)).join(""),
      review: group.humanReview && group.item ? renderHumanReview(group.item, view) : "",
      risks: group.risks.map((risk) => renderRiskDecision(risk, group.item, view)).join(""),
    },
  };
}

export function renderDecisionCenter(view: GoalBoardWebView, desktopInbox = false): string {
  return decisionCenterRenderer.renderDecisionCenter({ groups: buildDecisionGroups(view).map(group => decisionGroupModel(group, view)),
    count: pendingDecisionCount(view), typeCounts: decisionTypeCounts(view), recentHtml: renderRecentDecisionResults(view),
  }, desktopInbox);
}

function renderFeedDecisionGroupDetail(group: DecisionGoalGroup, view: GoalBoardWebView, goalId: string, title: string, summary: string, updatedAt: string): string {
  return decisionCenterRenderer.renderFeedDecisionGroupDetail(decisionGroupModel(group, view), goalId, title, summary, updatedAt);
}

export function renderPersistedFeedItemDetail(
  item: FeedItemRecord,
  routePrefix = "",
  options: { entryId?: string; inboxActive?: boolean; inboxEntry?: InboxEntryRecord | null } = {},
): string {
  return renderFeedNativePluginPersistedDetail(item, routePrefix, options);
}

export function renderFeedWorkbenchFragment(
  view: GoalBoardWebView,
  defaultPreset: FeedItemType,
): string {
  return prefixLocalLinks(renderFeedNativePluginSurface(
    view,
    "workbench-fragment",
    defaultPreset,
    feedNativePluginSupplementalEntries(view),
    true,
  ), view.route_prefix);
}

export function countGoalDecisions(view: GoalBoardWebView, goalId: string): number {
  const group = buildDecisionGroups(view).find((item) => item.item?.goal.goal_id === goalId);
  if (!group) return 0;
  return group.goalTreeProposals.length + group.contractProposals.length + group.candidates.length + group.rewires.length + group.risks.length + (group.humanReview ? 1 : 0);
}

function feedNativePluginSupplementalEntries(view: GoalBoardWebView): FeedSupplementalEntry[] {
  const decisionGroups = buildDecisionGroups(view);
  const decisions = decisionGroups.map((group): FeedSupplementalEntry => {
    const goalId = group.item?.goal.goal_id ?? group.ownerGoalId ?? "board";
    const title = group.item?.goal.title ?? L("整个项目的事项");
    const count = decisionGroupCount(group);
    const inboxEntry = goalId === "board" ? null : view.feed.inbox_entries.find((entry) =>
      entry.subject_type === "goal_decision" && entry.subject_id === goalId &&
      (entry.status === "open" || entry.status === "in_progress"),
    ) ?? null;
    return {
      entry_id: `decision:${goalId}`,
      item_id: null,
      inbox_entry: inboxEntry ? { ...inboxEntry, project_id: inboxEntry.board_id } : null,
      item: null,
      preset: "inbox_message",
      provider: "other",
      kind_label: L("Inbox Message · Goal 决定"),
      source_label: "GoalBoard",
      disposition: "inbox",
      title,
      summary: L("{count} 项等待你判断。", { count }),
      updated_at: group.item?.goal.updated_at ?? view.events[0]?.at ?? "",
      read: true,
      attention_rank: 3,
      detail_slot_html: renderFeedDecisionGroupDetail(
        group,
        view,
        goalId,
        title,
        L("{count} 项等待你判断。", { count }),
        group.item?.goal.updated_at ?? view.events[0]?.at ?? "",
      ),
    };
  });
  const results = recentDecisionResults(view).map((result): FeedSupplementalEntry => ({
    entry_id: `result:${result.event.event_id}`,
    item_id: null,
    inbox_entry: null,
    item: null,
    preset: "inbox_message",
    provider: "other",
    kind_label: L("Inbox Message · 处理结果"),
    source_label: "GoalBoard",
    disposition: "saved",
    title: result.title,
    summary: result.effects.join(currentLocale() === "en" ? " " : "；"),
    updated_at: result.event.at,
    read: true,
    attention_rank: 1,
    detail_slot_html: `<article class="feed-detail feed-detail--result" data-feed-detail="result:${escapeHtml(result.event.event_id)}"><header class="feed-detail-header"><div class="feed-detail-kicker"><span>Inbox Message</span><span>${escapeHtml(result.kindLabel)}</span><span>${escapeHtml(result.state)}</span></div><h1>${escapeHtml(result.title)}</h1><p>${escapeHtml(result.effects.join(currentLocale() === "en" ? " " : "；"))}</p><div class="feed-detail-meta"><span>${icon("workflow")}GoalBoard</span><time datetime="${escapeHtml(result.event.at)}">${formatDate(result.event.at)}</time></div></header><section class="decision-results feed-result-record" aria-label="${L("最近处理结果")}"><article class="decision-result decision-result--${result.kind}"><span class="decision-result-icon">${icon(result.kind === "risk" ? "risk" : result.kind === "rewire" ? "link" : result.kind === "review" ? "user" : result.kind === "candidate" ? "plus" : result.kind === "goalTree" ? "tree" : "clipboard")}</span><div class="decision-result-copy"><div><span>${escapeHtml(result.kindLabel)}</span><strong>${escapeHtml(result.state)}</strong><time datetime="${escapeHtml(result.event.at)}">${formatDate(result.event.at)}</time></div><h3>${escapeHtml(result.title)}</h3>${result.effects.map((effect) => `<p>${escapeHtml(effect)}</p>`).join("")}<small>${escapeHtml(result.reasonLabel ? `${result.reasonLabel}：${result.reason ?? result.event.reason}` : L("你的理由：{reason}", { reason: result.reason ?? result.event.reason }))}</small></div>${result.links.length ? `<div class="decision-result-links">${result.links.map((link) => `<a href="${link.href}">${escapeHtml(link.label)}${icon("chevron-right")}</a>`).join("")}</div>` : ""}</article></section></article>`,
  }));
  return [...decisions, ...results];
}

function sectionHeading(iconName: GoalBoardIcon, title: string, description = ""): string {
  return `<header class="section-heading"><span>${icon(iconName)}</span><div><h2>${escapeHtml(L(title))}</h2>${
    description ? `<p>${escapeHtml(L(description))}</p>` : ""
  }</div></header>`;
}

function subsectionHeading(iconName: GoalBoardIcon, title: string, description = ""): string {
  return `<header class="subsection-heading"><span>${icon(iconName)}</span><div><h3>${escapeHtml(L(title))}</h3>${
    description ? `<p>${escapeHtml(L(description))}</p>` : ""
  }</div></header>`;
}

interface FocusSectionCardOptions {
  key: string;
  iconName: GoalBoardIcon;
  title: string;
  description: string;
  body: string;
  active?: boolean;
  count?: number | null;
  cardClass?: string;
  cardId?: string;
  cardAttributes?: string;
  bodyClass?: string;
  triggerAttributes?: string;
  bodyAttributes?: string;
}

function renderFocusSectionCard(options: FocusSectionCardOptions): string {
  const active = options.active === true;
  const cardId = options.cardId ? ` id="${escapeHtml(options.cardId)}"` : "";
  const cardClass = options.cardClass ? ` ${options.cardClass}` : "";
  const count = options.count == null ? "" : `<small class="focus-section-card-count">${options.count}</small>`;
  return `<article${cardId} class="focus-section-card${cardClass}${active ? " is-active" : ""}" data-focus-section-card="${escapeHtml(options.key)}" ${options.cardAttributes ?? ""}>
    <button class="focus-section-card-trigger" type="button" aria-expanded="${active ? "true" : "false"}" data-focus-section-trigger="${escapeHtml(options.key)}" ${options.triggerAttributes ?? ""}>
      <span class="focus-section-card-icon">${icon(options.iconName)}</span>
      <span class="focus-section-card-copy"><strong>${escapeHtml(options.title)}</strong><small>${escapeHtml(options.description)}</small></span>
      ${count}<span class="focus-section-card-caret">${icon("chevron-right")}</span>
    </button>
  </article>`;
}

function renderFocusSectionBody(options: FocusSectionCardOptions): string {
  const active = options.active === true;
  const bodyClass = `${options.cardClass ? ` ${options.cardClass}` : ""}${options.bodyClass ? ` ${options.bodyClass}` : ""}`;
  return `<div class="focus-section-card-reveal${bodyClass}${active ? " is-active" : ""}" data-focus-section-body="${escapeHtml(options.key)}" aria-hidden="${active ? "false" : "true"}"${active ? "" : " inert"} ${options.bodyAttributes ?? ""}>
    <div class="focus-section-card-content">${options.body}</div>
  </div>`;
}

function renderFocusSectionDeck(cards: FocusSectionCardOptions[], label: string, className = "", attributes = ""): string {
  return `<section class="focus-section-deck${className ? ` ${className}` : ""}" aria-label="${escapeHtml(label)}" data-focus-section-deck>
    <div class="focus-section-card-row" data-focus-section-card-row ${attributes}>${cards.map(renderFocusSectionCard).join("")}</div>
    <div class="focus-section-stage" data-focus-section-stage>${cards.map(renderFocusSectionBody).join("")}</div>
  </section>`;
}

function renderCompanionRuntime(item: WebGoalView): string {
  const claim = item.active_claim;
  const lease = item.active_claim_lease;
  const run = [...item.runs].reverse().find((candidate) => candidate.state === "started" || candidate.state === "blocked") ?? item.runs.at(-1);
  const total = item.goal.acceptance_criteria.length;
  const passed = displayedPassedCriterionIds(item).length;
  const progress = total ? Math.round((passed / total) * 100) : 0;
  const runtime = claim?.actor_id ?? run?.actor_id ?? L("执行会话");
  const state = claim
    ? run?.state === "blocked" ? L("执行受阻") : L("正在推进")
    : run ? L("最近有进展") : L("尚未绑定");
  const leaseNotice = lease
    ? `<p class="companion-runtime-lease${lease.renew_recommended ? " is-warning" : ""}">${icon("clock")}<span>${L("租约还剩 {count} 分钟", { count: Math.max(1, Math.ceil(lease.remaining_seconds / 60)) })} · ${L("到期前续租可保持当前 Claim 和 Run")}</span></p>`
    : "";
  return `<section class="companion-runtime" data-companion-runtime aria-labelledby="companion-runtime-${escapeHtml(item.goal.goal_id)}">
    <header><div><small>Runtime</small><h2 id="companion-runtime-${escapeHtml(item.goal.goal_id)}">${escapeHtml(runtime)}</h2></div><span class="companion-runtime-state${claim ? " is-active" : ""}"><i aria-hidden="true"></i>${escapeHtml(state)}</span></header>
    <p>${escapeHtml(plainRunState(run))}</p>
    ${leaseNotice}
    <div class="companion-runtime-progress" aria-label="${L("完成标准进度 {passed}/{total}", { passed, total })}"><i><b style="--companion-progress:${progress}%"></b></i><span>${passed}/${total}</span></div>
    <dl><div><dt>${L("完成依据")}</dt><dd>${L("{count} 条", { count: item.evidence.length })}</dd></div><div><dt>${L("执行记录")}</dt><dd>${escapeHtml(run?.state ?? L("未开始"))}</dd></div></dl>
    <button type="button" data-companion-runtime-open>${L("在 Runtime 查看会话")}${icon("chevron-right")}</button>
  </section>`;
}

function plainRunState(run: RunRecord | undefined): string {
  if (!run) return L("还没有开始推进。")
  if (run.state === "started") return L("最近一次推进正在进行。")
  if (run.state === "blocked") return L("最近一次推进被挡住了。")
  if (run.state === "completed") return L("最近一次推进已经结束并提交了结果。")
  if (run.state === "failed") return L("最近一次推进失败了，需要查看原因后再试。")
  return L("最近一次推进已经停止。")
}

function renderProgressOverview(item: WebGoalView): string {
  const latestRun = item.runs.at(-1);
  const latestRunIsCurrent = latestRun != null &&
    item.active_claim?.claim_id === latestRun.claim_id &&
    (latestRun.state === "started" || latestRun.state === "blocked");
  const latestBlocker = latestRun?.block_reason
    ? latestRunIsCurrent
      ? `<small>${L("当前阻塞：{reason}", { reason: latestRun.block_reason })}</small>`
      : `<small>${L("当时记录：{reason}。这不是当前阻塞；当前状态以“当前阻塞”页为准。", { reason: latestRun.block_reason })}</small>`
    : "";
  const activeRisks = item.risks.filter((risk) => risk.state === "open" || risk.state === "triggered");
  const pendingReviews = item.review_obligations.filter((review) => review.state === "pending").length;
  const stateBody = `<dl class="progress-facts">
      <div><dt>${L("谁在推进")}</dt><dd>${escapeHtml(item.active_claim_actor ? L("{name} 正在推进", { name: item.active_claim_actor }) : L("现在还没有人或工具在推进"))}</dd></div>
      <div><dt>${L("最近进展")}</dt><dd>${escapeHtml(plainRunState(latestRun))}${latestBlocker}</dd></div>
      <div><dt>${L("完成依据")}</dt><dd>${L("已有 {evidence} 条依据，{passed}/{total} 条完成标准通过", { evidence: item.evidence.length, passed: displayedPassedCriterionIds(item).length, total: item.goal.acceptance_criteria.length })}</dd></div>
      <div><dt>${L("还要检查")}</dt><dd>${pendingReviews ? L("还有 {count} 项检查没有完成", { count: pendingReviews }) : L("当前没有未完成的检查")}</dd></div>
    </dl>`;
  const blockerBody = `<div class="progress-blockers"><h3>${L("当前有什么会挡住它")}</h3>${renderReasons(item)}</div>`;
  const riskBody = renderProgressRiskSummary(item.risks);
  const ruleBody = renderProgressCheckSummary(item.resolved_policy);
  return renderFocusSectionDeck([
    { key: "state", iconName: "activity", title: L("推进状态"), description: L("负责人、最近进展、完成依据和待检查项"), body: stateBody, active: true },
    { key: "blockers", iconName: "blocked", title: L("当前阻塞"), description: L("仍会挡住推进或完成的事实"), body: blockerBody },
    { key: "risks", iconName: "risk", title: L("开放风险"), description: L("仍可能改变推进结果的风险"), body: riskBody, count: activeRisks.length },
    { key: "checks", iconName: "check", title: L("完成检查"), description: L("完成前仍需通过的检查规则"), body: ruleBody },
  ], L("进展与阻塞"), "focus-section-deck--progress progress-overview");
}

function renderQuickRecordDialog(item: WebGoalView, view: GoalBoardWebView): string {
  const goalId = escapeHtml(item.goal.goal_id);
  const choices = [
    ["evidence", "evidence", L("完成依据"), L("记录能证明完成标准是否达到的事实")],
    ["risk", "risk", L("风险"), L("记录可能影响推进或完成的情况")],
    ["impact", "impact", L("影响范围"), L("记录会读取、修改或决定的区域")],
    ["relation", "link", L("Goal 关系"), L("记录层级、依赖或其他 Goal 关联")],
  ] as const;
  return `<dialog class="create-dialog quick-record-dialog" data-quick-record-dialog data-goal-id="${goalId}" aria-labelledby="quick-record-title-${goalId}">
    <div class="dialog-shell">
      <header><div><span class="dialog-icon">${icon("plus")}</span><div><h2 id="quick-record-title-${goalId}" data-quick-record-title>${L("快速记录")}</h2><p>${L("所有内容都会绑定到当前 Goal：{name}", { name: item.goal.title })}</p></div></div><button class="icon-button" type="button" data-close-quick-record aria-label="${L("关闭")}">${icon("x")}</button></header>
      <div class="dialog-body quick-record-body">
        <div class="quick-record-choices" data-quick-record-choices>
          <p>${L("你要补充哪类事实？")}</p>
          <div>${choices.map(([key, iconName, title, description]) => `<button type="button" data-quick-record-type="${key}">${icon(iconName)}<span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span>${icon("chevron-right")}</button>`).join("")}</div>
        </div>
        <section class="quick-record-panel" data-quick-record-panel="evidence" hidden><button class="quick-record-back" type="button" data-quick-record-back>${icon("chevron-right")}${L("换一种记录")}</button>${renderEvidenceForm(item, "quick")}</section>
        <section class="quick-record-panel" data-quick-record-panel="risk" hidden><button class="quick-record-back" type="button" data-quick-record-back>${icon("chevron-right")}${L("换一种记录")}</button>${renderQuickRiskForm(item, view)}</section>
        <section class="quick-record-panel" data-quick-record-panel="impact" hidden><button class="quick-record-back" type="button" data-quick-record-back>${icon("chevron-right")}${L("换一种记录")}</button>${renderQuickImpactForm(item)}</section>
        <section class="quick-record-panel" data-quick-record-panel="relation" hidden><button class="quick-record-back" type="button" data-quick-record-back>${icon("chevron-right")}${L("换一种记录")}</button>${renderRelationForm(item, view, "quick")}</section>
      </div>
    </div>
  </dialog>`;
}

const goalsFactorsRenderer = createWorkbenchGoalsFactorsRenderer({ translate: L, escapeHtml, icon, renderFocusSectionDeck });
function renderGoalFactors(item: WebGoalView, view: GoalBoardWebView): string {
  return goalsFactorsRenderer(item, {
    relationsHtml: renderRelations(item, view),
    risksHtml: renderRiskWorkbench(item, view, true, false),
    impactsHtml: renderImpactWorkbench(item, true, false),
    policyHtml: renderPolicyEditor(item),
  });
}

function renderGoalTechnicalDetails(item: WebGoalView, view: GoalBoardWebView): string {
  const goal = item.goal;
  const basics = renderGoalRecordBasics(item);
  const execution = `<div id="execution-${escapeHtml(goal.goal_id)}"><div class="runtime-grid"><section><h3>${L("领取记录")} <span>${L("谁领取了工作")}</span></h3>${renderClaimCell(item)}</section><section><h3>${L("推进记录")} <span>${L("每次推进")}</span></h3>${renderRunCell(item)}</section><section><h3>${L("完成依据")}</h3>${renderEvidenceCell(item, false)}</section><section><h3>${L("检查记录")}</h3>${renderReviewCell(item)}</section></div></div>`;
  const history = `${renderHistory(item)}${renderFullRecords(item)}`;
  const relationships = renderGoalRecordRelations({
    relationsHtml: renderRelations(item, view, false),
    safetyHtml: renderSafety(item, view, false),
    policyHtml: renderPolicyEditor(item, { editGoal: false, editProject: false }),
  });
  return `<section class="goal-technical" data-goal-section="technical">
    <header><span>${icon("history")}</span><span><strong>${L("完整记录")}</strong><small>${L("只读查看这条 Goal 的原始事实和变更历史；修改请去对应功能区。")}</small></span></header>
    <div class="goal-technical-body">${renderFocusSectionDeck([
      { key: "basics", iconName: "clipboard", title: L("基础信息"), description: L("目标标识、负责人、时间、状态和完整工作边界"), body: basics, active: true, cardClass: "goal-record-section" },
      { key: "execution", iconName: "activity", title: L("执行与检查"), description: L("领取、推进、完成依据和检查记录"), body: execution, cardClass: "goal-record-section" },
      { key: "history", iconName: "history", title: L("变更历史"), description: L("按时间查看发生过什么、由谁修改"), body: history, cardClass: "goal-record-section" },
      { key: "rules", iconName: "link", title: L("关联与规则记录"), description: L("关系、风险、影响范围和生效规则的只读记录"), body: relationships, cardClass: "goal-record-section" },
    ], L("完整记录"), "focus-section-deck--records")}</div>
  </section>`;
}

function renderGoalProgressPanel(item: WebGoalView): string {
  return `<section class="focus-panel" data-goal-section="progress" id="progress-${escapeHtml(item.goal.goal_id)}">
    <header class="focus-panel-heading">${icon("workflow")}<div><h2>${L("进展与阻塞")}</h2><p>${L("执行情况、依据、检查、阻塞和风险。")}</p></div></header>
    ${renderProgressOverview(item)}
  </section>`;
}

const goalsDocumentRenderer = createWorkbenchGoalsDocumentRenderer({
  translate: L, escapeHtml, icon, formatDate, renderVisibleGoalStatus, renderStatus, sectionHeading,
});
const { renderTrashGoalDocument } = goalsDocumentRenderer;
function renderGoalDocument(item: WebGoalView, view: GoalBoardWebView, selected: boolean): string {
  return goalsDocumentRenderer.renderGoalDocument(item, {
    activeGoalId: view.snapshot.board.active_goal_id,
    decisionCount: countGoalDecisions(view, item.goal.goal_id),
    draftGapsHtml: renderDraftGaps(item),
    companionRuntimeHtml: renderCompanionRuntime(item),
  }, selected);
}

export type { GoalDocumentCollection, LazyGoalPanel } from "@adeptify/goalboard-app-workbench";

/** Bind the public fragment composition to existing content owners. */
export const {
  renderGoalDocumentFragment, renderGoalPanelFragment, renderGoalQuickRecordFragment,
  renderGoalRecordsFragment, renderGoalRecordEventsFragment, renderGoalBoardMomentumFragment,
} = createWorkbenchGoalsFragmentRenderer<WebGoalView, GoalBoardWebView>({
  document: (item, view) => renderGoalDocument(item, view, true),
  trash: (item) => renderTrashGoalDocument(item, true),
  completion: renderGoalCompletionPanel,
  progress: renderGoalProgressPanel,
  factors: renderGoalFactors,
  records: renderGoalTechnicalDetails,
  recordEvents: renderGoalEventPage,
  quickRecord: renderQuickRecordDialog,
  momentum: (view, goalId, items) => renderGoalMomentum(view, goalId, [...items]),
  prefixLinks: prefixLocalLinks,
});

/** Event history content remains with the execution/records owner, not the route adapter. */
function renderGoalEventPage(item: WebGoalView, offset: number): string {
  const events = item.events.slice().sort((left, right) => right.seq - left.seq);
  const safeOffset = Math.max(0, Math.trunc(offset));
  const page = events.slice(safeOffset, safeOffset + WEB_GOAL_EVENT_PAGE_SIZE);
  const nextOffset = safeOffset + page.length;
  return `<div data-goal-event-page data-next-offset="${nextOffset}" data-total="${events.length}" data-has-more="${nextOffset < events.length}"><ol>${renderEventLedgerItems(page)}</ol></div>`;
}

const goalsDialogsRenderer = createWorkbenchGoalsDialogsRenderer({ translate: L, escapeHtml, icon });
const { renderGoalTrashDialog } = goalsDialogsRenderer;
function renderCreateDialog(view: GoalBoardWebView): string {
  return goalsDialogsRenderer.renderCreateDialog(view.goals);
}

function renderProjectMigrationDialog(): string {
  return `<dialog class="project-migration-dialog" data-project-migration-dialog aria-labelledby="project-migration-title">
  <form class="project-migration-form" data-project-migration-form>
    <header>
      <div><h2 id="project-migration-title">${L("迁移已有 GoalBoard 数据")}</h2><p>${L("这是一次单独确认的文件迁移，不会绑定或切换任何 Runtime Session。")}</p></div>
      <button class="icon-button" type="button" data-close-project-migration aria-label="${L("关闭迁移窗口")}">${icon("x")}</button>
    </header>
    <div class="project-migration-body">
      <label>${L("已有 GoalBoard DB")}<input name="legacy_database_path" type="text" required autocomplete="off" placeholder="${L("/绝对路径/到/goalboard.db")}"><small>${L("请输入你明确要迁移的本机 GoalBoard 数据库路径。")}</small></label>
      <label>${L("迁移后项目名 ")}<small>${L("可选")}</small><input name="display_name" type="text" maxlength="160" autocomplete="off" placeholder="${L("留空则使用旧 Board 的名称")}"></label>
      <p class="project-migration-warning">${L("确认后，来源 DB 会由 GoalBoard 的受管理项目目录接管，原位置不再保留该 DB；Goal、Claim、Run、Evidence 和审计历史会原样迁入。迁移失败时来源 DB 不会被移动。")}</p>
      <label class="project-migration-confirm"><input name="user_confirmed" type="checkbox"><span>${L("我确认要迁移这份已有 GoalBoard 数据，并理解成功后来源 DB 将移入 GoalBoard 管理目录。")}</span></label>
      <p class="project-migration-error" data-project-migration-error role="alert" hidden></p>
    </div>
    <footer><button type="button" data-close-project-migration>${L("取消")}</button><button class="project-migration-submit" type="submit" data-project-migration-submit>${L("确认迁移")}</button></footer>
  </form>
</dialog>`;
}

export interface GoalBoardOnboardingRenderOptions {
  mode: "first_run" | "new_project" | "update";
  currentVersion: string | null;
  controlToken?: string;
  desktopShell?: boolean;
  cliAvailability?: Record<string, boolean>;
}

const ONBOARDING_RUNTIME_CHOICES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "codex", label: "Codex" },
  { id: "claude-code", label: "Claude Code" },
  { id: "opencode", label: "OpenCode" },
  { id: "pi-agent", label: "Pi Agent" },
  { id: "grok-build", label: "Grok Build" },
];

const ONBOARDING_ATMOSPHERE = `<div class="onboarding-atmosphere" aria-hidden="true"></div>`;

export function renderGoalBoardOnboarding(options: GoalBoardOnboardingRenderOptions): string {
  const desktopShell = Boolean(options.desktopShell);
  const href = (target: string) => desktopShell ? withDesktopQuery(target) : target;
  if (options.mode === "update") {
    const version = options.currentVersion ? ` ${escapeHtml(options.currentVersion)}` : "";
    return `<!doctype html>
<html lang="${htmlLang()}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${controlTokenMeta(options.controlToken ?? "")}
  <title>${L("GoalBoard 已更新")}</title>
  <script>${NATIVE_DESKTOP_BOOTSTRAP_SCRIPT}</script>
  <link rel="stylesheet" href="/assets/goalboard-onboarding.css">
</head>
<body class="onboarding-page onboarding-page--update"${desktopShell ? ' data-native-desktop="true"' : ""}>
  ${ONBOARDING_ATMOSPHERE}
  <main class="onboarding-update" aria-labelledby="onboarding-update-title">
    <span class="onboarding-brand">GoalBoard</span>
    <div class="onboarding-update-copy">
      <h1 id="onboarding-update-title">${L("GoalBoard 已更新")}${version}</h1>
      <p>${L("你的 Project、Goal 和工作记录仍保存在本机。更新不会替你接受 Goal，也不会自动修改 Runtime 配置。")}</p>
      <ul>
        <li><strong>${L("新项目可以从一个真实结果开始")}</strong><span>${L("创建 Project 时同时建立根 Draft Goal，后续从同一份事实继续。")}</span></li>
        <li><strong>${L("初始化可以直接交给 TUI")}</strong><span>${L("选择工作目录和 Runtime 后，提示会填入终端，但仍由你检查并发送。")}</span></li>
      </ul>
    </div>
    <div class="onboarding-update-actions">
      <button type="button" data-onboarding-dismiss="update">${L("继续使用 GoalBoard")}</button>
      <a href="${href("/settings/projects")}">${L("查看项目设置")}</a>
    </div>
    <p class="onboarding-error" data-onboarding-error role="alert" hidden></p>
  </main>
  <script>${clientI18nScript()}${CONTROL_CLIENT_SCRIPT}</script>
  <script>${ONBOARDING_CLIENT_SCRIPT}</script>
</body>
</html>`;
  }

  const runtimeAvailability = options.cliAvailability ?? {};
  const availableRuntimes = ONBOARDING_RUNTIME_CHOICES.filter(({ id }) => runtimeAvailability[id] === true);
  const runtimeChoices = [
    `<label class="onboarding-runtime-choice onboarding-runtime-choice--deferred"><input type="radio" name="runtime_kind" value="" checked><span>${icon("clock")}<strong>${L("之后再选")}</strong><i aria-hidden="true"></i></span></label>`,
    ...availableRuntimes.map(({ id, label }) => `<label class="onboarding-runtime-choice onboarding-runtime-choice--available"><input type="radio" name="runtime_kind" value="${id}"><span>${icon("terminal")}<strong>${escapeHtml(label)}</strong><i aria-hidden="true"></i></span></label>`),
  ].join("");
  const runtimeHint = availableRuntimes.length
    ? L("只会填入终端，等你自己发送。")
    : L("没有找到可用工具，可以稍后再选。");
  const intentIcons: Record<(typeof ONBOARDING_INTENT_FRAMES)[number]["id"], GoalBoardIcon> = {
    open: "target",
    build_change: "brand",
    design_plan: "workflow",
    diagnose_fix: "settings",
    analyze_decide: "search",
    migrate_refactor: "switch",
    operate_process: "activity",
    content_communication: "book",
  };
  const intentOptions = ONBOARDING_INTENT_FRAMES
    .map((frame, index) => `<button type="button" role="option" aria-selected="${index === 0 ? "true" : "false"}" data-onboarding-intent-option="${frame.id}" data-intent-label="${escapeHtml(L(frame.label))}" data-placeholder="${escapeHtml(L(frame.placeholder))}"><span>${icon(intentIcons[frame.id])}<b>${escapeHtml(L(frame.label))}</b></span><i aria-hidden="true"></i></button>`)
    .join("");
  const title = options.mode === "first_run" ? L("开始使用 GoalBoard") : L("建立一个新项目");
  return `<!doctype html>
<html lang="${htmlLang()}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${controlTokenMeta(options.controlToken ?? "")}
  <title>${title}</title>
  <link rel="stylesheet" href="/assets/goalboard-onboarding.css">
  <script>${NATIVE_DESKTOP_BOOTSTRAP_SCRIPT}</script>
</head>
<body class="onboarding-page" data-onboarding-mode="${options.mode}" data-onboarding-tone="0"${desktopShell ? ' data-native-desktop="true"' : ""}>
  ${renderIconSprite()}
  ${ONBOARDING_ATMOSPHERE}
  <header class="onboarding-topbar">
    <a class="onboarding-brand" href="${href("/")}">GoalBoard</a>
    <div class="onboarding-topbar-actions"><a href="${href("/settings/projects")}">${L("迁移已有数据")}</a><button type="button" data-onboarding-dismiss="first_run">${options.mode === "first_run" ? L("跳过") : L("返回项目目录")}</button></div>
  </header>
  <main class="onboarding-room">
    <form class="onboarding-flow" data-onboarding-form novalidate>
      <div class="onboarding-flow-header">
        <p class="onboarding-progress" data-onboarding-progress aria-live="polite">01 / 04 · ${L("说说想法")}</p>
        <nav class="onboarding-actions" aria-label="${L("引导步骤导航")}">
          <button class="onboarding-back" type="button" data-onboarding-back hidden>${icon("back")}<span>${L("上一步")}</span></button>
          <button class="onboarding-next" type="button" data-onboarding-next><span data-onboarding-next-label>${L("下一步")}</span>${icon("arrow")}</button>
          <button class="onboarding-submit" type="submit" data-onboarding-submit hidden><span data-onboarding-submit-label>${L("创建项目")}</span>${icon("arrow")}</button>
        </nav>
      </div>
      <div class="onboarding-stage">
      <section class="onboarding-step is-current" data-onboarding-step="0" aria-labelledby="onboarding-question-0">
        <h1 id="onboarding-question-0" tabindex="-1">${L("你希望我们一起做什么？")}</h1>
        <p class="onboarding-intro">${L("先说说你想看到的变化，不用急着想得很完整。")}</p>
        <div class="onboarding-composer">
          <div class="onboarding-intent" data-onboarding-intent>
            <input type="hidden" name="intent_frame" value="open">
            <button type="button" class="onboarding-intent-trigger" data-onboarding-intent-trigger aria-haspopup="listbox" aria-expanded="false"><span data-onboarding-intent-current>${L("我想")}</span>${icon("chevron-down")}</button>
            <div class="onboarding-intent-options" role="listbox" aria-label="${L("这次更像哪一种？")}">${intentOptions}</div>
          </div>
          <label class="onboarding-answer onboarding-answer--plain"><span class="onboarding-visually-hidden">${L("你想推进的事")}</span><textarea name="outcome" rows="1" maxlength="2000" autocomplete="off" aria-describedby="onboarding-error-0" placeholder="${L("例如：把这个想法做成一个真的能用的产品")}" required></textarea></label>
        </div>
        <p class="onboarding-field-error" id="onboarding-error-0" data-step-error="0" role="alert" hidden></p>
      </section>
      <section class="onboarding-step" data-onboarding-step="1" aria-labelledby="onboarding-question-1" hidden>
        <p class="onboarding-echo"><span>${L("我们一起")}</span><strong data-onboarding-outcome></strong></p>
        <h1 id="onboarding-question-1" tabindex="-1">${L("给项目取个名字吧。")}</h1>
        <label class="onboarding-answer onboarding-answer--single"><span>${L("项目叫")}</span><input name="project_name" type="text" maxlength="160" autocomplete="off" aria-describedby="onboarding-error-1" placeholder="${L("例如：GoalBoard 首次体验")}" required></label>
        <p class="onboarding-field-error" id="onboarding-error-1" data-step-error="1" role="alert" hidden></p>
      </section>
      <section class="onboarding-step" data-onboarding-step="2" aria-labelledby="onboarding-question-2" hidden>
        <p class="onboarding-echo"><span>${L("项目叫")}</span><strong data-onboarding-project></strong></p>
        <h1 id="onboarding-question-2" tabindex="-1">${L("接下来，你想在哪里继续？")}</h1>
        <label class="onboarding-workspace"><span>${L("工作目录")}</span><input name="workspace_path" type="text" autocomplete="off" placeholder="/absolute/path/to/project" aria-describedby="onboarding-runtime-hint onboarding-error-2"></label>
        <fieldset class="onboarding-runtime"><legend>${L("想用哪个工具继续？")}</legend>${runtimeChoices}</fieldset>
        <p class="onboarding-hint" id="onboarding-runtime-hint">${runtimeHint}</p>
        <p class="onboarding-field-error" id="onboarding-error-2" data-step-error="2" role="alert" hidden></p>
      </section>
      <section class="onboarding-step onboarding-step--review" data-onboarding-step="3" aria-labelledby="onboarding-question-3" hidden>
        <h1 id="onboarding-question-3" tabindex="-1">${L("这样开始，可以吗？")}</h1>
        <p class="onboarding-intro">${L("我们会先保存项目和第一条目标，不会自动执行。")}</p>
        <dl class="onboarding-review">
          <div><dt>${L("项目名称")}</dt><dd data-review-project></dd></div>
          <div><dt>${L("想看到的结果")}</dt><dd data-review-outcome></dd></div>
          <div><dt>${L("工作目录")}</dt><dd data-review-workspace></dd></div>
          <div><dt>${L("接下来")}</dt><dd data-review-runtime></dd></div>
        </dl>
        <label class="onboarding-confirm"><input type="checkbox" name="user_confirmed"><span>${L("我确认先保存这些内容。如果选择了 Runtime，只把内容填进终端，等我自己发送。")}</span></label>
        <p class="onboarding-field-error" id="onboarding-error-3" data-step-error="3" role="alert" hidden></p>
      </section>
      <section class="onboarding-step onboarding-step--runtime-embedded" data-onboarding-step="4" aria-labelledby="onboarding-question-4" hidden>
        <div class="onboarding-runtime-heading">
          <h1 id="onboarding-question-4" tabindex="-1">${L("我们先把项目安排清楚。")}</h1>
          <p class="onboarding-intro">${L("这个 Runtime 已经绑定刚创建的根目标。它会一次问一个问题，和你一起整理出合适的目标树。")}</p>
        </div>
        <div class="onboarding-runtime-viewport">
          <iframe data-onboarding-runtime-frame title="${L("项目初始化 Runtime")}" allow="clipboard-read; clipboard-write"></iframe>
        </div>
        <div class="onboarding-runtime-state">
          <p data-onboarding-runtime-status data-state="busy" role="status">${L("正在打开 Runtime…")}</p>
          <button type="button" data-onboarding-runtime-retry hidden>${icon("refresh")}<span>${L("重新打开")}</span></button>
        </div>
      </section>
      </div>
      <p class="onboarding-error" data-onboarding-error role="alert" hidden></p>
    </form>
  </main>
  <script>${clientI18nScript()}${CONTROL_CLIENT_SCRIPT}</script>
  <script>${ONBOARDING_CLIENT_SCRIPT}</script>
</body>
</html>`;
}

export function renderGoalBoardProjectIndex(
  projects: readonly WebProjectNavigation[],
  controlToken = "",
  desktopShell = false,
): string {
  const href = (path: string) => desktopShell ? withDesktopQuery(path) : path;
  const projectCards = projects
    .map(
      (project) => `<a class="project-card" role="listitem" href="${href(`/projects/${encodeURIComponent(project.project_id)}`)}" data-project-search-row="${escapeHtml(`${project.display_name} ${project.data_class}`.toLocaleLowerCase())}"><header><span class="project-card-icon">${icon("database")}</span><span class="project-card-kind">${project.data_class === "regenerable_demo" ? L("演示数据") : project.data_class === "migrated_user" ? L("已迁移") : L("本地项目")}</span></header><div><h2>${escapeHtml(project.display_name)}</h2><p>${L("Goals 与 Sessions")}</p></div><footer><span>${L("打开项目")}</span>${icon("arrow")}</footer></a>`,
    )
    .join("");
  return `<!doctype html>
<html lang="${htmlLang()}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${controlTokenMeta(controlToken)}
  <title>${L("选择项目 · GoalBoard")}</title>
  <script>${THEME_BOOTSTRAP_SCRIPT}</script>
  <link rel="stylesheet" href="/assets/goalboard-project-index.css">
</head>
<body class="project-index-page" data-desktop-shell="true"${desktopShell ? ' data-native-desktop="true"' : ""}>
  ${renderIconSprite()}
  <header class="topbar project-directory-topbar">
    <a class="brand" href="${href("/")}" aria-label="${L("GoalBoard 项目目录")}">${icon("brand")}<strong>GoalBoard</strong></a>
    <div class="top-spacer"${desktopShell ? " data-tauri-drag-region" : ""}></div>
    <a class="top-action" href="${href("/settings/appearance")}" aria-label="${L("打开系统设置")}">${icon("settings")}<span>${L("系统设置")}</span></a>
  </header>
  <main class="project-index">
    <section class="project-index-panel" aria-labelledby="project-index-title">
      <header class="project-index-heading"><div><h1 id="project-index-title">${L("选择一个项目")}</h1><p>${L("每个项目管理自己的 Goals 和 Sessions；工作目录在新建或关联 Session 时选择。")}</p></div><div class="project-index-actions">${projects.length ? `<label class="project-index-search">${icon("search")}<input type="search" data-project-search placeholder="${L("搜索项目")}" aria-label="${L("搜索项目")}"></label>` : ""}<a class="project-index-create" href="${href("/onboarding")}">${icon("plus")}${L("引导创建项目")}</a></div></header>
      ${projects.length
        ? `<div class="project-card-grid" role="list">${projectCards}</div><p class="project-index-search-empty" data-project-search-empty hidden>${L("没有匹配的项目，换一个关键词。")}</p>`
        : `<div class="project-index-empty"><h2>${L("从一个真实项目开始")}</h2><p>${L("通过逐步引导建立 Project 和第一条根 Goal；是否关联工作目录、是否打开 Runtime 都由你确认。")}</p><div class="project-index-start"><a href="${href("/onboarding")}">${L("开始建立第一个项目")}</a><a href="${href("/settings/projects")}">${L("直接进入项目设置")}</a></div></div>`}
      <section class="project-index-migration"><div><strong>${L("已有一份旧的 GoalBoard DB？")}</strong><small>${L("只有你明确选择并确认后，才会迁移它并保留已有历史。")}</small></div><button class="project-index-migrate" type="button" data-open-project-migration>${L("迁移已有 GoalBoard 数据")}</button></section>
      <p class="project-index-note">${L("选择项目只影响这次网页浏览；正在对话的 Runtime Session 保持原来的项目关系。")}</p>
    </section>
  </main>
  ${renderProjectMigrationDialog()}
  <script>${clientI18nScript()}${CONTROL_CLIENT_SCRIPT}${PROJECT_INDEX_CLIENT_SCRIPT}${VISUAL_FOUNDATION_CLIENT_SCRIPT}</script>
</body>
</html>`;
}

function runtimeStatePresentation(state: RuntimeIntegrationDetection["connection_state"]): {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
  description: string;
} {
  if (state === "connected") return { label: L("已接入"), tone: "success", description: L("MCP 与 GoalBoard Skill 都指向当前安装。") };
  if (state === "needs_repair") return { label: L("需要修复"), tone: "warning", description: L("检测到旧版或不完整的 GoalBoard 接入。") };
  if (state === "conflict") return { label: L("存在冲突"), tone: "danger", description: L("同名配置或 Skill 不属于 GoalBoard，不会自动覆盖。") };
  if (state === "goalboard_unavailable") return { label: L("本体不完整"), tone: "danger", description: L("请先查看诊断并修复 GoalBoard 本体安装。") };
  if (state === "not_detected") return { label: L("未检测到"), tone: "neutral", description: L("这台设备上没有找到对应 Runtime。") };
  return { label: L("未接入"), tone: "neutral", description: L("尚未把 GoalBoard MCP 与 Skill 写入这个 Runtime。") };
}

function renderAppearanceSettings(nextPath: string): string {
  const densityPreview = (mode: "standard" | "compact") =>
    `<span class="density-preview density-preview--${mode}" aria-hidden="true"><i></i><span><i></i><i></i><i></i><i></i><i></i></span></span>`;
  const locale = currentLocale();
  const languageOption = (value: "zh" | "en", label: string, description: string) =>
    `<a class="preference-option" href="${localeSwitchHref(value, nextPath)}" hreflang="${value === "zh" ? "zh-CN" : "en"}" lang="${value === "zh" ? "zh-CN" : "en"}" aria-current="${locale === value}"><span class="language-preview" aria-hidden="true">${value === "zh" ? "中" : "EN"}</span><span><strong>${label}</strong><small>${description}</small></span>${icon("check", "preference-check")}</a>`;
  return `<section class="settings-document appearance-document" aria-labelledby="settings-title">
    <header class="settings-heading"><h1 id="settings-title">${L("界面与语言")}</h1><p>${L("集中设置当前设备上的语言、主题、终端外观和信息密度，不会改动项目、Goal 或 Runtime 数据。")}</p></header>
    <div class="appearance-settings">
      <section class="preference-section" aria-labelledby="language-settings-title">
        <div class="preference-copy"><h2 id="language-settings-title">${L("界面语言")}</h2><p>${L("只改变 GoalBoard 的界面文案，不翻译 Goal 名称和正文内容。")}</p></div>
        <div class="preference-options preference-options--language" role="group" aria-label="${L("界面语言")}">
          ${languageOption("zh", "中文", L("使用中文界面。"))}
          ${languageOption("en", "English", L("使用英文界面。"))}
        </div>
      </section>
      <section class="preference-section" aria-labelledby="density-settings-title">
        <div class="preference-copy"><h2 id="density-settings-title">${L("界面密度")}</h2><p>${L("决定桌面 Goal 工作台一次显示多少 Goal 和正文内容。")}</p></div>
        <div class="preference-options preference-options--density" role="group" aria-label="${L("界面密度")}">
          <button class="preference-option" type="button" data-density-option="standard" aria-pressed="true">${densityPreview("standard")}<span><strong>${L("标准")}</strong><small>${L("舒展的间距，适合专注阅读和一般工作量。")}</small></span>${icon("check", "preference-check")}</button>
          <button class="preference-option" type="button" data-density-option="compact" aria-pressed="false">${densityPreview("compact")}<span><strong>${L("紧凑")}</strong><small>${L("减少 Goal 行和正文留白，适合长 Goal Tree 与宽屏。")}</small></span>${icon("check", "preference-check")}</button>
        </div>
      </section>
      <section class="preference-section" aria-labelledby="theme-settings-title">
        <div class="preference-copy"><h2 id="theme-settings-title">${L("主题")}</h2><p>${L("选择固定主题，或让 GoalBoard 跟随当前系统外观。")}</p></div>
        <div class="preference-options preference-options--theme" role="group" aria-label="${L("主题")}">
          <button class="preference-option" type="button" data-theme-option="light" aria-pressed="false">${icon("sun")}<span><strong>${L("浅色")}</strong><small>${L("适合明亮环境。")}</small></span>${icon("check", "preference-check")}</button>
          <button class="preference-option" type="button" data-theme-option="dark" aria-pressed="false">${icon("moon")}<span><strong>${L("深色")}</strong><small>${L("适合低光环境。")}</small></span>${icon("check", "preference-check")}</button>
          <button class="preference-option" type="button" data-theme-option="system" aria-pressed="true">${icon("system")}<span><strong>${L("跟随系统")}</strong><small>${L("随设备主题自动切换。")}</small></span>${icon("check", "preference-check")}</button>
        </div>
      </section>
      <section class="preference-section" aria-labelledby="terminal-theme-settings-title">
        <div class="preference-copy"><h2 id="terminal-theme-settings-title">${L("终端外观")}</h2><p>${L("只改变终端画布的配色；Runtime 导航、Goal 信息和操作继续使用界面主题。")}</p></div>
        <div class="preference-options preference-options--theme" role="group" aria-label="${L("终端外观")}">
          <button class="preference-option" type="button" data-terminal-theme-option="auto" aria-pressed="true">${icon("system")}<span><strong>${L("跟随界面")}</strong><small>${L("终端随 GoalBoard 的浅色或深色主题切换。")}</small></span>${icon("check", "preference-check")}</button>
          <button class="preference-option" type="button" data-terminal-theme-option="light" aria-pressed="false">${icon("sun")}<span><strong>${L("浅色终端")}</strong><small>${L("始终使用浅色终端画布。")}</small></span>${icon("check", "preference-check")}</button>
          <button class="preference-option" type="button" data-terminal-theme-option="dark" aria-pressed="false">${icon("moon")}<span><strong>${L("深色终端")}</strong><small>${L("始终使用深色终端画布。")}</small></span>${icon("check", "preference-check")}</button>
        </div>
      </section>
    </div>
    <p class="preference-note">${L("语言、主题、终端外观和密度只保存在当前设备。紧凑模式仅影响 760px 以上的 Goal 导航和 Goal 正文；Runtime、决定中心、设置页和窄屏布局保持原来的密度。")}</p>
  </section>`;
}

function renderRuntimeSettings(view: GoalBoardSettingsView): string {
  const rows = view.runtimes.map((runtime) => {
    const state = runtimeStatePresentation(runtime.connection_state);
    const unavailable = runtime.connection_state === "not_detected" || runtime.connection_state === "goalboard_unavailable";
    const action = runtime.connection_state === "connected" ? "remove" : "connect";
    const actionLabel = action === "remove" ? L("预览移除") : runtime.connection_state === "needs_repair" ? L("预览修复") : L("查看并接入");
    return `<article class="settings-record runtime-record" data-runtime-row="${escapeHtml(runtime.runtime_id)}">
      <header>
        <div class="settings-record-title"><span class="record-icon">${icon("workflow")}</span><div><h2>${escapeHtml(runtime.display_name)}</h2><p>${escapeHtml(state.description)}</p></div></div>
        <div class="settings-record-action"><span class="settings-state settings-state--${state.tone}">${escapeHtml(state.label)}</span><button type="button" data-runtime-plan="${escapeHtml(runtime.runtime_id)}" data-runtime-action="${action}"${unavailable ? " disabled" : ""}>${escapeHtml(actionLabel)}</button></div>
      </header>
      <dl class="settings-paths"><div><dt>Runtime</dt><dd>${runtime.executable_path ? escapeHtml(runtime.executable_path) : L("未找到可执行文件")}</dd></div><div><dt>${L("配置")}</dt><dd>${escapeHtml(runtime.config_path)}</dd></div><div><dt>Skill</dt><dd>${escapeHtml(runtime.skill_path)}</dd></div></dl>
    </article>`;
  }).join("");
  return `<section class="settings-document" aria-labelledby="settings-title">
    <header class="settings-heading"><h1 id="settings-title">${L("AI 与执行工具")}</h1><p>${L("不接入也能正常使用 Goal Tree、待决定和记录。只有想让 AI 工具直接读取或推进 Goal 时才需要连接；每次修改前都会先展示变化并由你确认。")}</p></header>
    <div class="settings-record-list">${rows || `<div class="settings-empty"><h2>${L("没有可探测的 Runtime")}</h2><p>${L("GoalBoard 本体仍可使用；稍后安装 Runtime 后再回来检查。")}</p></div>`}</div>
    <p class="settings-footnote">${L("当前自动适配 Codex、Claude Code、OpenCode、Pi Agent 和 Grok Build。每次确认只对应当前 Runtime 和当前预览；配置在预览后变化时会要求重新生成。Session 与运行位置请进入对应项目的 Sessions 管理。")}</p>
  </section>`;
}

function renderProjectSettings(view: GoalBoardSettingsView): string {
  const demo = view.projects.find((project) => project.data_class === "regenerable_demo");
  const rows = view.projects.map((project) => `<article class="settings-record project-record" data-project-row="${escapeHtml(project.project_id)}">
    <header>
      <div class="settings-record-title"><span class="record-icon">${icon("folder")}</span><div><h2>${escapeHtml(project.display_name)}</h2><p>${project.data_class === "regenerable_demo" ? L("演示数据 · 可随时重建，不属于用户项目") : project.source === "migrated" ? L("用户数据 · 由已有 GoalBoard 数据迁入") : L("用户数据 · 在 GoalBoard 中创建")}</p></div></div>
      <div class="settings-record-action">${project.data_class === "regenerable_demo" ? `<span class="settings-state settings-state--warning">${L("可重建 demo")}</span>` : `<span class="settings-state settings-state--success">${L("用户数据")}</span>`}<a class="settings-button" href="/projects/${encodeURIComponent(project.project_id)}/settings/guidance">${L("项目说明")}</a><a class="settings-button" href="/projects/${encodeURIComponent(project.project_id)}/settings/rules">${L("工作规则")}</a><a class="settings-button" href="/projects/${encodeURIComponent(project.project_id)}/settings/planning">${L("工作规划")}</a><a class="settings-button" href="/projects/${encodeURIComponent(project.project_id)}/">${L("打开 Goal Tree")}</a></div>
    </header>
    <div class="project-record-tools">
      <details><summary>${icon("settings")}<span>${L("改名")}</span>${icon("chevron-down")}</summary><form data-project-rename="${escapeHtml(project.project_id)}"><label>${L("项目名称")}<input name="display_name" value="${escapeHtml(project.display_name)}" required maxlength="160"></label><p class="settings-form-error" role="alert" hidden></p><button type="submit">${L("保存名称")}</button></form></details>
      <details><summary>${icon("database")}<span>${L("存储信息")}</span>${icon("chevron-down")}</summary><dl class="project-db-details"><div><dt>${L("项目 ID")}</dt><dd>${escapeHtml(project.project_id)}</dd></div><div><dt>${L("数据文件")}</dt><dd>${escapeHtml(project.database_path)}</dd></div></dl></details>
      ${project.data_class === "regenerable_demo" ? `<details><summary>${icon("refresh")}<span>${L("重建或删除 demo")}</span>${icon("chevron-down")}</summary><div class="connection-action-form connection-action-form--danger"><p class="settings-footnote">${L("重建会清除你在 demo 中做的改动；删除只移除这个可重建项目，不影响用户项目。")}</p><p class="settings-form-error" data-demo-error role="alert" hidden></p><div class="service-action-row"><button type="button" data-demo-action="reset">${L("重建 demo")}</button><button type="button" data-demo-action="remove">${L("删除 demo")}</button></div></div></details>` : ""}
    </div>
  </article>`).join("");
  return `<section class="settings-document" aria-labelledby="settings-title">
    <header class="settings-heading"><h1 id="settings-title">${L("项目设置")}</h1><p>${L("先选择要配置的项目，再进入它的工作规则或工作规划。每个项目单独保存自己的 Goal、记录和项目专用设置。")}</p></header>
    <section class="settings-action-section" aria-labelledby="create-project-title"><div><h2 id="create-project-title">${L("创建项目")}</h2><p>${L("创建一个空的 GoalBoard 项目，然后直接打开它的 Goal Tree。")}</p></div><form class="inline-settings-form" data-project-create><label>${L("项目名称")}<input name="display_name" required maxlength="160" placeholder="${L("例如：新产品发布")}"></label><label class="inline-confirm"><input type="checkbox" name="user_confirmed"><span>${L("确认创建这个项目")}</span></label><p class="settings-form-error" role="alert" hidden></p><button type="submit">${L("创建并打开")}</button></form></section>
    <section class="settings-action-section" aria-labelledby="demo-project-title"><div><h2 id="demo-project-title">${L("产品示例")}</h2><p>${demo ? L("示例项目已单独标记为可重建数据，可以放心重置或删除。") : L("创建一份明确标记为可重建的示例数据；普通卸载会清理它，但保留用户项目。")}</p></div>${demo ? `<a class="settings-button" href="/projects/${encodeURIComponent(demo.project_id)}/">${L("打开示例")}</a>` : `<button type="button" data-demo-action="create">${L("创建示例项目")}</button>`}<p class="settings-form-error" data-demo-error role="alert" hidden></p></section>
    <div class="settings-record-list project-settings-list">${rows || `<div class="settings-empty"><h2>${L("还没有项目")}</h2><p>${L("在上方创建第一个项目，或从下方导入一份已有 GoalBoard 数据。")}</p></div>`}</div>
    <section class="settings-import-row"><div><h2>${L("导入已有 GoalBoard 数据")}</h2><p>${L("选择并确认数据文件后，GoalBoard 会把它作为一个独立项目保存。")}</p></div><button type="button" data-open-project-migration>${L("选择数据文件并预览")}</button></section>
    <p class="settings-footnote">${L("普通用户项目不会被示例操作或普通卸载删除；永久清除用户数据需要单独确认精确数据目录和项目数量。")}</p>
  </section>`;
}

function renderDiagnosticsSettings(view: GoalBoardSettingsView): string {
  const diagnostics = view.diagnostics;
  const service = view.web_service;
  const installation = diagnostics.installation_state === "ready"
    ? { label: L("安装完整"), tone: "success" }
    : diagnostics.installation_state === "missing"
      ? { label: L("尚未安装本体"), tone: "warning" }
      : { label: L("安装清单无效"), tone: "danger" };
  const launchers = diagnostics.launchers.map((launcher) => `<li><span>${icon(launcher.state === "ready" ? "check" : "blocked")}<strong>${launcher.name}</strong><small>${escapeHtml(launcher.path)}</small></span><span class="settings-state settings-state--${launcher.state === "ready" ? "success" : "danger"}">${launcher.state === "ready" ? L("可用") : L("缺失")}</span></li>`).join("");
  const serviceTone = service.state === "running" ? "success" : service.state === "stopped" || service.state === "absent" || service.state === "unhealthy" ? "warning" : "danger";
  const serviceLabel = service.state === "running" ? L("运行中") : service.state === "stopped" ? L("已安装，未运行") : service.state === "unhealthy" ? L("进程运行中，页面不可用") : service.state === "absent" ? L("未启用") : service.state === "unsupported" ? L("当前系统不支持") : service.state === "conflict" ? L("配置冲突") : L("需要修复");
  const serviceActions = service.state === "running"
    ? [["restart", L("重启")], ["stop", L("停止")], ["remove", L("移除")]]
    : service.state === "stopped"
      ? [["start", L("启动")], ["remove", L("移除")]]
      : service.state === "unhealthy"
        ? [["restart", L("重启并检查")], ["remove", L("移除")]]
      : service.state === "absent"
        ? [["install", L("启用常驻服务")]]
        : service.state === "needs_repair"
          ? [["install", L("修复常驻服务")]]
        : [];
  const serviceButtons = serviceActions.map(([action, label]) => `<button type="button" data-web-service-action="${action}">${label}</button>`).join("");
  return `<section class="settings-document" aria-labelledby="settings-title">
    <header class="settings-heading"><h1 id="settings-title">${L("诊断")}</h1><p>${L("这里只读取 GoalBoard 自己的安装状态，不扫描项目内容，也不会自动修复或修改 Runtime。")}</p></header>
    <section class="diagnostics-summary"><div><h2>${L("GoalBoard 本体")}</h2><span class="settings-state settings-state--${installation.tone}">${installation.label}</span></div><dl><div><dt>${L("版本")}</dt><dd>${escapeHtml(diagnostics.version ?? L("未识别"))}</dd></div><div><dt>Home</dt><dd>${escapeHtml(diagnostics.home_directory)}</dd></div><div><dt>Release</dt><dd>${escapeHtml(diagnostics.release_directory ?? L("未找到"))}</dd></div><div><dt>${L("项目数")}</dt><dd>${diagnostics.project_count}</dd></div></dl></section>
    <section class="launcher-section" aria-labelledby="launcher-title"><h2 id="launcher-title">${L("启动入口")}</h2><ul>${launchers}</ul></section>
    <section class="diagnostics-summary" aria-labelledby="web-service-title"><div><div><h2 id="web-service-title">${L("Web 常驻服务")}</h2><p>${escapeHtml(L(service.message))}</p></div><span class="settings-state settings-state--${serviceTone}">${serviceLabel}</span></div><dl><div><dt>${L("方式")}</dt><dd>${service.provider === "macos-launchagent" ? L("macOS 用户级 LaunchAgent") : L("尚未提供")}</dd></div><div><dt>${L("命令")}</dt><dd>${escapeHtml(service.command.join(" "))}</dd></div><div><dt>${L("配置")}</dt><dd>${escapeHtml(service.plist_path)}</dd></div><div><dt>${L("日志")}</dt><dd>${escapeHtml(service.stdout_log)}<br>${escapeHtml(service.stderr_log)}</dd></div></dl><div class="service-action-row">${serviceButtons}</div><p class="settings-form-error" data-web-service-error role="alert" hidden></p></section>
    <p class="settings-footnote">${L("如果本体不完整，请在终端重新运行 ")}<code>goalboard install</code>${L("。常驻服务操作会先展示预览并要求确认；不会在后台使用 nohup。")}</p>
  </section>`;
}

function renderRuntimePlanDialog(): string {
  return `<dialog class="runtime-plan-dialog" data-runtime-plan-dialog aria-labelledby="runtime-plan-title">
    <div class="runtime-plan-shell">
      <header><div><h2 id="runtime-plan-title" data-runtime-plan-title>${L("Runtime 接入预览")}</h2><p data-runtime-plan-message>${L("正在读取变更计划…")}</p></div><button class="icon-button" type="button" data-runtime-plan-close aria-label="${L("关闭预览")}">${icon("x")}</button></header>
      <div class="runtime-plan-body"><ul class="runtime-change-list" data-runtime-change-list></ul><dl class="runtime-plan-meta"><div><dt>${L("备份")}</dt><dd data-runtime-plan-backup>${L("无须备份")}</dd></div><div><dt>${L("完成后")}</dt><dd data-runtime-plan-restart>${L("按页面提示重启 Runtime")}</dd></div></dl><label class="runtime-plan-confirm" data-runtime-confirm-row><input type="checkbox" data-runtime-confirm><span data-runtime-confirm-label>${L("我已查看并确认这份变更")}</span></label><p class="settings-form-error" data-runtime-plan-error role="alert" hidden></p></div>
      <footer><button type="button" data-runtime-plan-close>${L("取消")}</button><button class="runtime-plan-apply" type="button" data-runtime-plan-apply disabled>${L("确认应用")}</button></footer>
    </div>
  </dialog>`;
}

function renderTuiPane(
  selected: WebGoalView | undefined,
  view: GoalBoardWebView,
  cliAvailability: Record<string, boolean> = {},
): string {
  return renderWorkTerminal({
    selected: selected ? {
      ...selected.goal,
      statusHtml: renderVisibleGoalStatus(selected, "data-tui-owner-status", "data-tui-owner-status-label"),
    } : undefined,
    children: (selected ? sortGoals(partOfChildViews(selected.goal.goal_id, view)) : []).map((child) => {
      const explanation = explainWorkState(child.status);
      return { goal_id: child.goal.goal_id, title: child.goal.title, statusLabel: explanation.label, nextAction: explanation.nextAction };
    }),
    cliAvailability,
    text: L,
    icon,
  });
}

type SettingsNavigationActive = WebSettingsSection | "planning";
type ProjectSettingsNavigationActive = "guidance" | "rules" | "planning";

function settingsContextHref(
  path: string,
  project: Pick<WebProjectNavigation, "project_id"> | null,
  desktopShell: boolean,
): string {
  const separator = path.includes("?") ? "&" : "?";
  const contextualPath = project
    ? `${path}${separator}project=${encodeURIComponent(project.project_id)}`
    : path;
  return desktopShell ? withDesktopQuery(contextualPath) : contextualPath;
}

function renderProjectSwitcher(
  currentProject: WebProjectNavigation | null,
  projects: readonly WebProjectNavigation[],
  desktopShell: boolean,
  className = "navigator-project-menu",
  manageHref = "/",
): string {
  const href = (path: string) => desktopShell ? withDesktopQuery(path) : path;
  const options = projects.length ? projects : currentProject ? [currentProject] : [];
  const currentName = currentProject?.display_name ?? L("选择项目");
  return `<details class="${className} navigator-project-menu" data-project-menu><summary class="navigator-project-selector" aria-label="${L("切换项目")}">${icon("database")}<strong title="${escapeHtml(currentName)}">${escapeHtml(currentName)}</strong>${icon("chevron-down")}</summary><div class="navigator-project-menu-popover"><span>${L("切换项目")}</span><nav>${options.map((project) => `<a class="navigator-project-option${project.project_id === currentProject?.project_id ? " is-current" : ""}" href="${href(`/projects/${encodeURIComponent(project.project_id)}/`)}"${project.project_id === currentProject?.project_id ? ' aria-current="page"' : ""}><span>${icon("database")}<strong>${escapeHtml(project.display_name)}</strong></span>${project.project_id === currentProject?.project_id ? icon("check") : ""}</a>`).join("")}</nav><a class="navigator-project-manage" href="${desktopShell ? withDesktopQuery(manageHref) : manageHref}">${icon("settings")}<span>${L("管理项目")}</span></a></div></details>`;
}

function renderDesktopProjectChrome(
  currentProject: WebProjectNavigation | null,
  projects: readonly WebProjectNavigation[],
  desktopShell: boolean,
  settingsHref: string | null,
  options: {
    switcherClass?: string;
    manageHref?: string;
    settingsCurrent?: boolean;
    directoryToggle?: boolean;
  } = {},
): string {
  const dragAttribute = desktopShell ? " data-tauri-drag-region" : "";
  const directoryToggle = options.directoryToggle
    ? `<button class="navigator-directory-toggle" type="button" data-directory-toggle aria-expanded="true" aria-label="${L("收起目录")}" title="${L("收起目录")}">${icon("panel")}</button>`
    : "";
  const settings = settingsHref
    ? `<a class="navigator-project-settings" href="${settingsHref}"${options.settingsCurrent ? ' aria-current="page"' : ""} aria-label="${options.settingsCurrent ? L("当前项目设置") : L("打开当前项目设置")}" title="${L("项目设置")}">${icon("settings")}</a>`
    : "";
  return `<div class="navigator-native-row">${directoryToggle}<div class="desktop-titlebar-drag desktop-titlebar-drag--left"${dragAttribute} aria-hidden="true"></div></div><div class="navigator-project-primary">${renderProjectSwitcher(currentProject, projects, desktopShell, options.switcherClass, options.manageHref)}<button class="navigator-project-notifications" type="button" disabled aria-label="${L("通知，暂不可用")}" title="${L("通知功能即将开放")}">${icon("bell")}</button>${settings}</div>`;
}

function renderSettingsNavigation(
  active: SettingsNavigationActive,
  project: WebProjectNavigation | null,
  desktopShell = false,
  projects: readonly WebProjectNavigation[] = [],
): string {
  const globalHref = (path: string) => settingsContextHref(path, project, desktopShell);
  const planningHref = settingsContextHref("/settings/planning", null, desktopShell);
  const current = (section: SettingsNavigationActive) => active === section ? ' aria-current="page"' : "";
  const projectHome = project ? `/projects/${encodeURIComponent(project.project_id)}/` : "/";
  const projectSettings = project ? `/projects/${encodeURIComponent(project.project_id)}/settings/guidance` : "/settings/projects";
  const desktopProjectContext = `<div class="settings-desktop-project">${renderDesktopProjectChrome(project, projects, desktopShell, desktopShell ? withDesktopQuery(projectSettings) : projectSettings, { switcherClass: "settings-project-switcher" })}</div><header class="settings-desktop-heading"><a href="${desktopShell ? withDesktopQuery(projectHome) : projectHome}" aria-label="${L("返回项目")}">${icon("arrow")}</a><span><strong>${L("全局设置")}</strong><small>${L("只影响当前设备")}</small></span></header>`;
  const desktopFooter = `<footer class="personal-sidebar-footer"><a class="personal-account" href="${globalHref("/settings/appearance")}" aria-current="page" aria-label="${L("全局设置")}"><span class="personal-account-avatar" aria-hidden="true">${icon("user")}</span><span class="personal-account-copy"><strong>${L("一骏")}</strong><small>${L("本地空间")}</small></span><span class="personal-account-settings" aria-hidden="true">${icon("settings")}</span></a></footer>`;
  return `<nav class="settings-navigation" aria-label="${L("系统设置")}">
    ${desktopProjectContext}<div class="settings-nav-body"><section class="settings-nav-group" aria-labelledby="settings-global-group"><div class="settings-nav-label" id="settings-global-group"><span>${L("全局设置")}</span><small>${L("只影响当前设备")}</small></div>
      <a href="${globalHref("/settings/appearance")}"${current("appearance")}>${icon("system")}<span><strong>${L("界面与语言")}</strong><small>${L("语言、主题、终端与界面密度")}</small></span></a>
      <a href="${globalHref("/settings/runtimes")}"${current("runtimes")}>${icon("workflow")}<span><strong>${L("AI 与执行工具")}</strong><small>${L("连接 Runtime 与会话")}</small></span></a>
      <a href="${planningHref}"${current("planning")}>${icon("tree")}<span><strong>${L("规划方法")}</strong><small>${L("规划方法库")}</small></span></a>
      <a href="${globalHref("/settings/diagnostics")}"${current("diagnostics")}>${icon("activity")}<span><strong>${L("诊断")}</strong><small>${L("安装、服务与环境")}</small></span></a>
    </section></div>${desktopFooter}
  </nav>`;
}

function renderProjectSettingsNavigation(
  active: ProjectSettingsNavigationActive,
  project: WebProjectNavigation,
  desktopShell = false,
  projects: readonly WebProjectNavigation[] = [],
): string {
  const routePrefix = `/projects/${encodeURIComponent(project.project_id)}`;
  const href = (path: string) => desktopShell ? withDesktopQuery(path) : path;
  const current = (section: ProjectSettingsNavigationActive) => active === section ? ' aria-current="page"' : "";
  const desktopProjectContext = `<div class="settings-desktop-project">${renderDesktopProjectChrome(project, projects, desktopShell, href(`${routePrefix}/settings/guidance`), { switcherClass: "settings-project-switcher", settingsCurrent: true })}</div><header class="settings-desktop-heading"><a href="${href(`${routePrefix}/`)}" aria-label="${L("返回 Goal Tree")}">${icon("arrow")}</a><span><strong>${L("项目设置")}</strong><small>${escapeHtml(project.display_name)}</small></span></header>`;
  const globalSettingsHref = settingsContextHref("/settings/appearance", project, desktopShell);
  const desktopFooter = `<footer class="personal-sidebar-footer"><a class="personal-account" href="${globalSettingsHref}" aria-label="${L("打开全局设置")}"><span class="personal-account-avatar" aria-hidden="true">${icon("user")}</span><span class="personal-account-copy"><strong>${L("一骏")}</strong><small>${L("本地空间")}</small></span><span class="personal-account-settings" aria-hidden="true">${icon("settings")}</span></a></footer>`;
  return `<nav class="settings-navigation project-settings-navigation" aria-label="${L("项目设置")}">
    ${desktopProjectContext}<div class="settings-nav-body">
    <section class="settings-nav-group" aria-labelledby="settings-project-group"><div class="settings-nav-label" id="settings-project-group"><span>${L("项目设置")}</span><small>${escapeHtml(project.display_name)}</small></div>
      <a href="${href(`${routePrefix}/settings/guidance`)}"${current("guidance")}>${icon("book")}<span><strong>${L("项目说明")}</strong><small>${L("所有 Goal 共享的长期上下文")}</small></span></a>
      <a href="${href(`${routePrefix}/settings/rules`)}"${current("rules")}>${icon("shield")}<span><strong>${L("工作规则")}</strong><small>${L("执行和复核底线")}</small></span></a>
      <a href="${href(`${routePrefix}/settings/planning`)}"${current("planning")}>${icon("workflow")}<span><strong>${L("工作规划")}</strong><small>${L("选择和调整规划方法")}</small></span></a>
    </section></div>${desktopFooter}
  </nav>`;
}

export function renderGoalBoardProjectSettings(
  view: GoalBoardWebView,
  controlToken = "",
  desktopShell = false,
): string {
  const projectName = view.project?.display_name ?? L("当前项目");
  const settingsProject = view.project ?? null;
  const routePrefix = view.route_prefix;
  const projectReturnHref = desktopShell ? withDesktopQuery(routePrefix || "/") : routePrefix || "/";
  return `<!doctype html>
<html lang="${htmlLang()}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${controlTokenMeta(controlToken)}<title>${L("工作规则")} · ${escapeHtml(projectName)} · GoalBoard</title><script>${THEME_BOOTSTRAP_SCRIPT}</script><link rel="stylesheet" href="/assets/goalboard-settings.css"></head>
<body class="settings-page project-rules-page" data-route-prefix="${escapeHtml(routePrefix)}" data-desktop-shell="true"${desktopShell ? ' data-native-desktop="true"' : ""}>
  ${renderIconSprite()}
  <header class="topbar"><a class="brand" href="${projectReturnHref}" aria-label="${L("返回 Goal Tree")}">${icon("brand")}<strong>GoalBoard</strong></a><div class="project-context"${desktopShell ? " data-tauri-drag-region" : ""}><strong${desktopShell ? " data-tauri-drag-region" : ""}>${escapeHtml(projectName)}</strong><small${desktopShell ? " data-tauri-drag-region" : ""}>${L("项目设置 · 工作规则")}</small></div><div class="top-spacer"${desktopShell ? " data-tauri-drag-region" : ""}></div><a class="top-action" href="${projectReturnHref}" aria-label="${L("关闭项目设置")}">${icon(desktopShell ? "x" : "tree")}<span>${L("Goal Tree")}</span></a></header>
  <main class="settings-shell">
    ${settingsProject ? renderProjectSettingsNavigation("rules", settingsProject, desktopShell, view.projects) : renderSettingsNavigation("projects", null, desktopShell, view.projects)}
    <div class="settings-content">${renderProjectPolicyDocument(view)}</div>
  </main>
  <div class="toast" data-settings-toast role="status" aria-live="polite"></div>
  <script>${clientI18nScript()}${CONTROL_CLIENT_SCRIPT}${PROJECT_RULES_CLIENT_SCRIPT}${VISUAL_FOUNDATION_CLIENT_SCRIPT}</script>
</body></html>`;
}

export function renderGoalBoardProjectGuidanceSettings(
  view: GoalBoardWebView,
  guidance: ProjectGuidanceView,
  controlToken = "",
  desktopShell = false,
): string {
  const project = view.project;
  const projectName = project?.display_name ?? L("当前项目");
  const routePrefix = view.route_prefix;
  const projectReturnHref = desktopShell ? withDesktopQuery(routePrefix || "/") : routePrefix || "/";
  const kindMeta: Record<string, { label: string; description: string }> = {
    context: { label: L("项目背景"), description: L("项目是什么，以及长期成立的事实") },
    requirement: { label: L("共同要求"), description: L("所有 Goal 都要满足的产品或业务要求") },
    constraint: { label: L("硬约束"), description: L("任何推进都不能越过的边界") },
    convention: { label: L("协作约定"), description: L("命名、表达和协作方式") },
    workflow: { label: L("工作方式"), description: L("项目稳定采用的推进顺序") },
    quality_bar: { label: L("质量标准"), description: L("共同认可的完成质量") },
  };
  const orderedKinds = ["context", "requirement", "constraint", "convention", "workflow", "quality_bar"];
  const sections = orderedKinds.map((kind) => {
    const entries = guidance.entries.filter((entry) => entry.kind === kind);
    if (entries.length === 0) return "";
    const meta = kindMeta[kind]!;
    return `<section class="guidance-section" aria-labelledby="guidance-${kind}"><header class="guidance-section-heading"><h2 id="guidance-${kind}">${meta.label}</h2><p>${meta.description}</p></header><div class="guidance-entry-list">${entries.map((entry) => `<article class="guidance-entry" data-guidance-entry="${escapeHtml(entry.guidance_id)}"><p>${escapeHtml(entry.content)}</p><footer><span class="guidance-entry-meta">${L("第 {revision} 版 · 更新于 {time}", { revision: entry.revision, time: formatDate(entry.updated_at) })}</span><span class="guidance-entry-actions"><button class="guidance-text-action" type="button" data-guidance-edit="${escapeHtml(entry.guidance_id)}">${L("修改")}</button><button class="guidance-text-action guidance-text-action--danger" type="button" data-guidance-action="deactivate" data-guidance-id="${escapeHtml(entry.guidance_id)}">${L("停用")}</button></span></footer></article>`).join("")}</div></section>`;
  }).join("");
  const empty = guidance.entries.length === 0
    ? `<section class="guidance-empty">${icon("book")}<h2>${L("先写下这个项目长期不变的部分")}</h2><p>${L("例如项目要解决什么、哪些边界不能突破、所有 Goal 共同遵守什么质量标准。保存后，后续 Runtime 会先读到这些内容。")}</p><button class="guidance-primary-action" type="button" data-guidance-new>${icon("plus")}${L("新增第一条说明")}</button></section>`
    : "";
  const inactiveItems = guidance.inactive_entries.length > 0
    ? `<ul class="guidance-inactive-list">${guidance.inactive_entries.map((entry) => `<li><p>${escapeHtml(entry.content)}</p><button class="guidance-text-action" type="button" data-guidance-action="restore" data-guidance-id="${escapeHtml(entry.guidance_id)}">${L("恢复这条说明")}</button></li>`).join("")}</ul>`
    : `<p>${L("当前没有停用的说明。")}</p>`;
  const changeLabels: Record<string, string> = {
    created: L("新增"),
    edited: L("修改"),
    deactivated: L("停用"),
    restored: L("恢复"),
  };
  const historyRows = guidance.revisions.map((revision) => {
    const content = revision.content.length > 220 ? `${revision.content.slice(0, 220)}…` : revision.content;
    const stateLabel = revision.active ? L("生效版本") : L("停用版本");
    return `<article class="guidance-history-row"><div><strong>${escapeHtml(changeLabels[revision.change_kind] ?? revision.change_kind)}</strong><div class="guidance-history-state${revision.active ? "" : " guidance-history-state--inactive"}">${L("第 {revision} 版", { revision: revision.revision })} · ${stateLabel}</div></div><div><strong>${escapeHtml(kindMeta[revision.kind]?.label ?? revision.kind)}</strong><p>${escapeHtml(content)}</p><details class="guidance-history-entry"><summary>${L("查看完整版本与变更原因")}</summary><dl class="guidance-history-full"><div><dt>${L("完整原文")}</dt><dd>${escapeHtml(revision.content)}</dd></div><div><dt>${L("变更原因")}</dt><dd>${escapeHtml(revision.reason)}</dd></div><div><dt>${L("操作者")}</dt><dd>${escapeHtml(revision.changed_by)}</dd></div><div><dt>${L("确认记录")}</dt><dd>${escapeHtml(revision.confirmation_summary)}</dd></div></dl></details></div><time datetime="${escapeHtml(revision.created_at)}">${formatDate(revision.created_at)}</time></article>`;
  }).join("");
  const guidanceData = JSON.stringify(guidance).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="${htmlLang()}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${controlTokenMeta(controlToken)}<title>${L("项目说明")} · ${escapeHtml(projectName)} · GoalBoard</title><script>${THEME_BOOTSTRAP_SCRIPT}</script><link rel="stylesheet" href="/assets/goalboard-settings.css"></head>
<body class="settings-page project-guidance-page" data-route-prefix="${escapeHtml(routePrefix)}" data-desktop-shell="true"${desktopShell ? ' data-native-desktop="true"' : ""}><!-- THESIS: The project reads as one maintained document, not a settings grid or suggestion inbox. OWN-WORLD: GoalBoard graphite paper, mineral-blue focus, hairline dividers, and the existing project-settings rail. STORY: read canonical guidance, edit it in place, then verify the immutable history. FIRST VIEWPORT: navigation rail, document title and add action, active guidance leading the page, with Runtime behavior in a right rail only when width preserves readable prose. FORM: established Read/Operate extension, code-led, project-guidance-document-v1. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. -->
  ${renderIconSprite()}
  <header class="topbar"><a class="brand" href="${projectReturnHref}" aria-label="${L("返回 Goal Tree")}">${icon("brand")}<strong>GoalBoard</strong></a><div class="project-context"${desktopShell ? " data-tauri-drag-region" : ""}><strong${desktopShell ? " data-tauri-drag-region" : ""}>${escapeHtml(projectName)}</strong><small${desktopShell ? " data-tauri-drag-region" : ""}>${L("项目设置 · 项目说明")}</small></div><div class="top-spacer"${desktopShell ? " data-tauri-drag-region" : ""}></div><a class="top-action" href="${projectReturnHref}" aria-label="${L("关闭项目设置")}">${icon(desktopShell ? "x" : "tree")}<span>${L("Goal Tree")}</span></a></header>
  <main class="settings-shell">
    ${project ? renderProjectSettingsNavigation("guidance", project, desktopShell, view.projects) : renderSettingsNavigation("projects", null, desktopShell, view.projects)}
    <div class="settings-content"><section class="guidance-document" aria-labelledby="guidance-title">
      <header class="guidance-page-header"><div><h1 id="guidance-title">${L("项目说明")}</h1><p>${L("这是一份所有 Goal 和未来会话共享的长期说明。这里只显示已经生效的内容；你可以直接维护它，并随时查看每次改动。")}</p></div><button class="guidance-primary-action" type="button" data-guidance-new>${icon("plus")}${L("新增说明")}</button></header>
      <p class="project-rules-receipt" data-guidance-receipt role="status" aria-live="polite" hidden></p>
      <section class="guidance-editor" data-guidance-editor hidden aria-labelledby="guidance-editor-title"><header><div><h2 id="guidance-editor-title" data-guidance-editor-title></h2><p data-guidance-editor-description></p></div><button class="guidance-text-action" type="button" data-guidance-editor-close>${L("取消")}</button></header><form data-guidance-form><input type="hidden" name="action"><input type="hidden" name="guidance_id"><div class="guidance-editor-fields" data-guidance-editor-fields><label>${L("分类")}<select name="kind"><option value="context">${L("项目背景")}</option><option value="requirement">${L("共同要求")}</option><option value="constraint">${L("硬约束")}</option><option value="convention">${L("协作约定")}</option><option value="workflow">${L("工作方式")}</option><option value="quality_bar">${L("质量标准")}</option></select></label><label>${L("说明原文")}<textarea name="content" maxlength="4000" rows="5" placeholder="${L("写成未来 Runtime 可以直接理解和遵守的完整说明")}"></textarea></label></div><p class="guidance-editor-preview" data-guidance-editor-preview hidden></p><label>${L("为什么要做这次变更")}<textarea name="reason" rows="3" required placeholder="${L("这条原因会进入版本记录，方便以后理解当时为什么修改")}"></textarea></label><p class="guidance-editor-error" data-guidance-editor-error role="alert" hidden></p><footer><button class="guidance-secondary-action" type="button" data-guidance-editor-close>${L("取消")}</button><button class="guidance-primary-action" type="submit">${L("保存说明")}</button></footer></form></section>
      <div class="guidance-layout"><div class="guidance-content">${empty}${sections}<details class="guidance-history"><summary>${L("版本记录")}<span>${L("共 {count} 次变更", { count: guidance.revisions.length })}</span></summary><div class="guidance-history-list">${historyRows || `<p class="guidance-empty">${L("还没有版本记录。")}</p>`}</div></details></div><aside class="guidance-aside" aria-label="${L("项目说明状态")}"><section><h2>${L("Runtime 如何使用")}</h2><p>${L("只发送当前生效版本，并放在当前 Goal 和外部内容之前。修改或停用会在下一次 Prompt 中生效。")}</p><dl><div><dt>${L("生效说明")}</dt><dd>${guidance.entries.length}</dd></div><div><dt>${L("已停用")}</dt><dd>${guidance.inactive_entries.length}</dd></div><div><dt>${L("历史版本")}</dt><dd>${guidance.revisions.length}</dd></div></dl></section><section><h2>${L("Runtime 发现新内容时")}</h2><p>${L("它会在当前对话展示精确原文并征求同意；你确认后直接写入这里，不会绑定 Goal，也不会占用 Goal 的决策队列。")}</p></section><section><h2>${L("已停用的说明")}</h2>${inactiveItems}</section></aside></div>
    </section></div>
  </main>
  <script id="project-guidance-data" type="application/json">${guidanceData}</script>
  <script>${clientI18nScript()}${CONTROL_CLIENT_SCRIPT}${PROJECT_GUIDANCE_CLIENT_SCRIPT}${VISUAL_FOUNDATION_CLIENT_SCRIPT}</script>
</body></html>`;
}

function planningTopbar(title:string,subtitle:string,returnHref:string,_pagePath:string,desktop:boolean):string{return `<header class="topbar"><a class="brand" href="${returnHref}">${icon("brand")}<strong>GoalBoard</strong></a><div class="project-context"${desktop?" data-tauri-drag-region":""}><strong${desktop?" data-tauri-drag-region":""}>${escapeHtml(title)}</strong><small${desktop?" data-tauri-drag-region":""}>${escapeHtml(subtitle)}</small></div><div class="top-spacer"${desktop?" data-tauri-drag-region":""}></div><a class="top-action" href="${returnHref}" aria-label="${L("关闭设置")}">${icon(desktop?"x":returnHref.includes("/projects/")?"tree":"folder")}<span>${returnHref.includes("/projects/")?L("Goal Tree"):L("项目列表")}</span></a></header>`}

function planningRenderer(controlToken: string, desktopShell: boolean, navigation: string) {
  return createWorkbenchGoalsPlanningRenderer({
    translate: L, escapeHtml, icon, listJoin, withDesktopQuery,
    settingsContextHref,
    renderPage: (page) => `<!doctype html>${page.documentComment ?? ""}<html lang="${htmlLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${controlTokenMeta(controlToken)}<title>${escapeHtml(page.title)} · GoalBoard</title><script>${THEME_BOOTSTRAP_SCRIPT}</script><link rel="stylesheet" href="/assets/goalboard-settings.css"></head><body class="settings-page planning-page" data-desktop-shell="true"${desktopShell?' data-native-desktop="true"':""}>${renderIconSprite()}${planningTopbar(page.heading,page.subtitle,page.returnHref,page.pagePath,desktopShell)}<main class="settings-shell">${navigation}<div class="settings-content">${page.body}</div></main><script>${clientI18nScript()}${page.requiresControl ? CONTROL_CLIENT_SCRIPT : ""}${page.clientScript}${VISUAL_FOUNDATION_CLIENT_SCRIPT}</script></body></html>`,
  });
}
export function renderGoalBoardPlanningLibrary(methods: readonly PlanningMethodPack[], contextProject: WebProjectNavigation | null = null, controlToken = "", desktopShell = false, projects: readonly WebProjectNavigation[] = []): string {
  const navigation = contextProject ? renderProjectSettingsNavigation("planning", contextProject, desktopShell, projects) : renderSettingsNavigation("planning", null, desktopShell, projects);
  return planningRenderer(controlToken, desktopShell, navigation).renderLibrary(methods, contextProject, desktopShell);
}
export function renderGoalBoardPlanningMethodPage(method: PlanningMethodPack | null, mode: "detail" | "edit" | "new", saveScope: "personal" | "project", project: WebProjectNavigation | null, controlToken = "", desktopShell = false, projects: readonly WebProjectNavigation[] = []): string {
  const navigation = project ? renderProjectSettingsNavigation("planning", project, desktopShell, projects) : renderSettingsNavigation("planning", null, desktopShell, projects);
  return planningRenderer(controlToken, desktopShell, navigation).renderMethod(method, mode, saveScope, project, desktopShell);
}
export function renderGoalBoardPlanningSettings(view: GoalBoardWebView, methods: readonly PlanningMethodPack[], controlToken = "", desktopShell = false): string {
  const navigation = view.project ? renderProjectSettingsNavigation("planning", view.project, desktopShell, view.projects) : renderSettingsNavigation("projects", null, desktopShell, view.projects);
  const composition = composePlanningMethodPacks(methods.filter(method => method.scope === "project" && method.enabled));
  return planningRenderer(controlToken, desktopShell, navigation).renderProject(view, methods, composition, desktopShell);
}

export function renderGoalBoardSettings(view: GoalBoardSettingsView, controlToken = "", desktopShell = false): string {
  const title = view.section === "appearance"
    ? L("界面与语言")
    : view.section === "runtimes"
      ? L("AI 与执行工具")
      : view.section === "projects"
        ? L("项目设置")
        : L("诊断");
  const contextProject = view.context_project ?? null;
  const settingsPath = settingsContextHref(`/settings/${view.section}`, contextProject, desktopShell);
  const rawReturnHref = contextProject ? `/projects/${encodeURIComponent(contextProject.project_id)}/` : "/";
  const returnHref = desktopShell ? withDesktopQuery(rawReturnHref) : rawReturnHref;
  const projectManager = view.section === "projects";
  const content = view.section === "appearance"
    ? renderAppearanceSettings(settingsPath)
    : view.section === "runtimes"
      ? renderRuntimeSettings(view)
      : view.section === "projects"
        ? renderProjectSettings(view)
        : renderDiagnosticsSettings(view);
  return `<!doctype html>
<html lang="${htmlLang()}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${controlTokenMeta(controlToken)}<title>${title} · ${L("GoalBoard 设置")}</title><script>${THEME_BOOTSTRAP_SCRIPT}</script><link rel="stylesheet" href="/assets/goalboard-settings.css"></head>
<body class="settings-page" data-settings-section="${view.section}" data-desktop-shell="true"${desktopShell ? ' data-native-desktop="true"' : ""}>
  ${renderIconSprite()}
  <header class="topbar"><a class="brand" href="${returnHref}" aria-label="${contextProject ? L("返回 Goal Tree") : L("返回 GoalBoard 项目列表")}">${icon("brand")}<strong>GoalBoard</strong></a><div class="project-context"${desktopShell ? " data-tauri-drag-region" : ""}><strong${desktopShell ? " data-tauri-drag-region" : ""}>${projectManager ? L("项目管理") : L("全局设置")}</strong><small${desktopShell ? " data-tauri-drag-region" : ""}>${projectManager ? L("创建、导入和维护项目") : title}</small></div><div class="top-spacer"${desktopShell ? " data-tauri-drag-region" : ""}></div><a class="top-action" href="${returnHref}" aria-label="${L("关闭全局设置")}">${icon(desktopShell ? "x" : contextProject ? "tree" : "folder")}<span>${contextProject ? L("Goal Tree") : L("项目列表")}</span></a></header>
  <main class="settings-shell${projectManager ? " settings-shell--standalone" : ""}">
    ${projectManager ? "" : renderSettingsNavigation(view.section, contextProject, desktopShell, view.projects)}
    <div class="settings-content">${content}</div>
  </main>
  ${renderRuntimePlanDialog()}
  ${renderProjectMigrationDialog()}
  <div class="toast" data-settings-toast role="status" aria-live="polite"></div>
  <script>${clientI18nScript()}${CONTROL_CLIENT_SCRIPT}${PROJECT_INDEX_CLIENT_SCRIPT}${SETTINGS_CLIENT_SCRIPT}${VISUAL_FOUNDATION_CLIENT_SCRIPT}</script>
</body></html>`;
}

function prefixLocalLinks(html: string, routePrefix: string, desktopShell = false): string {
  const prefixed = routePrefix
    ? html.replace(/href="\/(?!locale(?:\?|")|projects\/)/g, `href="${routePrefix}/`)
    : html;
  const resolved = prefixed
    .replaceAll('href="__PROJECT_INDEX__"', 'href="/"')
    .replaceAll('href="__WORKBENCH_CSS__"', 'href="/assets/goalboard-workbench.css"')
    .replaceAll('href="__PROJECT_SETTINGS__"', `href="${routePrefix ? `${routePrefix}/settings/guidance` : "/settings/projects"}"`)
    .replaceAll('href="__SYSTEM_SETTINGS__"', `href="/settings/appearance${routePrefix ? `?project=${routePrefix.slice("/projects/".length)}` : ""}"`);
  return desktopShell ? appendDesktopQueryToLocalHrefs(resolved) : resolved;
}

const TRASH_GOAL_STYLES = String.raw`
  .trash-goal-document .trash-goal-hero { padding-bottom: 30px; }
  .trash-goal-document .goal-header { padding-bottom: 0; }
  .trash-goal-document .goal-title-kicker { align-items: center; gap: 12px; }
  .trash-goal-document .goal-title-kicker .goal-status {
    flex: 0 0 auto;
    align-self: flex-start;
    min-height: 26px;
    margin: 0;
    padding: 2px 9px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--goal-status-tone) 7%, var(--paper));
  }
  .trash-goal-facts {
    min-width: 0;
    margin: 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px 14px;
    color: var(--muted);
    font-size: 10px;
  }
  .trash-goal-facts > div { min-width: 0; display: inline-flex; align-items: center; gap: 4px; }
  .trash-goal-facts svg { width: 11px; height: 11px; color: var(--faint); }
  .trash-goal-facts dt { color: var(--faint); }
  .trash-goal-facts dd { margin: 0; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .trash-goal-workspace {
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 14px;
  }
  .trash-goal-panel {
    min-width: 0;
    padding: 22px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: color-mix(in srgb, var(--rail) 72%, var(--paper));
  }
  .trash-goal-panel--state { grid-column: 1 / -1; }
  .trash-goal-panel .section-heading { margin-bottom: 14px; }
  .trash-goal-panel .section-heading > span { color: var(--muted); }
  .trash-goal-panel .section-heading h2 { color: var(--ink); font-size: 15px; }
  .trash-goal-panel .section-heading p { max-width: 62ch; color: var(--muted); line-height: 1.5; }
  .trash-goal-panel .trash-summary,
  .trash-goal-panel .business-copy,
  .trash-goal-panel .trash-restore-row { margin: 0; padding: 0; color: var(--ink-soft); }
  .trash-goal-panel .trash-summary p,
  .trash-goal-panel .business-copy p,
  .trash-goal-panel .trash-restore-row p { max-width: 68ch; margin: 0; line-height: 1.65; }
  .trash-goal-panel .trash-summary p + p,
  .trash-goal-panel .business-copy p + p { margin-top: 12px; }
  .trash-goal-panel .trash-summary strong { display: block; margin-bottom: 5px; color: var(--ink); }
  .trash-goal-panel .business-copy strong {
    display: block;
    margin-bottom: 3px;
    color: var(--muted);
    font-size: 10.5px;
    font-weight: 680;
  }
  .trash-goal-panel .business-copy .outcome { color: var(--ink-soft); }
  .trash-goal-panel .trash-restore-row { display: grid; align-content: start; justify-items: start; gap: 18px; }
  .trash-goal-panel .trash-restore-row .button-primary { min-height: 40px; margin: 0; }

  @media (min-width: 761px) {
    body[data-desktop-shell="true"] .trash-goal-document .trash-goal-hero,
    body[data-desktop-shell="true"] .trash-goal-document .trash-goal-workspace {
      border: 0;
      border-radius: 0;
      background: transparent;
      overflow: visible;
    }
    body[data-desktop-shell="true"] .trash-goal-document .trash-goal-hero { padding: 16px 8px 4px; }
    body[data-desktop-shell="true"] .trash-goal-document .trash-goal-workspace { padding: 8px; }
    body[data-desktop-shell="true"] .trash-goal-panel {
      border: 0;
      background: var(--paper);
      box-shadow: var(--shadow-soft);
    }
  }

  @media (max-width: 760px) {
    .trash-goal-document .trash-goal-hero { padding: 25px 18px 24px; }
    .trash-goal-document .goal-title-kicker { align-items: flex-start; flex-direction: column; gap: 9px; }
    .trash-goal-facts { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr); gap: 5px; }
    .trash-goal-document .goal-title-row { display: grid; gap: 12px; }
    .trash-goal-document .goal-title-actions { justify-content: flex-start; }
    .trash-goal-document .goal-title-actions .document-action { min-height: 44px; }
    .trash-goal-workspace { padding: 14px; grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .trash-goal-panel,
    .trash-goal-panel--state { grid-column: 1; padding: 17px; }
    .trash-goal-panel .trash-restore-row .button-primary { min-height: 44px; white-space: normal; }
  }
`;

/** Shared workbench presentation. Kept outside project HTML so the browser can reuse it. */
export function renderGoalBoardWorkbenchStylesheet(): string {
  return `${STYLES}${MORE_STYLES}${RESPONSIVE_STYLES}${VISUAL_FOUNDATION_STYLES}${TRASH_GOAL_STYLES}${PROJECT_OPERATIONS_STYLES}${ARTIFACT_EMBED_STYLES}.document-pane.is-syncing .goal-document { animation: none; }`;
}

/** Full-screen first-run and update journey. */
export function renderGoalBoardOnboardingStylesheet(): string {
  return `
  :root {
    color-scheme: light;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif;
    background: #f1f3f2;
    color: #1f272b;
  }
  * { box-sizing: border-box; }
  html, body { min-height: 100%; margin: 0; }
  body { min-height: 100dvh; overflow-x: hidden; background: transparent; color: #1f272b; isolation: isolate; }
  .onboarding-page:not(.onboarding-page--update) { height: 100dvh; min-height: 0; overflow: hidden; }
  button, input, textarea { font: inherit; }
  button, a { -webkit-tap-highlight-color: transparent; }
  ::selection { background: #c8d2ec; color: #172027; }
  :focus-visible { outline: 2px solid #5068b7; outline-offset: 4px; }
  * { scrollbar-width: thin; scrollbar-color: rgba(91, 105, 113, .38) transparent; }
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 999px; background: rgba(91, 105, 113, .38); background-clip: padding-box; }
  .icon-sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
  .onboarding-atmosphere {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: #f1f3f2;
  }
  .onboarding-topbar,
  .onboarding-room,
  .onboarding-update { position: relative; z-index: 1; }
  .onboarding-page [hidden] { display: none !important; }
  .onboarding-topbar {
    position: fixed;
    inset: 0 0 auto;
    min-height: 60px;
    padding: 8px clamp(20px, 3.2vw, 46px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #465158;
  }
  .onboarding-brand { color: #263036; font-size: 10px; font-weight: 760; letter-spacing: .1em; text-decoration: none; text-transform: uppercase; }
  .onboarding-topbar-actions { display: flex; align-items: center; gap: clamp(8px, 1.4vw, 16px); }
  .onboarding-topbar-actions a { min-height: 44px; display: inline-flex; align-items: center; color: #566268; font-size: 11px; text-decoration: none; transition: color 130ms ease, transform 130ms ease; }
  .onboarding-topbar-actions a:hover { color: #1f272b; transform: translateY(-1px); }
  .onboarding-topbar button {
    min-height: 44px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: #4e5a60;
    font-size: 11px;
    cursor: pointer;
    transition: color 130ms ease, transform 130ms ease, background 130ms ease;
  }
  .onboarding-topbar button:hover { background: #e5e8e7; color: #1f272b; transform: translateY(-1px); }
  .onboarding-room { height: 100dvh; min-height: 0; overflow: hidden; }
  .onboarding-flow {
    position: absolute;
    inset: clamp(118px, calc(61.8dvh - 112px), 430px) auto 32px clamp(24px, 9vw, 136px);
    width: min(calc(100% - clamp(48px, 18vw, 272px)), 480px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    transition: top 280ms cubic-bezier(.16, 1, .3, 1);
    animation: onboarding-session-ready 460ms cubic-bezier(.16, 1, .3, 1) both;
  }
  .onboarding-flow-header {
    width: min(100%, 480px);
    min-height: 44px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .onboarding-progress {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #59666d;
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 9px;
    font-variant-numeric: tabular-nums;
    font-weight: 620;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .onboarding-progress::before { content: ""; width: 5px; height: 5px; flex: none; border-radius: 1px; background: #5068b7; transition: background 130ms ease; }
  .onboarding-stage { position: relative; min-height: 0; }
  .onboarding-step { position: absolute; inset: 0; width: 100%; }
  .onboarding-step.is-current { z-index: 2; }
  .onboarding-step.is-leaving { z-index: 1; pointer-events: none; }
  .onboarding-flow[data-step-direction="forward"] .onboarding-step.is-entering { animation: onboarding-step-in-forward 300ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-flow[data-step-direction="forward"] .onboarding-step.is-leaving { animation: onboarding-step-out-forward 260ms cubic-bezier(.4, 0, 1, 1) both; }
  .onboarding-flow[data-step-direction="backward"] .onboarding-step.is-entering { animation: onboarding-step-in-backward 300ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-flow[data-step-direction="backward"] .onboarding-step.is-leaving { animation: onboarding-step-out-backward 260ms cubic-bezier(.4, 0, 1, 1) both; }
  .onboarding-step h1, .onboarding-update h1 {
    max-width: 22ch;
    margin: 0 0 8px;
    color: #1f272b;
    font-size: clamp(19px, 1.45vw, 21px);
    font-weight: 600;
    letter-spacing: -.025em;
    line-height: 1.3;
    text-wrap: balance;
  }
  .onboarding-step h1:focus { outline: none; }
  .onboarding-intro { max-width: 48ch; margin: 0 0 16px; color: #59656b; font-size: 11.5px; line-height: 1.6; }
  .onboarding-visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
  .onboarding-composer {
    width: min(100%, 480px);
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: end;
    gap: 12px;
  }
  .onboarding-intent { position: relative; min-width: 0; align-self: stretch; display: flex; }
  .onboarding-intent-trigger {
    min-width: 82px;
    min-height: 46px;
    padding: 0 2px 0 0;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border: 0;
    border-radius: 0;
    outline: 0;
    background: transparent;
    box-shadow: inset 0 -1px #cbd3d3;
    color: #344148;
    font-size: 12px;
    font-weight: 660;
    cursor: pointer;
    transition: color 140ms ease, box-shadow 140ms ease;
  }
  .onboarding-intent-trigger:hover { color: #1f272b; box-shadow: inset 0 -1px #9aa8a8; }
  .onboarding-intent-trigger:focus-visible,
  .onboarding-intent.is-open .onboarding-intent-trigger { color: #314d9b; box-shadow: inset 0 -1px #5068b7; }
  .onboarding-intent-trigger svg { width: 13px; height: 13px; color: #68757b; stroke-width: 1.7; transition: color 140ms ease, transform 180ms cubic-bezier(.16, 1, .3, 1); }
  .onboarding-intent.is-open .onboarding-intent-trigger svg { color: #405aa1; transform: rotate(180deg); }
  .onboarding-intent-options {
    position: absolute;
    left: -8px;
    bottom: calc(100% + 8px);
    z-index: 8;
    width: 210px;
    padding: 6px;
    display: grid;
    gap: 1px;
    visibility: hidden;
    opacity: 0;
    transform: translateY(5px) scale(.985);
    transform-origin: left bottom;
    pointer-events: none;
    border-radius: 9px;
    background: rgba(247, 249, 248, .98);
    box-shadow: 0 16px 38px rgba(40, 49, 52, .14);
    transition: opacity 150ms ease, transform 180ms cubic-bezier(.16, 1, .3, 1), visibility 0s linear 180ms;
  }
  .onboarding-intent.is-open .onboarding-intent-options { visibility: visible; opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; transition-delay: 0s; }
  .onboarding-intent-options button {
    width: 100%;
    min-height: 38px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #455158;
    font-size: 11px;
    font-weight: 560;
    text-align: left;
    cursor: pointer;
  }
  .onboarding-intent-options button:hover,
  .onboarding-intent-options button:focus-visible { outline: 0; background: #ecefee; color: #20292d; }
  .onboarding-intent-options button[aria-selected="true"] { background: #e3e7e6; color: #20292d; font-weight: 640; }
  .onboarding-intent-options button > span { min-width: 0; display: flex; align-items: center; gap: 8px; }
  .onboarding-intent-options button > span svg { width: 13px; height: 13px; flex: none; color: #718086; stroke-width: 1.5; }
  .onboarding-intent-options button > span b { min-width: 0; font: inherit; }
  .onboarding-intent-options button[aria-selected="true"] > span svg { color: #405aa1; }
  .onboarding-intent-options i { width: 5px; height: 5px; flex: none; border-radius: 50%; background: transparent; }
  .onboarding-intent-options button[aria-selected="true"] i { background: #5068b7; box-shadow: 0 0 0 3px rgba(80, 104, 183, .09); }
  .onboarding-answer {
    position: relative;
    width: min(100%, 360px);
    min-height: 46px;
    padding: 3px 10px;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    overflow: hidden;
    border: 1px solid #d4dad9;
    border-radius: 5px;
    background: #e6eae9;
    color: #546168;
    font-size: 14px;
    transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  }
  .onboarding-answer::before { content: ""; position: absolute; inset: 0; z-index: 0; background: rgba(80, 104, 183, .08); opacity: 0; transform: scaleX(0); transform-origin: left center; pointer-events: none; }
  .onboarding-step.is-current .onboarding-answer::before { animation: onboarding-control-ready 420ms 80ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-answer::after { content: ""; position: absolute; inset: -1px auto -1px -1px; z-index: 2; width: 1px; background: #5068b7; transform: scaleY(0); transform-origin: center; transition: transform 140ms cubic-bezier(.16, 1, .3, 1); }
  .onboarding-answer > span { position: relative; z-index: 1; flex: none; padding-top: 8px; font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 9px; font-weight: 650; letter-spacing: .06em; line-height: 1.5; }
  .onboarding-composer .onboarding-answer { width: 100%; }
  .onboarding-answer--plain {
    padding: 3px 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: inset 0 -1px #cbd3d3;
  }
  .onboarding-answer--plain::before,
  .onboarding-answer--plain::after { display: none; }
  .onboarding-answer textarea,
  .onboarding-answer input,
  .onboarding-workspace input {
    width: 100%;
    position: relative;
    z-index: 1;
    padding: 7px 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #1f272b;
    caret-color: #5068b7;
  }
  .onboarding-answer textarea { min-height: 38px; max-height: 76px; resize: none; line-height: 1.5; }
  .onboarding-answer input { font-size: inherit; }
  .onboarding-answer textarea::placeholder,
  .onboarding-answer input::placeholder,
  .onboarding-workspace input::placeholder { color: #5d696f; opacity: 1; }
  .onboarding-answer:focus-within { background: #fbfcfb; border-color: #7184c6; box-shadow: 0 8px 22px rgba(41, 54, 59, .07); color: #334047; transform: translateY(-1px); }
  .onboarding-answer:focus-within::after { transform: scaleY(1); }
  .onboarding-answer--plain:focus-within { background: transparent; border-color: transparent; box-shadow: inset 0 -1px #5068b7; transform: none; }
  .onboarding-field-error, .onboarding-error { max-width: 56ch; margin: 10px 0 0; color: #8c3e43; font-size: 11px; line-height: 1.5; }
  .onboarding-echo { max-width: 56ch; margin: 0 0 16px; display: inline-flex; align-items: baseline; gap: 7px; color: #5d696f; font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; animation: onboarding-receipt-lock 320ms 60ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-echo::before { content: ""; width: 5px; height: 5px; flex: none; align-self: center; border-radius: 1px; background: #5068b7; animation: onboarding-receipt-confirm 360ms 120ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-echo strong { color: #344047; font-size: 11px; font-weight: 570; }
  .onboarding-echo span + strong::before { content: none; }
  .onboarding-workspace { width: min(100%, 360px); display: grid; gap: 2px; color: #59656b; font-size: 9.5px; }
  .onboarding-workspace input { min-height: 34px; padding: 0; border: 0; border-bottom: 1px solid #cbd3d3; border-radius: 0; background: transparent; font-size: 11.5px; transition: border-color 140ms ease, color 140ms ease; }
  .onboarding-workspace input:focus { border-color: #5068b7; background: transparent; box-shadow: none; }
  .onboarding-runtime { max-width: 360px; margin: 9px 0 0; padding: 0; border: 0; }
  .onboarding-runtime legend { margin-bottom: 3px; color: #59656b; font-size: 9.5px; }
  .onboarding-runtime { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px; }
  .onboarding-runtime legend { grid-column: 1 / -1; }
  .onboarding-runtime-choice { position: relative; min-width: 0; cursor: pointer; }
  .onboarding-runtime-choice input { position: absolute; opacity: 0; pointer-events: none; }
  .onboarding-runtime-choice > span {
    min-height: 34px;
    padding: 0 8px;
    display: grid;
    grid-template-columns: 13px minmax(0, 1fr) 5px;
    align-items: center;
    gap: 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #3f4a50;
    font-size: 10.5px;
    transition: background 130ms ease, color 130ms ease;
  }
  .onboarding-runtime-choice > span > svg { width: 13px; height: 13px; color: #718086; stroke-width: 1.45; }
  .onboarding-runtime-choice strong { min-width: 0; font-weight: 540; line-height: 1.25; }
  .onboarding-runtime-choice i { width: 5px; height: 5px; border-radius: 50%; background: #b6bfbe; transition: background 130ms ease, box-shadow 130ms ease; }
  .onboarding-runtime-choice:not(:has(input:checked)) i { background: transparent; }
  .onboarding-runtime-choice:hover > span { background: #e9eceb; color: #1f272b; }
  .onboarding-runtime-choice input:checked + span { background: #e2e5e4; color: #1f272b; }
  .onboarding-runtime-choice input:checked + span i { background: #5068b7; }
  .onboarding-runtime-choice input:focus-visible + span { outline: 2px solid #5068b7; outline-offset: 3px; }
  .onboarding-hint { max-width: 360px; margin: 5px 0 0; color: #657177; font-size: 9px; line-height: 1.4; }
  .onboarding-review { max-width: 480px; margin: 1px 0 0; display: grid; gap: 2px; }
  .onboarding-review div { min-height: 34px; padding: 6px 0; display: grid; grid-template-columns: 92px minmax(0, 1fr); align-items: baseline; gap: 14px; }
  .onboarding-review dt { color: #647077; font-size: 10px; }
  .onboarding-review dd { margin: 0; color: #303a3f; font-size: 11.5px; line-height: 1.5; overflow-wrap: anywhere; }
  .onboarding-confirm { max-width: 480px; margin-top: 13px; display: flex; align-items: flex-start; gap: 9px; color: #566168; font-size: 11px; line-height: 1.55; cursor: pointer; }
  .onboarding-confirm input { width: 16px; height: 16px; margin: 1px 0 0; accent-color: #5068b7; }
  body[data-onboarding-tone="4"] .onboarding-flow {
    inset: 72px auto 18px clamp(24px, 6vw, 92px);
    width: min(calc(100% - clamp(48px, 12vw, 184px)), 760px);
  }
  body[data-onboarding-tone="4"] .onboarding-flow-header { width: 100%; margin-bottom: 8px; }
  .onboarding-step--runtime-embedded {
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) 34px;
    gap: 9px;
  }
  .onboarding-runtime-heading { display: grid; grid-template-columns: minmax(0, .75fr) minmax(250px, 1fr); align-items: end; gap: 24px; }
  .onboarding-runtime-heading h1 { max-width: none; margin: 0; }
  .onboarding-runtime-heading .onboarding-intro { max-width: 58ch; margin: 0; font-size: 10.5px; }
  .onboarding-runtime-viewport {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid #c5cccb;
    border-radius: 7px;
    background: #17191c;
  }
  .onboarding-runtime-viewport iframe { width: 100%; height: 100%; display: block; border: 0; background: #17191c; }
  .onboarding-runtime-state { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .onboarding-runtime-state p { min-width: 0; margin: 0; display: flex; align-items: center; gap: 7px; color: #5c686e; font-size: 9.5px; line-height: 1.45; }
  .onboarding-runtime-state p::before { content: ""; width: 5px; height: 5px; flex: none; border-radius: 50%; background: #8d999e; }
  .onboarding-runtime-state p[data-state="ready"]::before { background: #5068b7; }
  .onboarding-runtime-state p[data-state="error"] { color: #8c3e43; }
  .onboarding-runtime-state p[data-state="error"]::before { background: #a64c52; }
  .onboarding-runtime-state button { min-height: 34px; padding: 0; display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: #405aa1; font-size: 10px; font-weight: 620; cursor: pointer; }
  .onboarding-runtime-state button svg { width: 12px; height: 12px; }
  .onboarding-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 14px;
  }
  .onboarding-actions button {
    min-height: 44px;
    padding: 0 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #344148;
    font-size: 10.5px;
    font-weight: 620;
    cursor: pointer;
    box-shadow: none;
    transition: color 130ms ease, opacity 130ms ease;
  }
  .onboarding-actions button svg { width: 14px; height: 14px; stroke-width: 1.45; transition: transform 140ms cubic-bezier(.16, 1, .3, 1); }
  .onboarding-actions button:hover { color: #314d9b; }
  .onboarding-actions .onboarding-back:hover svg { transform: translateX(-2px); }
  .onboarding-actions .onboarding-next:hover svg,
  .onboarding-actions .onboarding-submit:hover svg { transform: translateX(2px); }
  .onboarding-actions button:active { opacity: .62; }
  .onboarding-actions button:disabled { opacity: .42; cursor: wait; }
  .onboarding-actions .onboarding-back { color: #657177; }
  .onboarding-flow > .onboarding-error { position: absolute; top: calc(100% + 8px); left: 0; max-width: min(420px, calc(100vw - 48px)); margin: 0; }
  .onboarding-update-actions button {
    min-height: 38px;
    padding: 0 13px;
    border: 0;
    border-radius: 5px;
    background: #222b30;
    color: #f7f8f7;
    font-size: 11px;
    font-weight: 650;
    cursor: pointer;
    transition: transform 130ms ease, background 130ms ease;
  }
  .onboarding-update-actions button:hover { transform: translateY(-1px); background: #11181c; }
  .onboarding-update-actions button:disabled { opacity: .55; cursor: wait; transform: none; }
  .onboarding-page--update { color: #1f272b; }
  .onboarding-update { width: min(100% - 48px, 480px); min-height: 100dvh; margin: 0 0 0 clamp(24px, 9vw, 136px); padding: 88px 0 56px; display: grid; align-content: center; gap: 24px; }
  .onboarding-update .onboarding-brand { color: #30393e; }
  .onboarding-update h1 { max-width: none; margin: 0 0 12px; color: #20272b; }
  .onboarding-update-copy > p { max-width: 60ch; margin: 0; color: #566168; font-size: 11.5px; line-height: 1.65; }
  .onboarding-update ul { max-width: 480px; margin: 20px 0 0; padding: 0; display: grid; gap: 14px; list-style: none; }
  .onboarding-update li { display: grid; gap: 5px; }
  .onboarding-update li strong { color: #303a3f; font-size: 11.5px; }
  .onboarding-update li span { color: #5d686e; font-size: 11px; line-height: 1.55; }
  .onboarding-update-actions { display: flex; align-items: center; gap: 16px; }
  .onboarding-update-actions a { min-height: 44px; display: inline-flex; align-items: center; color: #566168; font-size: 12px; text-underline-offset: 4px; }
  .onboarding-update .onboarding-error { color: #913f43; }
  @keyframes onboarding-session-ready {
    from { opacity: .62; }
    to { opacity: 1; }
  }
  @keyframes onboarding-step-in-forward {
    from { opacity: .12; clip-path: inset(0 12% 0 0); transform: translateX(16px); }
    to { opacity: 1; clip-path: inset(0); transform: translateX(0); }
  }
  @keyframes onboarding-step-out-forward {
    from { opacity: 1; clip-path: inset(0); transform: translateX(0); }
    to { opacity: 0; clip-path: inset(0 0 0 8%); transform: translateX(-8px); }
  }
  @keyframes onboarding-step-in-backward {
    from { opacity: .12; clip-path: inset(0 0 0 12%); transform: translateX(-16px); }
    to { opacity: 1; clip-path: inset(0); transform: translateX(0); }
  }
  @keyframes onboarding-step-out-backward {
    from { opacity: 1; clip-path: inset(0); transform: translateX(0); }
    to { opacity: 0; clip-path: inset(0 8% 0 0); transform: translateX(8px); }
  }
  @keyframes onboarding-control-ready {
    0% { opacity: 0; transform: scaleX(0); }
    42% { opacity: 1; }
    100% { opacity: 0; transform: scaleX(1); }
  }
  @keyframes onboarding-receipt-lock {
    from { opacity: .35; clip-path: inset(0 16% 0 0); }
    to { opacity: 1; clip-path: inset(0); }
  }
  @keyframes onboarding-receipt-confirm {
    from { opacity: .2; transform: scale(.4); }
    to { opacity: 1; transform: scale(1); }
  }
  @media (max-width: 760px) {
    .onboarding-topbar { min-height: 60px; padding-inline: 18px; }
    .onboarding-topbar-actions { gap: 8px; }
    .onboarding-topbar-actions a { font-size: 11px; }
    .onboarding-topbar button { padding-inline: 8px; }
    .onboarding-room { height: 100dvh; }
    .onboarding-flow { inset: clamp(116px, calc(61.8dvh - 112px), 430px) 20px 24px; width: auto; }
    .onboarding-flow-header { margin-bottom: 8px; }
    .onboarding-step h1 { font-size: 20px; }
    .onboarding-intro { margin-bottom: 16px; font-size: 11.5px; }
    .onboarding-answer { width: 100%; min-height: 48px; padding: 4px 10px; gap: 8px; font-size: 14px; }
    .onboarding-intent-trigger { min-height: 48px; }
    .onboarding-answer--plain { padding: 4px 0; }
    .onboarding-answer > span { padding-top: 8px; font-size: 9px; }
    .onboarding-answer textarea { min-height: 38px; padding-top: 7px; }
    .onboarding-echo { max-width: 100%; }
    .onboarding-runtime-choice > span { min-height: 38px; }
    .onboarding-review div { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    body[data-onboarding-tone="4"] .onboarding-flow { inset: 62px 14px 10px; width: auto; }
    .onboarding-step--runtime-embedded { grid-template-rows: auto minmax(0, 1fr) 38px; gap: 7px; }
    .onboarding-runtime-heading { grid-template-columns: minmax(0, 1fr); gap: 3px; }
    .onboarding-runtime-heading h1 { font-size: 17px; }
    .onboarding-runtime-heading .onboarding-intro { max-width: none; font-size: 9.5px; line-height: 1.45; }
    .onboarding-runtime-viewport { border-radius: 5px; }
    .onboarding-runtime-state p { font-size: 9px; }
    .onboarding-actions button { min-height: 44px; }
    .onboarding-update { width: calc(100% - 40px); margin: 0 20px; padding-block: 78px 40px; align-content: start; }
    .onboarding-update-actions { align-items: stretch; flex-direction: column; }
    .onboarding-update-actions button, .onboarding-update-actions a { justify-content: center; min-height: 48px; }
  }
  @media (max-width: 460px) {
    .onboarding-topbar-actions a { display: none; }
    .onboarding-flow-header { gap: 12px; }
    .onboarding-actions { gap: 10px; }
  }
  /* Native overlay controls occupy the leading 80px; align the content's
     optical center with the packaged macOS traffic lights, not the Web header. */
  body.onboarding-page[data-native-desktop="true"] .onboarding-topbar,
  html[data-native-desktop="true"] .onboarding-page .onboarding-topbar {
    height: 44px;
    min-height: 44px;
    padding: 0 24px 0 var(--desktop-native-project-safe-inline-start, 88px);
  }
  body.onboarding-page[data-native-desktop="true"] .onboarding-topbar > *,
  html[data-native-desktop="true"] .onboarding-page .onboarding-topbar > * {
    transform: translateY(-1px);
  }
  body[data-onboarding-tone="2"] .onboarding-flow { top: clamp(96px, calc(50dvh - 136px), 330px); }
  @media (max-height: 760px) {
    body[data-onboarding-tone="2"] .onboarding-flow { top: max(80px, calc(50dvh - 160px)); }
    body[data-onboarding-tone="3"] .onboarding-flow { top: max(108px, calc(50dvh - 86px)); }
    .onboarding-step--review .onboarding-intro { margin-bottom: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; animation-delay: 0ms !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
  }
  `;
}

/** Shared project index presentation. */
export function renderGoalBoardProjectIndexStylesheet(): string {
  return `${STYLES}${PROJECT_INDEX_STYLES}${VISUAL_FOUNDATION_STYLES}`;
}

/** Shared settings presentation, reused across project and global settings routes. */
export function renderGoalBoardSettingsStylesheet(): string {
  return `${STYLES}${MORE_STYLES}${RESPONSIVE_STYLES}${PROJECT_INDEX_STYLES}${SETTINGS_STYLES}${PROJECT_GUIDANCE_SETTINGS_STYLES}${PROJECT_RULES_SETTINGS_STYLES}${PLANNING_SETTINGS_STYLES}${VISUAL_FOUNDATION_STYLES}`;
}

/** Shared workbench behavior. Locale strings and project facts remain page-local. */
export function renderGoalBoardWorkbenchClientScript(): string {
  return `${CONTROL_CLIENT_SCRIPT}${CLIENT_SCRIPT}${VISUAL_FOUNDATION_CLIENT_SCRIPT}${PROJECT_OPERATIONS_CLIENT_SCRIPT}`;
}

export const { renderGoalBoardWeb, renderGoalBoardRefreshFragment } =
  createWorkbenchGoalsPageRenderer<WebGoalView, GoalBoardWebView, FeedSupplementalEntry>({
    L, escapeHtml, icon, htmlLang, controlTokenMeta, themeBootstrapScript: THEME_BOOTSTRAP_SCRIPT,
    renderIconSprite, clientI18nScript, dataJson, prefixLocalLinks, renderWorkbenchDocument,
    renderGoalDocument, renderTrashGoalDocument, goalsDocumentRenderer, goalsTreeRenderer,
    renderCreateDialog, renderGoalTrashDialog, renderMomentumPlaceholder, renderTuiPane,
    renderProjectOperations: (project, data) => renderProjectOperations(project, data, icon),
    renderDesktopProjectChrome, renderProjectSwitcher,
    feedNativePluginSupplementalEntries, renderFeedNativePluginSurface,
  });
