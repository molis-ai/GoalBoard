#!/usr/bin/env node
import { readPersonalPlanningMethodPacks } from "@adeptify/goalboard-app-local-host";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createGoalBoardLocalHost,
  createGoalCapability,
  goalBoardHostProjectReference,
  type GoalBoardLocalHost,
} from "../local-host/composition.js";
import { GoalBoardV1Error, type GoalProjectApplication } from "@adeptify/goalboard-app-local-host";
import { seedDemoBoard } from "../v1/demo.js";
import { LocalProjectDatabase } from "@adeptify/goalboard-app-local-host";
import type { GoalPolicy, GoalRelationRecord, RiskRecord } from "../v1/types.js";
import {
  GoalBoardProjectCatalog,
  GoalBoardProjectCatalogError,
  normalizeRuntimeWorkContext,
} from "../projects/catalog.js";
import { withGoalBoardProjectCatalog } from "../projects/catalog-session.js";
import { reconcileLegacySessionCatalog } from "../sessions/compatibility.js";
import { SessionContentService } from "@adeptify/goalboard-plugin-work";
import { buildWorkSessionView, handleWorkPanelHttp, handleWorkSessionHttp } from "@adeptify/goalboard-plugin-work";
import { SessionDirectoryService } from "@adeptify/goalboard-plugin-work";
import { SessionHandoffService } from "@adeptify/goalboard-plugin-work";
import { GoalBoardSessionRegistry } from "@adeptify/goalboard-module-private-work-context";
import { RegistryFallbackSessionAdapter } from "@adeptify/goalboard-plugin-work";
import { SessionTuiRecorder } from "@adeptify/goalboard-plugin-work";
import type { RuntimeSessionTransport } from "../sessions/types.js";
import {
  CodexAppServerTransport,
  CodexRuntimeSessionAdapter,
  RuntimeHostRouter,
  isPtyCommandAvailable,
  type GoalBoardPtyHost,
} from "@adeptify/goalboard-service-runtime-host";
import {
  desktopAdvancePrompt,
  desktopLaunchSpec,
  desktopPanelEnv,
  desktopRuntimeTitle,
  isDesktopRuntimeKind,
  isDesktopShellRequest,
} from "@adeptify/goalboard-app-desktop";
import {
  onboardingIntentFrame,
  onboardingPlanningHint,
  type OnboardingIntentFrame,
} from "./onboarding-intent.js";
import {
  createWorkbenchExecutionValidationAdapter,
  createWorkbenchGoalsAdapter,
} from "@adeptify/goalboard-app-workbench";
import { attachGoalBoardPtySocket } from "./pty-socket.js";
import { renderWorkbenchPlanningRequest, renderWorkbenchGoalsReadRequest, renderWorkbenchGoalsPageRequest } from "@adeptify/goalboard-app-workbench";
import { resolveWebControlToken } from "@adeptify/goalboard-app-local-host";
import type {
  GoalBoardProjectRecord,
  GoalBoardWorkspaceDirectoryRecord,
} from "../projects/catalog.js";
import {
  RuntimeIntegrationService,
  SUPPORTED_RUNTIME_IDS,
  isSupportedRuntimeId,
  type SupportedRuntimeId,
} from "@adeptify/goalboard-app-local-host";
import {
  GoalBoardWebServiceManager,
  type GoalBoardWebServiceAction,
} from "@adeptify/goalboard-app-local-host";
import {
  renderGoalDocumentFragment,
  renderGoalPanelFragment,
  renderGoalQuickRecordFragment,
  renderGoalRecordEventsFragment,
  renderGoalRecordsFragment,
  renderGoalBoardProjectIndexStylesheet,
  renderGoalBoardOnboardingStylesheet,
  renderGoalBoardSettingsStylesheet,
  renderGoalBoardWorkbenchClientScript,
  renderGoalBoardWorkbenchStylesheet,
  renderGoalBoardWeb,
  renderGoalBoardOnboarding,
  renderGoalBoardProjectIndex,
  renderGoalBoardProjectGuidanceSettings,
  renderGoalBoardProjectSettings,
  renderGoalBoardMomentumFragment,
  renderGoalBoardRefreshFragment,
  renderGoalBoardPlanningLibrary,
  renderGoalBoardPlanningMethodPage,
  renderGoalBoardPlanningSettings,
  renderGoalBoardSettings,
  WEB_GOAL_STATUSES,
  type GoalBoardWebView,
  type WebCoverageItem,
  type WebEventRecord,
  type WebGoalStatus,
  type WebInputBinding,
  type WebInstallationDiagnostics,
  type WebPolicyBinding,
  type WebProjectNavigation,
  type WebRiskRecord,
  type WebSettingsProject,
  type WebSettingsSection,
} from "./render.js";
import {
  resolvePlanningMethodPacks,
  type PlanningMethodPackInput,
} from "@adeptify/goalboard-module-goals";
import {
  currentLocale,
  L,
  isWebLocale,
  localeSetCookie,
  resolveWebLocale,
  runWithLocale,
  safeNextPath,
} from "./i18n.js";
import { goalPresentationState, createGoalActionPresenter } from "@adeptify/goalboard-app-workbench";
const { presentGoalAction } = createGoalActionPresenter(L);
import { handleFeedNativePluginHttp } from "./feed-native-plugin-http.js";
import { handleArtifactNativePluginHttp, renderGoalArtifactContext } from "./artifact-native-plugin-http.js";
import { openArtifactProjectReference, ArtifactProjectReferenceError } from "@adeptify/goalboard-plugin-artifacts";
import { buildCapsuleSnapshot, renderCapsuleShell } from "./capsule.js";
import {
  ProjectReferenceError,
  readProjectReference,
} from "@adeptify/goalboard-module-evidence-verification";
import { FeedStore, FeedStoreError } from "../feed/store.js";
import { detectRelayImport } from "../feed/relay-import.js";
import { feedItemContext, type FeedSnapshot } from "../feed/types.js";
import { readLinkedFeedContext } from "@adeptify/goalboard-plugin-feed";
import { createContextLedger, createContextMaterializer } from "@adeptify/goalboard-module-context-ledger";
import {
  listFeedSourceCatalog,
} from "../feed/sources/service.js";
import { FeedSourceScheduler } from "../feed/sources/scheduler.js";
import { FeedConnectorService } from "../feed/connectors/service.js";
import { hydrateFeedItemContent } from "../feed/content.js";
import type {
  ProjectOperationsData,
  ProjectWorkspaceRecord,
} from "@adeptify/goalboard-plugin-work";
import {
  GoalBoardWorkspaceActionError,
  repairProjectWorkspace,
  unlinkProjectWorkspace,
} from "@adeptify/goalboard-plugin-work";
import {
  completeGoalBoardOnboarding,
  dismissGoalBoardOnboarding,
  goalBoardOnboardingStatus,
} from "./onboarding.js";

export { resolveWebControlToken, WEB_CONTROL_TOKEN_RELATIVE_PATH } from "@adeptify/goalboard-app-local-host";

export interface WebServerOptions {
  /**
   * In-process fixture input. The public Web command always starts from the
   * GoalBoard project catalog and never accepts a database path.
   */
  databasePath?: string;
  boardId?: string;
  /** GoalBoard-owned catalog directory. Defaults to ~/.goalboard. */
  homeDirectory?: string;
  demo?: boolean;
  /**
   * Read-only root for Evidence locators that name a project-relative file.
   * The server never exposes an arbitrary local path.
   */
  projectRoot?: string;
  /** Shared in-process Runtime integration service. Tests may inject a fixture. */
  runtimeIntegrationService?: RuntimeIntegrationService;
  /** Shared service manager so Web previews and confirmations use one in-memory plan. */
  webServiceManager?: GoalBoardWebServiceManager;
  /** Test-only deterministic local Web control token. Production persists one per GoalBoard home. */
  controlToken?: string;
  /** Test/host injection. Production starts a private Codex app-server lazily on first read/resume. */
  runtimeSessionTransport?: RuntimeSessionTransport;
  /** Shared Local Host fixture or embedding owner. Production Web owns one when omitted. */
  localHost?: GoalBoardLocalHost;
}

interface SessionRuntimeResources {
  registry: GoalBoardSessionRegistry;
  router: RuntimeHostRouter;
  directory: SessionDirectoryService;
  content: SessionContentService;
  handoff: SessionHandoffService;
  recorder: SessionTuiRecorder;
  ownedCodexTransport: CodexAppServerTransport | null;
}

interface ResolvedWebBoardOptions {
  databasePath: string;
  boardId: string;
  demo?: boolean;
  projectRoot?: string;
  project: WebProjectNavigation | null;
  projects: WebProjectNavigation[];
  routePrefix: string;
}

type WebViewOptions = Pick<
  ResolvedWebBoardOptions,
  "databasePath" | "boardId" | "demo" | "projectRoot"
> & Partial<Pick<ResolvedWebBoardOptions, "project" | "projects" | "routePrefix">>;

interface GoalBoardWebViewCacheEntry {
  cursor: number;
  optionsFingerprint: string;
  view: GoalBoardWebView;
}

type GoalBoardWebViewCache = Map<string, GoalBoardWebViewCacheEntry>;

interface FeedSchedulerRuntime {
  scheduler: FeedSourceScheduler;
}

type ResolvedWebRequest =
  | { kind: "catalog_index"; projects: WebProjectNavigation[] }
  | { kind: "project_not_found" }
  | { kind: "board"; pathname: string; options: ResolvedWebBoardOptions };

const REVIEW_LABELS: Record<string, string> = {
  self_verifier: "自检",
  cross_reviewer: "交叉验证",
  adversarial_reviewer: "对抗性验证",
  human_approver: "用户确认",
};

const RELATION_TYPES = new Set<GoalRelationRecord["type"]>([
  "part_of",
  "depends_on",
  "conflicts_with",
  "mitigates",
  "extends",
  "replaces",
  "corrects",
  "invalidates",
  "migrates_from",
]);

type DatabaseRow = Record<string, unknown>;

function rowText(value: unknown): string {
  return value == null ? "" : String(value);
}

function rowJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function uniqueTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))];
}

function webRiskFacts(
  body: Record<string, unknown>,
  fallbackGoalId?: string,
): Omit<Parameters<GoalProjectApplication["goals"]["commands"]["addRisk"]>[1], "risk_id"> {
  const treatment = String(body.treatment ?? "mitigate") as RiskRecord["treatment"];
  const blockingMode = String(body.blocking_mode ?? "none") as RiskRecord["blocking_mode"];
  if (!["accept", "mitigate", "avoid", "defer"].includes(treatment)) {
    throw new Error("Risk 处理方式无效");
  }
  if (!["none", "claim", "completion", "invalidate_on_trigger"].includes(blockingMode)) {
    throw new Error("Risk 阻塞方式无效");
  }
  const suppliedGoalIds = uniqueTextArray(body.goal_ids);
  return {
    goal_ids: suppliedGoalIds.length ? suppliedGoalIds : fallbackGoalId ? [fallbackGoalId] : [],
    description: String(body.description ?? "").trim(),
    probability: String(body.probability ?? "").trim(),
    impact: String(body.impact ?? "").trim(),
    affected_surfaces: uniqueTextArray(body.affected_surfaces),
    trigger: String(body.trigger ?? "").trim(),
    treatment,
    treatment_plan: String(body.treatment_plan ?? "").trim(),
    blocking_mode: blockingMode,
    revisit_condition: String(body.revisit_condition ?? "").trim(),
    owner: String(body.owner ?? "").trim(),
  };
}

function webImpactFacts(
  body: Record<string, unknown>,
  fallbackGoalId?: string,
): Omit<import("@adeptify/goalboard-contracts/modules/goals").ImpactFactsInput, "binding_id"> {
  const access = String(body.access ?? "read") as import("@adeptify/goalboard-contracts/modules/goals").ImpactAccess;
  const state = String(body.state ?? "confirmed") as "proposed" | "confirmed";
  if (!["read", "write", "decide", "exclusive"].includes(access)) {
    throw new Error("Impact access 无效");
  }
  if (!["proposed", "confirmed"].includes(state)) {
    throw new Error("Impact 状态必须是提议中或已确认");
  }
  return {
    goal_id: String(fallbackGoalId ?? body.goal_id ?? "").trim(),
    surface: String(body.surface ?? "").trim(),
    access,
    input_snapshot: String(body.input_snapshot ?? "").trim() || null,
    state,
    reason: String(body.reason ?? "").trim(),
  };
}

function groupByKey<T>(items: readonly T[], keyFor: (item: T) => string | null | undefined): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    if (!key) continue;
    const existing = grouped.get(key);
    if (existing) existing.push(item);
    else grouped.set(key, [item]);
  }
  return grouped;
}

function addGroupedValue<T>(grouped: Map<string, T[]>, key: unknown, value: T): void {
  const normalized = String(key ?? "").trim();
  if (!normalized) return;
  const existing = grouped.get(normalized);
  if (existing) existing.push(value);
  else grouped.set(normalized, [value]);
}

function feedDirectorySnapshot(feed: FeedStore, boardId: string): FeedSnapshot {
  const snapshot = feed.snapshot(boardId);
  return {
    ...snapshot,
    items: snapshot.items.map((item) => ({
      ...item,
      body: null,
      materials: item.materials.map((material) => ({ ...material, content: undefined })),
    })),
  };
}

export function buildGoalBoardWebView(
  store: LocalProjectDatabase,
  coordinator: GoalProjectApplication,
  options: WebViewOptions,
): GoalBoardWebView {
  const snapshot = store.snapshot(options.boardId);
  const executionAdapter = createWorkbenchExecutionValidationAdapter(coordinator.executionValidation);
  const coverage: WebCoverageItem[] = coordinator.goalQueries.listLegacyCoverage(options.boardId);
  const inputBindings = coordinator.goalInputs.list(options.boardId)
    .map(({ board_id: _boardId, ...binding }): WebInputBinding => binding);
  const policyBindings: WebPolicyBinding[] = coordinator.goalQueries.listPolicyHistory(options.boardId);
  const events = (store.db
    .prepare("SELECT * FROM events WHERE board_id = ? ORDER BY seq DESC")
    .all(options.boardId) as DatabaseRow[]).map<WebEventRecord>((row) => ({
    seq: Number(row.seq ?? 0),
    event_id: rowText(row.event_id),
    actor_id: rowText(row.actor_id),
    type: rowText(row.type),
    object_type: rowText(row.object_type),
    object_id: rowText(row.object_id),
    reason: rowText(row.reason),
    payload: rowJson(row.payload_json, null),
    at: rowText(row.at),
  }));
  const riskGoalIds = new Map<string, string[]>();
  const goalRiskIds = new Map<string, string[]>();
  for (const row of coordinator.goalQueries.listGoalRiskLinks(options.boardId)) {
    const riskId = row.risk_id;
    const goalId = row.goal_id;
    addGroupedValue(riskGoalIds, riskId, goalId);
    addGroupedValue(goalRiskIds, goalId, riskId);
  }
  const webRisks: WebRiskRecord[] = snapshot.risks.map((risk) => ({
    ...risk,
    goal_ids: riskGoalIds.get(risk.risk_id) ?? [],
  }));
  const evidenceByGoal = groupByKey(snapshot.evidence, (item) => item.goal_id);
  const evidenceCorrectionsByGoal = groupByKey(snapshot.evidence_corrections, (item) => item.goal_id);
  const reviewObligationsByGoal = groupByKey(snapshot.review_obligations, (item) => item.goal_id);
  const reviewsByGoal = groupByKey(snapshot.reviews, (item) => item.goal_id);
  const impactsByGoal = groupByKey(snapshot.impacts, (item) => item.goal_id);
  const contractProposalsByGoal = groupByKey(snapshot.contract_proposals, (item) => item.goal_id);
  const clarificationSessionsByGoal = groupByKey(snapshot.clarification_sessions, (item) => item.goal_id);
  const clarificationTurnsByGoal = groupByKey(snapshot.clarification_turns, (item) => item.goal_id);
  const coverageByGoal = groupByKey(coverage, (item) => item.owner_goal_id);
  const inputBindingsByGoal = groupByKey(inputBindings, (item) => item.goal_id);
  const policyBindingsByGoal = groupByKey(policyBindings, (item) => item.goal_id);
  const projectPolicyBindings = policyBindings.filter((item) => item.goal_id == null);
  const eventsByObject = groupByKey(events, (item) => item.object_id);
  const relationsByGoal = new Map<string, typeof snapshot.relations>();
  for (const relation of snapshot.relations) {
    addGroupedValue(relationsByGoal, relation.from_goal_id, relation);
    if (relation.to_goal_id !== relation.from_goal_id) {
      addGroupedValue(relationsByGoal, relation.to_goal_id, relation);
    }
  }
  const candidatesByRun = groupByKey(snapshot.candidates, (item) => item.discovered_in_run_id);
  const goalTreeProposalsByGoal = new Map<string, typeof snapshot.goal_tree_proposals>();
  for (const proposal of snapshot.goal_tree_proposals) {
    const touchedGoalIds = new Set<string>();
    if (proposal.root_goal_id) touchedGoalIds.add(proposal.root_goal_id);
    for (const item of proposal.items) {
      for (const object of [...item.affected_objects, ...item.materialized_objects]) {
        if (object.object_type === "goal" && object.object_id) touchedGoalIds.add(object.object_id);
      }
      for (const value of [
        item.payload.goal_id,
        item.payload.from_goal_id,
        item.payload.to_goal_id,
        ...(Array.isArray(item.payload.goal_ids) ? item.payload.goal_ids : []),
      ]) {
        const goalId = String(value ?? "").trim();
        if (goalId) touchedGoalIds.add(goalId);
      }
    }
    for (const goalId of touchedGoalIds) addGroupedValue(goalTreeProposalsByGoal, goalId, proposal);
  }
  const rewiresByGoal = new Map<string, typeof snapshot.rewires>();
  const rewiresByCandidate = groupByKey(snapshot.rewires, (item) => item.candidate_id);
  for (const rewire of snapshot.rewires) {
    const touchedGoalIds = new Set<string>();
    if (rewire.proposal.formal_goal_id) touchedGoalIds.add(rewire.proposal.formal_goal_id);
    for (const relation of rewire.proposal.relations ?? []) {
      for (const goalId of [relation.from_goal_id, relation.to_goal_id]) {
        const normalized = String(goalId ?? "").trim();
        if (normalized) touchedGoalIds.add(normalized);
      }
    }
    for (const impact of rewire.proposal.impacts ?? []) {
      const goalId = String(impact.goal_id ?? "").trim();
      if (goalId) touchedGoalIds.add(goalId);
    }
    for (const risk of rewire.proposal.risks ?? []) {
      if (!Array.isArray(risk.goal_ids)) continue;
      for (const value of risk.goal_ids) {
        const goalId = String(value ?? "").trim();
        if (goalId) touchedGoalIds.add(goalId);
      }
    }
    for (const goalId of touchedGoalIds) addGroupedValue(rewiresByGoal, goalId, rewire);
  }
  const workStates = new Map(
    executionAdapter.query.getGoalWorkStates({ board_id: options.boardId, snapshot }).map((state) => [state.goal_id, state]),
  );
  const actionProjections = new Map(
    executionAdapter.query.getGoalActionProjections({ board_id: options.boardId, snapshot })
      .map((projection) => [projection.goal_id, projection]),
  );
  const allGoals = snapshot.goals.map((goal) => {
    const workState = workStates.get(goal.goal_id);
    if (!workState) throw new Error(`Goal 工作状态不存在: ${goal.goal_id}`);
    const activeClaim = workState.active_claim;
    const resolvedPolicy = coordinator.goalQueries.getResolvedGoalPolicy({
      board_id: options.boardId,
      goal_id: goal.goal_id,
    });
    const status: WebGoalStatus = goalPresentationState(
      workState.work_state,
      goal,
      snapshot,
      workState.reasons,
    );
    const actionProjection = actionProjections.get(goal.goal_id);
    if (!actionProjection) throw new Error(`Goal 动作投影不存在: ${goal.goal_id}`);
    const actionPresentation = presentGoalAction(goal, actionProjection);
    const visibleStatusLabel = status === "replaced"
      ? "已替代"
      : status === "archived"
        ? "已归档"
        : status === "trashed"
          ? "回收站"
          : actionPresentation.status_label;
    const { claims, runs } = coordinator.projectGoalLifecycle(snapshot, goal.goal_id);
    const evidence = evidenceByGoal.get(goal.goal_id) ?? [];
    const reviewObligations = reviewObligationsByGoal.get(goal.goal_id) ?? [];
    const reviews = reviewsByGoal.get(goal.goal_id) ?? [];
    const impacts = impactsByGoal.get(goal.goal_id) ?? [];
    const relations = relationsByGoal.get(goal.goal_id) ?? [];
    const visiblePolicyBindings = [
      ...projectPolicyBindings,
      ...(policyBindingsByGoal.get(goal.goal_id) ?? []),
    ].sort((left, right) =>
      left.created_at.localeCompare(right.created_at) ||
      left.policy_binding_id.localeCompare(right.policy_binding_id)
    );
    const passedCriteria = new Set<string>();
    for (const goalEvidence of evidence) {
      if (goalEvidence.result !== "passed" || goalEvidence.lifecycle_state !== "effective") continue;
      for (const criterionId of goalEvidence.criterion_ids) passedCriteria.add(criterionId);
    }
    const pendingReviews = reviewObligations
      .filter((item) => item.state === "pending")
      .map((item) => REVIEW_LABELS[item.role] ?? item.role);
    const riskIds = new Set(goalRiskIds.get(goal.goal_id) ?? []);
    const evidenceCorrectionIds = (evidenceCorrectionsByGoal.get(goal.goal_id) ?? [])
      .map((item) => item.correction_id);
    const contractProposalIds = (contractProposalsByGoal.get(goal.goal_id) ?? [])
      .map((item) => item.proposal_id);
    const clarificationSessionIds = (clarificationSessionsByGoal.get(goal.goal_id) ?? [])
      .map((item) => item.session_id);
    const clarificationTurnIds = (clarificationTurnsByGoal.get(goal.goal_id) ?? [])
      .map((item) => item.turn_id);
    const goalTreeProposals = goalTreeProposalsByGoal.get(goal.goal_id) ?? [];
    const goalTreeProposalIds = goalTreeProposals.map((item) => item.proposal_id);
    const goalTreeProposalItemIds = goalTreeProposals.flatMap((item) => item.items.map((child) => child.item_id));
    const visiblePolicyBindingIds = visiblePolicyBindings.map((item) => item.policy_binding_id);
    const relatedObjectIds = new Set<string>([
      goal.goal_id,
      ...relations.map((item) => item.relation_id),
      ...impacts.map((item) => item.binding_id),
      ...riskIds,
      ...claims.map((item) => item.claim_id),
      ...runs.map((item) => item.run_id),
      ...evidence.map((item) => item.evidence_id),
      ...evidenceCorrectionIds,
      ...reviewObligations.map((item) => item.obligation_id),
      ...reviews.map((item) => item.review_id),
      ...contractProposalIds,
      ...clarificationSessionIds,
      ...clarificationTurnIds,
      ...goalTreeProposalIds,
      ...goalTreeProposalItemIds,
      ...visiblePolicyBindingIds,
    ]);
    const candidateIds = new Set(runs.flatMap((item) =>
      (candidatesByRun.get(item.run_id) ?? []).map((candidate) => candidate.candidate_id)
    ));
    candidateIds.forEach((id) => relatedObjectIds.add(id));
    const relatedRewireIds = new Set((rewiresByGoal.get(goal.goal_id) ?? []).map((item) => item.rewire_id));
    for (const candidateId of candidateIds) {
      for (const rewire of rewiresByCandidate.get(candidateId) ?? []) relatedRewireIds.add(rewire.rewire_id);
    }
    relatedRewireIds.forEach((id) => relatedObjectIds.add(id));
    const goalEvents = [...relatedObjectIds]
      .flatMap((objectId) => eventsByObject.get(objectId) ?? [])
      .sort((left, right) => right.seq - left.seq);
    return {
      goal,
      status,
      action_projection: actionProjection,
      display_status: actionPresentation.status,
      work_state: workState.work_state,
      status_label: visibleStatusLabel,
      main_action_label: actionPresentation.action_label,
      action_summary: actionPresentation.summary,
      reasons: workState.reasons,
      active_claim_actor: activeClaim?.actor_id ?? null,
      active_claim: activeClaim ?? null,
      active_claim_lease: workState.active_claim_lease,
      claims,
      runs,
      evidence,
      review_obligations: reviewObligations,
      reviews,
      risks: webRisks.filter((item) => riskIds.has(item.risk_id)),
      impacts,
      relations,
      coverage: coverageByGoal.get(goal.goal_id) ?? [],
      input_bindings: inputBindingsByGoal.get(goal.goal_id) ?? [],
      policy_bindings: visiblePolicyBindings,
      events: goalEvents,
      resolved_policy: resolvedPolicy,
      passed_criteria: [...passedCriteria],
      pending_reviews: pendingReviews,
    };
  });
  // Trash is intentionally absent from both the ordinary Tree and the
  // completed-only archive. The dedicated trash view selects it through the
  // shared coordinator read service instead of leaking it into normal work.
  const trashedGoalIds = new Set(
    coordinator.goalQueries.listTrashedGoals(options.boardId).map((goal) => goal.goal_id),
  );
  const goals = allGoals.filter((item) => !item.goal.archived_at && !item.goal.trashed_at);
  const archivedGoals = allGoals.filter((item) => Boolean(item.goal.archived_at) && !item.goal.trashed_at);
  const trashedGoals = allGoals.filter((item) => trashedGoalIds.has(item.goal.goal_id));
  const counts = Object.fromEntries(WEB_GOAL_STATUSES.map((status) => [status, 0])) as GoalBoardWebView["counts"];
  for (const goal of goals) counts[goal.status]++;
  const fallback =
    goals.find((item) => item.display_status === "in_progress") ??
    goals.find((item) => item.display_status === "waiting_user") ??
    goals.find((item) => item.action_projection.progress === "work_recorded" && item.display_status !== "completed") ??
    goals.find((item) => item.display_status === "continue") ??
    goals[0];
  const activeGoalId = goals.some((item) => item.goal.goal_id === snapshot.board.active_goal_id)
    ? snapshot.board.active_goal_id
    : null;
  return {
    // The browser works with a project name and route. The storage board id is
    // a server-side routing detail, so do not expose it in a project Web view.
    snapshot: options.project
      ? { ...snapshot, board: { ...snapshot.board, board_id: "" } }
      : snapshot,
    project: options.project ?? null,
    projects: options.projects ?? [],
    route_prefix: options.routePrefix ?? "",
    demo: Boolean(options.demo),
    active_goal_id: activeGoalId ?? fallback?.goal.goal_id ?? null,
    goals,
    archived_goals: archivedGoals,
    trashed_goals: trashedGoals,
    counts,
    coverage,
    input_bindings: inputBindings,
    policy_bindings: policyBindings,
    events,
    feed: feedDirectorySnapshot(new FeedStore(store.db), options.boardId),
    relay_import: detectRelayImport(),
    feed_source_catalog: listFeedSourceCatalog(),
    feed_connector_auth: new FeedConnectorService(store.db, options.boardId).authStatus(),
  };
}

export function cachedGoalBoardWebView(
  cache: GoalBoardWebViewCache,
  store: LocalProjectDatabase,
  coordinator: GoalProjectApplication,
  options: WebViewOptions,
): GoalBoardWebView {
  const cursor = store.eventCursor(options.boardId);
  const optionsFingerprint = JSON.stringify({
    board_id: options.boardId,
    locale: currentLocale(),
    demo: Boolean(options.demo),
    project_root: options.projectRoot ?? "",
    project: options.project ?? null,
    projects: options.projects ?? [],
    route_prefix: options.routePrefix ?? "",
  });
  const cached = cache.get(options.databasePath);
  if (
    cached?.cursor === cursor &&
    cached.optionsFingerprint === optionsFingerprint
  ) return cached.view;
  const view = buildGoalBoardWebView(store, coordinator, options);
  cache.set(options.databasePath, { cursor, optionsFingerprint, view });
  return view;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function serviceProcessId(): number {
  const inherited = Number(process.env.GOALBOARD_WEB_SERVICE_PROCESS_ID);
  return Number.isSafeInteger(inherited) && inherited > 0 ? inherited : process.pid;
}

function ptyClientFilePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "pty-client.js"),
    path.resolve(here, "../../dist/web/pty-client.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function servePtyClient(request: IncomingMessage, response: ServerResponse): boolean {
  const filePath = ptyClientFilePath();
  if (!fs.existsSync(filePath)) {
    sendJson(response, 404, { error: "desktop pty client missing" });
    return true;
  }
  const body = fs.readFileSync(filePath);
  const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
  const headers = {
    "content-type": "text/javascript; charset=utf-8",
    "cache-control": "private, max-age=0, must-revalidate",
    etag,
    "x-content-type-options": "nosniff",
  };
  if (request.headers["if-none-match"] === etag) {
    response.writeHead(304, headers);
    response.end();
    return true;
  }
  response.writeHead(200, headers);
  response.end(body);
  return true;
}

async function desktopPanelSessionIds(
  catalog: GoalBoardProjectCatalog,
  panelIds: readonly string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (panelIds.length === 0) return result;
  const registry = await openWorkSessionRegistry({ homeDirectory: catalog.homeDirectory });
  try {
    reconcileLegacySessionCatalog(catalog, registry);
    for (const panelId of panelIds) {
      const sessionId = registry.findBySurface(panelId)?.session_id;
      if (sessionId) result.set(panelId, sessionId);
    }
    return result;
  } finally {
    registry.close();
  }
}

async function openSessionRuntimeResources(options: WebServerOptions): Promise<SessionRuntimeResources> {
  const registry = await openWorkSessionRegistry({ homeDirectory: options.homeDirectory });
  const router = new RuntimeHostRouter(
    (runtimeId) => new RegistryFallbackSessionAdapter(runtimeId, registry),
  );
  const ownedCodexTransport = options.runtimeSessionTransport ? null : new CodexAppServerTransport();
  router.register(new CodexRuntimeSessionAdapter(options.runtimeSessionTransport ?? ownedCodexTransport!));
  const directory = new SessionDirectoryService(registry, router);
  const content = new SessionContentService(registry, router);
  return {
    registry,
    router,
    directory,
    content,
    handoff: new SessionHandoffService(registry, router, directory, content),
    recorder: new SessionTuiRecorder(registry),
    ownedCodexTransport,
  };
}

function sessionProjectOperationsData(
  resources: SessionRuntimeResources,
  projectId: string,
  view: GoalBoardWebView,
  projects: readonly WebProjectNavigation[] = [],
  catalogWorkspaces: readonly GoalBoardWorkspaceDirectoryRecord[] = [],
): ProjectOperationsData {
  return buildWorkSessionView({
    projectId,
    sessions: resources.registry,
    runtime: resources.router,
    goals: view.goals.map((item) => item.goal),
    allGoals: [...view.goals, ...view.archived_goals, ...view.trashed_goals].map((item) => item.goal),
    projects,
    catalogWorkspaces,
    supportedRuntimeIds: SUPPORTED_RUNTIME_IDS,
    runtimeTitle: desktopRuntimeTitle,
    workspaceExists: fs.existsSync,
    normalizeWorkspace: (canonicalPath) => normalizeRuntimeWorkContext({
      runtime_id: "goalboard-web",
      stable_work_context_id: null,
      host_declares_stable: false,
      workspace: { canonical_path: canonicalPath, realpath_verified: false },
    }).workspace,
  });
}


function desktopPanelSpawn(
  catalog: GoalBoardProjectCatalog,
  panel: { panel_id: string; runtime_kind: string; launch_command: string; launch_args: string[]; cwd: string | null; work_context_id: string; goal_id: string },
  webUrl: string,
  sessionId: string | null,
): {
  command: string;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
  sessionId: string | null;
} {
  return {
    command: panel.launch_command,
    args: panel.launch_args,
    cwd: panel.cwd,
    sessionId,
    env: desktopPanelEnv({
      homeDirectory: catalog.homeDirectory,
      runtimeId: panel.runtime_kind,
      sessionId,
      panelId: panel.panel_id,
      workContextId: panel.work_context_id,
      goalId: panel.goal_id,
      webUrl,
    }),
  };
}

const PAGE_CSP = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'";

function serveWorkbenchAsset(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const asset = pathname === "/assets/goalboard-workbench.css"
    ? { body: renderGoalBoardWorkbenchStylesheet(), contentType: "text/css; charset=utf-8" }
    : pathname === "/assets/goalboard-workbench.js"
      ? { body: renderGoalBoardWorkbenchClientScript(), contentType: "text/javascript; charset=utf-8" }
      : pathname === "/assets/goalboard-project-index.css"
        ? { body: renderGoalBoardProjectIndexStylesheet(), contentType: "text/css; charset=utf-8" }
        : pathname === "/assets/goalboard-onboarding.css"
          ? { body: renderGoalBoardOnboardingStylesheet(), contentType: "text/css; charset=utf-8" }
        : pathname === "/assets/goalboard-settings.css"
          ? { body: renderGoalBoardSettingsStylesheet(), contentType: "text/css; charset=utf-8" }
      : null;
  if (!asset) return false;
  const etag = `"${createHash("sha256").update(asset.body).digest("base64url")}"`;
  const headers = {
    "content-type": asset.contentType,
    "cache-control": "private, max-age=0, must-revalidate",
    etag,
    "x-content-type-options": "nosniff",
  };
  if (request.headers["if-none-match"] === etag) {
    response.writeHead(304, headers);
    response.end();
    return true;
  }
  response.writeHead(200, headers);
  response.end(request.method === "HEAD" ? undefined : asset.body);
  return true;
}

function loopbackWebOrigin(server: http.Server): string {
  const address = server.address();
  if (address && typeof address === "object") return `http://127.0.0.1:${address.port}`;
  return "http://127.0.0.1:4173";
}

async function handleDesktopPanelApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  serverOptions: WebServerOptions,
  projectId: string,
  coordinator: GoalProjectApplication,
  boardId: string,
  ptyHost: GoalBoardPtyHost,
  webUrl: string,
): Promise<boolean> {
  return handleWorkPanelHttp({
    method: request.method, url, projectId, text: L,
    readBody: () => readBody(request),
    respond: (status, value) => sendJson(response, status, value),
    withHost: (operation) => withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory }, (catalog) => operation({
      panels: catalog.desktopPanels,
      preferredWorkspacePath: (id) => catalog.preferredWorkspacePath(id),
      sessionIds: (ids) => desktopPanelSessionIds(catalog, ids),
      spawn: (panel, sessionId) => desktopPanelSpawn(catalog, panel, webUrl, sessionId),
    })),
    readGoal: (goalId) => coordinator.goalQueries.readGoalContract(boardId, goalId).goal,
    readLinkedFeedContext: (goalId, itemId) => {
      const feed = new FeedStore(coordinator.store.db);
      return readLinkedFeedContext({
        project_id: boardId, goal_id: goalId, item_id: itemId,
        materializer: createContextMaterializer(createContextLedger(coordinator.store.db, {
          authorize: (access) => access.scope.kind === "personal" && access.scope.id === boardId,
        })),
        readGoal: () => coordinator.goalQueries.readGoalContract(boardId, goalId).goal,
        readItem: (id) => {
          try { return feed.getItem(boardId, id); }
          catch (error) {
            if (error instanceof FeedStoreError && error.code === "feed_item_not_found") return null;
            throw error;
          }
        },
        renderItem: (item) => feedItemContext(hydrateFeedItemContent(item)),
      });
    },
    projectGuidance: () => coordinator.goalQueries.readProjectGuidance(boardId).runtime_prompt_prefix,
    isRuntimeKind: isDesktopRuntimeKind,
    launchSpec: desktopLaunchSpec,
    advancePrompt: desktopAdvancePrompt,
    kill: (panelId) => ptyHost.kill(panelId),
    classifyError: (error) => error instanceof GoalBoardV1Error ? 404
      : error instanceof GoalBoardProjectCatalogError ? error.code === "catalog.panel_not_found" ? 404 : 400
      : null,
  });
}

type LocalMutationState = "in_flight" | "complete";

function localHostname(value: string): boolean {
  const hostname = value.toLowerCase();
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1";
}

function requestHost(request: IncomingMessage): string | null {
  const value = request.headers.host?.trim();
  if (!value) return null;
  try {
    const parsed = new URL(`http://${value}`);
    return localHostname(parsed.hostname) ? parsed.host : null;
  } catch {
    return null;
  }
}

function controlTokenMatches(expected: string, actual: string | string[] | undefined): boolean {
  if (typeof actual !== "string") return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function authorizeLocalWebRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  controlToken: string,
  mutationKeys: Map<string, LocalMutationState>,
): boolean {
  const host = requestHost(request);
  if (!host) {
    sendJson(response, 403, { error: L("本地控制请求校验失败") });
    return false;
  }
  if (!request.method || ["GET", "HEAD"].includes(request.method)) return true;
  const isApiMutation = url.pathname.startsWith("/api/")
    || /^\/projects\/[^/]+\/api(?:\/|$)/.test(url.pathname);
  if (!isApiMutation) return true;
  const originValue = request.headers.origin;
  let origin: URL;
  try {
    if (typeof originValue !== "string") throw new Error("missing origin");
    origin = new URL(originValue);
  } catch {
    sendJson(response, 403, { error: L("本地控制请求校验失败") });
    return false;
  }
  if (origin.protocol !== "http:" || !localHostname(origin.hostname) || origin.host !== host) {
    sendJson(response, 403, { error: L("本地控制请求校验失败") });
    return false;
  }
  if (!controlTokenMatches(controlToken, request.headers["x-goalboard-control-token"])) {
    sendJson(response, 403, { error: L("本地控制请求校验失败") });
    return false;
  }
  const idempotencyKey = request.headers["x-goalboard-idempotency-key"];
  if (
    typeof idempotencyKey !== "string"
    || idempotencyKey.length < 8
    || idempotencyKey.length > 200
  ) {
    sendJson(response, 400, { error: L("请求缺少有效的一次性操作键") });
    return false;
  }
  if (mutationKeys.has(idempotencyKey)) {
    sendJson(response, 409, { error: "这次操作已经提交，不会重复执行" });
    return false;
  }
  mutationKeys.set(idempotencyKey, "in_flight");
  response.once("finish", () => {
    if (response.statusCode >= 200 && response.statusCode < 400) {
      mutationKeys.set(idempotencyKey, "complete");
      while (mutationKeys.size > 4096) {
        const oldest = mutationKeys.keys().next().value as string | undefined;
        if (!oldest) break;
        mutationKeys.delete(oldest);
      }
    } else {
      mutationKeys.delete(idempotencyKey);
    }
  });
  return true;
}

function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 256_000) reject(new Error("请求内容过大"));
    });
    request.on("end", () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch {
        reject(new Error("请求不是有效 JSON"));
      }
    });
    request.on("error", reject);
  });
}

function projectNavigation(project: GoalBoardProjectRecord): WebProjectNavigation {
  return {
    project_id: project.project_id,
    display_name: project.display_name,
    data_class: project.data_class,
  };
}

function settingsProject(project: GoalBoardProjectRecord): WebSettingsProject {
  return {
    project_id: project.project_id,
    display_name: project.display_name,
    database_path: project.database_path,
    source: project.source,
    data_class: project.data_class,
    created_at: project.created_at,
  };
}

async function settingsProjects(homeDirectory: string | undefined): Promise<WebSettingsProject[]> {
  return withGoalBoardProjectCatalog({ homeDirectory }, (catalog) => catalog.listProjects().map(settingsProject));
}

function installationDiagnostics(
  homeDirectory: string | undefined,
  projectCount: number,
): WebInstallationDiagnostics {
  const home = path.resolve(homeDirectory ?? path.join(os.homedir(), ".goalboard"));
  const manifestPath = path.join(home, "config", "installation.json");
  let installationState: WebInstallationDiagnostics["installation_state"] = "missing";
  let version: string | null = null;
  let releaseDirectory: string | null = null;
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        installer?: unknown;
        version?: unknown;
        release_path?: unknown;
      };
      if (
        manifest.installer === "goalboard-home-install-v1"
        && typeof manifest.version === "string"
        && typeof manifest.release_path === "string"
      ) {
        version = manifest.version;
        releaseDirectory = path.resolve(home, manifest.release_path);
        installationState = "ready";
      } else {
        installationState = "invalid";
      }
    } catch {
      installationState = "invalid";
    }
  }
  return {
    home_directory: home,
    installation_state: installationState,
    version,
    release_directory: releaseDirectory,
    project_count: projectCount,
    launchers: ([
      ["CLI", "goalboard"],
      ["MCP", "goalboard-mcp"],
      ["Web", "goalboard-web"],
    ] as const).map(([name, file]) => {
      const launcherPath = path.join(home, "bin", file);
      return { name, path: launcherPath, state: fs.existsSync(launcherPath) ? "ready" : "missing" };
    }),
  };
}

function supportedRuntimeId(value: string): SupportedRuntimeId | null {
  return isSupportedRuntimeId(value) ? value : null;
}

function desktopRuntimeAvailability(): Record<string, boolean> {
  return {
    "claude-code": isPtyCommandAvailable("claude"),
    codex: isPtyCommandAvailable("codex"),
    opencode: isPtyCommandAvailable("opencode"),
    "pi-agent": isPtyCommandAvailable("pi"),
    "grok-build": isPtyCommandAvailable("grok"),
  };
}

interface WebOnboardingInitializationInput {
  projectName: string;
  outcome: string;
  intentFrame: OnboardingIntentFrame;
  workspacePath: string | null;
  runtimeKind: string | null;
}

function hasMeaningfulOnboardingText(value: string): boolean {
  return /\p{L}/u.test(value);
}

function webOnboardingInitializationInput(body: Record<string, unknown>): WebOnboardingInitializationInput {
  if (body.user_confirmed !== true) throw new Error("请先确认这次 Project 和根 Goal 写入");
  const projectName = typeof body.project_name === "string" ? body.project_name.trim() : "";
  const outcome = typeof body.outcome === "string" ? body.outcome.trim() : "";
  const intentFrame = body.intent_frame === undefined
    ? "open"
    : onboardingIntentFrame(body.intent_frame);
  const workspacePath = typeof body.workspace_path === "string" && body.workspace_path.trim()
    ? body.workspace_path.trim()
    : null;
  const runtimeKind = typeof body.runtime_kind === "string" && body.runtime_kind.trim()
    ? body.runtime_kind.trim()
    : null;
  if (!hasMeaningfulOnboardingText(projectName)) throw new Error("请填写一个包含文字的项目名称");
  if (projectName.length > 160) throw new Error("项目名称不能超过 160 个字符");
  if (!hasMeaningfulOnboardingText(outcome)) throw new Error("请用一句包含文字的话描述你想看到的结果");
  if (outcome.length > 2_000) throw new Error("结果描述不能超过 2000 个字符");
  if (!intentFrame) throw new Error("请选择一个有效的工作意图");
  if (workspacePath) {
    if (!path.isAbsolute(workspacePath)) throw new Error("工作目录必须是绝对路径");
    let directoryExists = false;
    try {
      directoryExists = fs.statSync(workspacePath).isDirectory();
    } catch {}
    if (!directoryExists) throw new Error("工作目录不存在或当前不可访问");
  }
  if (runtimeKind) {
    if (!isDesktopRuntimeKind(runtimeKind) || runtimeKind === "generic") {
      throw new Error("请选择 GoalBoard 支持的 Runtime");
    }
    if (!workspacePath) throw new Error("打开 TUI 前需要选择一个存在的绝对工作目录");
    if (desktopRuntimeAvailability()[runtimeKind] !== true) {
      throw new Error("这个 Runtime CLI 当前不可用，请重新选择或先不开 TUI");
    }
  }
  return { projectName, outcome, intentFrame, workspacePath, runtimeKind };
}

function fixtureWebBoardOptions(options: WebServerOptions): ResolvedWebBoardOptions | null {
  if (!options.databasePath) return null;
  return {
    databasePath: options.databasePath,
    boardId: options.boardId ?? "default",
    demo: options.demo,
    projectRoot: options.projectRoot,
    project: null,
    projects: [],
    routePrefix: "",
  };
}

function webMigrationRequest(body: Record<string, unknown>): {
  legacyDatabasePath: string;
  displayName?: string;
} {
  if (body.user_confirmed !== true) {
    throw new Error("请先明确确认要迁移这份已有 GoalBoard 数据");
  }
  const legacyDatabasePath = typeof body.legacy_database_path === "string"
    ? body.legacy_database_path.trim()
    : "";
  if (!legacyDatabasePath) throw new Error("请选择要迁移的已有 GoalBoard DB");
  if (legacyDatabasePath.length > 4_000) throw new Error("来源 DB 路径过长");
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  if (displayName.length > 160) throw new Error("迁移后项目名称过长");
  return {
    legacyDatabasePath,
    ...(displayName ? { displayName } : {}),
  };
}

/**
 * Resolving a Web request is deliberately read-only. In particular, opening a
 * project in the browser must not create, bind, or rebind a Runtime Session.
 */
async function resolveWebRequest(
  serverOptions: WebServerOptions,
  pathname: string,
): Promise<ResolvedWebRequest> {
  const fixture = fixtureWebBoardOptions(serverOptions);
  if (fixture) return { kind: "board", pathname, options: fixture };

  return withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory }, (catalog) => {
    const records = catalog.listProjects();
    const projects = records.map(projectNavigation);
    if (
      pathname === "/"
      || pathname === "/onboarding"
      || pathname === "/health"
      || pathname === "/api"
      || pathname.startsWith("/api/")
      || pathname === "/settings"
      || pathname.startsWith("/settings/")
      || pathname === "/sessions"
      || pathname === "/workspaces"
      || pathname.startsWith("/desktop/")
    ) {
      return { kind: "catalog_index", projects };
    }
    const match = pathname.match(/^\/projects\/([^/]+)(\/.*)?$/);
    if (!match) return { kind: "project_not_found" };

    let projectId: string;
    try {
      projectId = decodeURIComponent(match[1]);
    } catch {
      return { kind: "project_not_found" };
    }
    let project: GoalBoardProjectRecord;
    try {
      project = catalog.getProject(projectId);
    } catch {
      return { kind: "project_not_found" };
    }
    return {
      kind: "board",
      pathname: match[2] || "/",
      options: {
        databasePath: project.database_path,
        boardId: project.board_id,
        projectRoot: serverOptions.projectRoot,
        project: projectNavigation(project),
        projects,
        routePrefix: `/projects/${encodeURIComponent(project.project_id)}`,
        demo: project.data_class === "regenerable_demo",
      },
    };
  });
}

export function createGoalBoardWebServer(serverOptions: WebServerOptions = {}): http.Server {
  const fixture = fixtureWebBoardOptions(serverOptions);
  const runtimeIntegrations = serverOptions.runtimeIntegrationService ?? new RuntimeIntegrationService({
    homeDirectory: serverOptions.homeDirectory,
  });
  const webService = serverOptions.webServiceManager ?? new GoalBoardWebServiceManager({
    homeDirectory: serverOptions.homeDirectory,
  });
  const localHost = serverOptions.localHost ?? createGoalBoardLocalHost({
    planningMethods: () => readPersonalPlanningMethodPacks(serverOptions.homeDirectory),
  });
  const ownsLocalHost = !serverOptions.localHost;
  const controlToken = resolveWebControlToken(serverOptions);
  const mutationKeys = new Map<string, LocalMutationState>();
  const webViewCache: GoalBoardWebViewCache = new Map();
  const feedSchedulers = new Map<string, FeedSchedulerRuntime>();
  const sessionResources = openSessionRuntimeResources(serverOptions);
  void sessionResources.catch(() => undefined);
  if (fixture?.demo && !fs.existsSync(fixture.databasePath)) seedDemoBoard(fixture.databasePath);
  const pty = { host: null as GoalBoardPtyHost | null };
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    try {
      if (request.method === "GET" && url.pathname === "/locale") {
        const requested = url.searchParams.get("lang");
        const nextLocale = isWebLocale(requested)
          ? requested
          : resolveWebLocale(request.headers.cookie, request.headers["accept-language"]);
        response.writeHead(302, {
          location: safeNextPath(url.searchParams.get("next")),
          "set-cookie": localeSetCookie(nextLocale),
          "cache-control": "no-store",
        });
        response.end();
        return;
      }
      const capsuleLocale = request.method === "GET" && (
        url.pathname === "/desktop/capsule" ||
        /^\/projects\/[^/]+\/api\/capsule$/.test(url.pathname)
      )
        ? url.searchParams.get("locale")
        : null;
      const locale = isWebLocale(capsuleLocale)
        ? capsuleLocale
        : resolveWebLocale(request.headers.cookie, request.headers["accept-language"]);
      await runWithLocale(locale, async () => {
        if (!authorizeLocalWebRequest(request, response, url, controlToken, mutationKeys)) return;
        if (serveWorkbenchAsset(request, response, url.pathname)) return;
        if (!pty.host) throw new Error("终端宿主尚未就绪");
        await handleGoalBoardWebRequest(
          request,
          response,
          url,
          serverOptions,
          runtimeIntegrations,
          webService,
          controlToken,
          webViewCache,
          feedSchedulers,
          pty.host,
          loopbackWebOrigin(server),
          sessionResources,
          localHost,
        );
      });
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  pty.host = attachGoalBoardPtySocket(server, controlToken, {
    onData(panelId, sessionId, data) {
      void sessionResources
        .then((resources) => resources.recorder.recordOutput(panelId, sessionId, data))
        .catch(() => undefined);
    },
    onExit(panelId, sessionId, exit) {
      void sessionResources
        .then((resources) => resources.recorder.recordExit(panelId, sessionId, exit))
        .catch(() => undefined);
    },
  });
  const schedulerTimer = setInterval(() => {
    for (const [databasePath, runtime] of feedSchedulers) {
      void runtime.scheduler.tick()
        .then((result) => {
          if (result.completed || result.failed) webViewCache.delete(databasePath);
        })
        .catch(() => undefined);
    }
  }, 30_000);
  schedulerTimer.unref();
  server.once("close", () => {
    clearInterval(schedulerTimer);
    feedSchedulers.clear();
    if (ownsLocalHost) void localHost.close();
    void sessionResources
      .then((resources) => {
        resources.recorder.close();
        resources.ownedCodexTransport?.close();
        resources.registry.close();
      })
      .catch(() => undefined);
  });
  return server;
}

async function handleGoalBoardWebRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  serverOptions: WebServerOptions,
  runtimeIntegrations: RuntimeIntegrationService,
  webService: GoalBoardWebServiceManager,
  controlToken: string,
  webViewCache: GoalBoardWebViewCache,
  feedSchedulers: Map<string, FeedSchedulerRuntime>,
  ptyHost: GoalBoardPtyHost,
  webUrl: string,
  sessionResources: Promise<SessionRuntimeResources>,
  localHost: GoalBoardLocalHost,
): Promise<void> {
  const resolved = await resolveWebRequest(serverOptions, url.pathname);
      if (resolved.kind === "catalog_index") {
        if (request.method === "GET" && url.pathname === "/api/onboarding/status") {
          sendJson(response, 200, goalBoardOnboardingStatus(serverOptions.homeDirectory, resolved.projects.length));
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/onboarding/dismiss") {
          const body = await readBody(request);
          const kind = body.kind === "first_run" || body.kind === "update" ? body.kind : null;
          if (!kind || body.user_confirmed !== true) {
            sendJson(response, 400, { error: "请明确确认要关闭哪一段引导" });
            return;
          }
          try {
            sendJson(response, 200, {
              state: dismissGoalBoardOnboarding(serverOptions.homeDirectory, kind),
            });
          } catch (error) {
            sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/onboarding/initialize") {
          let input: WebOnboardingInitializationInput;
          try {
            input = webOnboardingInitializationInput(await readBody(request));
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
            return;
          }
          let partialProjectPath: string | null = null;
          try {
            await withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory }, async (catalog) => {
              const project = await catalog.createProject({
                display_name: input.projectName,
                actor_id: "web-user",
              });
              const projectPath = `/projects/${encodeURIComponent(project.project_id)}/`;
              partialProjectPath = projectPath;
              const hostClient = localHost.client(goalBoardHostProjectReference({
                databasePath: project.database_path,
                boardId: project.board_id,
                projectId: project.project_id,
              }));
              const title = input.outcome
                .replace(/^我想(?:要)?\s*/u, "")
                .replace(/\s+/gu, " ")
                .trim()
                .slice(0, 120) || input.projectName;
              const createdGoal = (await hostClient.invoke(createGoalCapability, {
                board_id: project.board_id,
                goal: {
                  title,
                  outcome: input.outcome,
                  why: "把第一次表达的目标保存为可继续澄清的共同事实",
                  business_logic: `${onboardingPlanningHint(input.intentFrame)} 先保存用户想看到的结果，再由用户和 Runtime 共同补全范围、拆分与验收，不把推断直接写成已确认目标树。`,
                  definition_state: "draft",
                  decomposition_state: "abstract",
                  priority: 50,
                  acceptance_criteria: [],
                },
                actor_id: "web-user",
                idempotency_key: `onboarding-root-goal-${project.project_id}`,
                reason: "用户在首次项目引导中确认创建根 Draft Goal",
              })).goal;
              const workspace = input.workspacePath
                ? catalog.addWorkspaceProject({
                    project_id: project.project_id,
                    canonical_path: input.workspacePath,
                    actor_id: "web-user",
                    user_confirmed: true,
                  })
                : null;
              let journeyWarning: string | null = null;
              try {
                completeGoalBoardOnboarding(serverOptions.homeDirectory, project.project_id);
              } catch (error) {
                journeyWarning = error instanceof Error ? error.message : String(error);
              }
              sendJson(response, 201, {
                project: projectNavigation(project),
                project_path: projectPath,
                goal: {
                  goal_id: createdGoal.goal_id,
                  title: createdGoal.title,
                  definition_state: createdGoal.definition_state,
                  decomposition_state: createdGoal.decomposition_state,
                },
                goal_id: createdGoal.goal_id,
                goal_path: `${projectPath}goals/${encodeURIComponent(createdGoal.goal_id)}`,
                workspace: workspace
                  ? {
                      workspace_id: workspace.workspace_id,
                      display_name: workspace.display_name,
                      canonical_path: workspace.canonical_path,
                    }
                  : null,
                runtime_autofill: Boolean(input.runtimeKind),
                ...(journeyWarning ? { journey_warning: journeyWarning } : {}),
              });
            });
          } catch (error) {
            sendJson(response, partialProjectPath ? 500 : 400, {
              error: partialProjectPath
                ? `项目已经创建，但初始化未完成：${error instanceof Error ? error.message : String(error)}`
                : error instanceof Error ? error.message : String(error),
              ...(partialProjectPath ? { recovery_path: partialProjectPath } : {}),
            });
          }
          return;
        }
        if (request.method === "GET" && url.pathname === "/onboarding") {
          const status = goalBoardOnboardingStatus(serverOptions.homeDirectory, resolved.projects.length);
          const requestedMode = url.searchParams.get("mode");
          const mode = requestedMode === "update" || (status.update_required && requestedMode !== "new-project")
            ? "update"
            : resolved.projects.length === 0
              ? "first_run"
              : "new_project";
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": PAGE_CSP,
          });
          response.end(renderGoalBoardOnboarding({
            mode,
            currentVersion: status.current_version,
            controlToken,
            desktopShell: isDesktopShellRequest(request, url),
            cliAvailability: desktopRuntimeAvailability(),
          }));
          return;
        }
        if (request.method === "GET" && url.pathname === "/desktop/capsule") {
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": PAGE_CSP,
          });
          response.end(renderCapsuleShell(resolved.projects));
          return;
        }
        if (request.method === "GET" && url.pathname === "/settings") {
          response.writeHead(302, {
            location: isDesktopShellRequest(request, url) ? "/settings/appearance?desktop=1" : "/settings/appearance",
            "cache-control": "no-store",
          });
          response.end();
          return;
        }
        const globalPlanningPage = renderWorkbenchPlanningRequest(request.method, url.pathname, "personal", () => {
          const methods = resolvePlanningMethodPacks(readPersonalPlanningMethodPacks(serverOptions.homeDirectory));
          const contextProjectId = url.searchParams.get("project");
          const contextProject = contextProjectId
            ? resolved.projects.find((project) => project.project_id === contextProjectId) ?? null : null;
          return {
            methods,
            library: () => renderGoalBoardPlanningLibrary(methods, contextProject, controlToken, isDesktopShellRequest(request, url), resolved.projects),
            method: (method, mode) => renderGoalBoardPlanningMethodPage(
              method, mode, "personal", contextProject, controlToken, isDesktopShellRequest(request, url), resolved.projects),
          };
        }, L);
        if (globalPlanningPage) {
          if ("error" in globalPlanningPage) { sendJson(response, globalPlanningPage.status, { error: globalPlanningPage.error }); return; }
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": PAGE_CSP,
          });
          response.end(globalPlanningPage.html);
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/settings/planning-methods") {
          sendJson(response, 200, { methods: resolvePlanningMethodPacks(readPersonalPlanningMethodPacks(serverOptions.homeDirectory)) });
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/settings/planning-methods") {
          const body = await readBody(request);
          const method = body.method && typeof body.method === "object" && !Array.isArray(body.method)
            ? body.method as PlanningMethodPackInput
            : null;
          if (body.scope !== "personal" || !method) {
            sendJson(response, 400, { error: L("个人方法内容无效") });
            return;
          }
          try {
            const saved = await withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory }, (catalog) => {
              const saved = catalog.personalPlanningMethods.save(method, new Date().toISOString());
              return saved;
            });
            // Personal planning methods are constructor inputs for every
            // Project runtime. Reopen them through the Host instead of letting
            // each entrypoint rebuild its own Coordinator.
            await Promise.all(localHost.status().projects.map((project) =>
              localHost.closeProject(project.storage_key)));
            feedSchedulers.clear();
            sendJson(response, 200, { method: saved });
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        const settingsPageMatch = url.pathname.match(/^\/settings\/(appearance|runtimes|projects|diagnostics)$/);
        if (request.method === "GET" && settingsPageMatch) {
          const section = settingsPageMatch[1] as WebSettingsSection;
          const projects = await settingsProjects(serverOptions.homeDirectory);
          const contextProjectId = url.searchParams.get("project");
          const contextProject = contextProjectId
            ? projects.find((project) => project.project_id === contextProjectId) ?? null
            : null;
          const runtimes = section === "runtimes" ? await runtimeIntegrations.detectAll() : [];
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": PAGE_CSP,
          });
          response.end(renderGoalBoardSettings({
            section,
            context_project: contextProject,
            runtimes,
            projects,
            web_service: await webService.detect(),
            diagnostics: installationDiagnostics(serverOptions.homeDirectory, projects.length),
          }, controlToken, isDesktopShellRequest(request, url)));
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/settings/runtimes") {
          sendJson(response, 200, { runtimes: await runtimeIntegrations.detectAll() });
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/settings/web-service") {
          sendJson(response, 200, await webService.detect());
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/settings/web-service/plan") {
          const body = await readBody(request);
          const action = typeof body.action === "string"
            && ["install", "start", "stop", "restart", "remove"].includes(body.action)
            ? body.action as GoalBoardWebServiceAction
            : null;
          if (!action) {
            sendJson(response, 400, { error: "常驻服务操作无效" });
            return;
          }
          try {
            sendJson(response, 200, await webService.prepare(action));
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/settings/web-service/confirm") {
          const body = await readBody(request);
          const planId = typeof body.plan_id === "string" ? body.plan_id : "";
          const decision = body.decision === "confirmed" || body.decision === "declined" ? body.decision : null;
          if (!planId || !decision) {
            sendJson(response, 400, { error: "常驻服务确认缺少 plan 或明确决定" });
            return;
          }
          try {
            const confirmation = await webService.confirmFromWeb({ plan_id: planId, decision }, serviceProcessId());
            if (confirmation.afterResponse) {
              response.once("finish", () => {
                void confirmation.afterResponse!().catch((error) => console.error("GoalBoard Web restart failed:", error));
              });
            }
            sendJson(response, confirmation.result.status === "restarting" ? 202 : 200, confirmation.result);
          } catch (error) {
            sendJson(response, 409, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        const runtimePlanMatch = url.pathname.match(/^\/api\/settings\/runtimes\/([^/]+)\/plan$/);
        if (request.method === "POST" && runtimePlanMatch) {
          const runtimeId = supportedRuntimeId(decodeURIComponent(runtimePlanMatch[1]));
          const body = await readBody(request);
          const action = body.action === "connect" || body.action === "remove" ? body.action : null;
          if (!runtimeId || !action) {
            sendJson(response, 400, { error: "Runtime 或接入操作无效" });
            return;
          }
          try {
            sendJson(response, 200, await runtimeIntegrations.prepare(runtimeId, action));
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        const runtimeConfirmMatch = url.pathname.match(/^\/api\/settings\/runtimes\/([^/]+)\/confirm$/);
        if (request.method === "POST" && runtimeConfirmMatch) {
          const runtimeId = supportedRuntimeId(decodeURIComponent(runtimeConfirmMatch[1]));
          const body = await readBody(request);
          const decision = body.decision === "confirmed" || body.decision === "declined" ? body.decision : null;
          const planId = typeof body.plan_id === "string" ? body.plan_id.trim() : "";
          if (!runtimeId || !decision || !planId) {
            sendJson(response, 400, { error: "Runtime 接入确认缺少 plan 或明确决定" });
            return;
          }
          const result = await runtimeIntegrations.confirm({ runtime_id: runtimeId, plan_id: planId, decision });
          const successful = ["connected", "already_connected", "removed", "already_removed", "declined"].includes(result.status);
          sendJson(response, successful ? 200 : 409, result);
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/settings/projects") {
          sendJson(response, 200, { projects: await settingsProjects(serverOptions.homeDirectory) });
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/settings/projects") {
          const body = await readBody(request);
          const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
          if (body.user_confirmed !== true || !displayName) {
            sendJson(response, 400, { error: "请确认并填写项目名称" });
            return;
          }
          try {
            await withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory }, async (catalog) => {
              const project = await catalog.createProject({ display_name: displayName, actor_id: "web-user" });
              sendJson(response, 201, {
                project: settingsProject(project),
                project_path: `/projects/${encodeURIComponent(project.project_id)}/`,
              });
            });
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/settings/demo") {
          const body = await readBody(request);
          const action = body.action === "create" || body.action === "reset" || body.action === "remove"
            ? body.action
            : null;
          if (!action || body.user_confirmed !== true) {
            sendJson(response, 400, { error: "请明确确认要创建、重建或删除演示数据" });
            return;
          }
          try {
            await withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory }, async (catalog) => {
              if (action === "create") {
                const result = await catalog.ensureDemoProject({ actor_id: "web-user", user_confirmed: true });
                sendJson(response, 200, {
                  ...result,
                  project: settingsProject(result.project),
                  message: result.status === "existing" ? "示例项目已经存在" : "示例项目已创建",
                });
                return;
              }
              if (action === "reset") {
                const result = await catalog.resetDemoProject({ actor_id: "web-user", user_confirmed: true });
                sendJson(response, 200, {
                  ...result,
                  project: settingsProject(result.project),
                  message: "示例项目已重建；用户项目未修改",
                });
                return;
              }
              const demo = catalog.listProjects().find((project) => project.data_class === "regenerable_demo");
              if (!demo) {
                sendJson(response, 404, { error: "示例项目已经不存在" });
                return;
              }
              const result = await catalog.removeDemoProject({
                project_id: demo.project_id,
                actor_id: "web-user",
                delete_confirmed: true,
                idempotency_key: `web-demo-remove-${randomBytes(16).toString("hex")}`,
              });
              sendJson(response, 200, { ...result, message: "可重建 demo 已删除；用户项目未修改" });
            });
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        const projectRenameMatch = url.pathname.match(/^\/api\/settings\/projects\/([^/]+)\/rename$/);
        if (request.method === "POST" && projectRenameMatch) {
          const body = await readBody(request);
          const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
          if (!displayName) {
            sendJson(response, 400, { error: "项目名称不能为空" });
            return;
          }
          try {
            await withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory }, (catalog) => {
              const project = catalog.renameProject(decodeURIComponent(projectRenameMatch[1]), displayName, "web-user");
              sendJson(response, 200, { project: settingsProject(project) });
            });
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/settings/diagnostics") {
          sendJson(response, 200, installationDiagnostics(serverOptions.homeDirectory, resolved.projects.length));
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/projects/migrate") {
          try {
            const requestInput = webMigrationRequest(await readBody(request));
            await withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory }, async (catalog) => {
              const project = await catalog.migrateLegacyDatabase({
                legacy_database_path: requestInput.legacyDatabasePath,
                ...(requestInput.displayName ? { display_name: requestInput.displayName } : {}),
                actor_id: "web-user",
              });
              sendJson(response, 201, {
                project: projectNavigation(project),
                project_path: `/projects/${encodeURIComponent(project.project_id)}/`,
              });
            });
          } catch (error) {
            const message = error instanceof GoalBoardProjectCatalogError
              ? error.message
              : error instanceof Error
                ? `迁移失败：${error.message}`
                : "迁移失败，请检查来源 DB 后重试";
            sendJson(response, 400, { error: message });
          }
          return;
        }
        if (request.method === "GET" && url.pathname === "/desktop/pty-client.js") {
          servePtyClient(request, response);
          return;
        }
        if (request.method === "GET" && url.pathname === "/health") {
          sendJson(response, 200, {
            status: "ok",
            process_id: process.pid,
            service_process_id: serviceProcessId(),
            project_count: resolved.projects.length,
            desktop_tui: true,
          });
          return;
        }
        if (request.method === "GET" && url.pathname === "/") {
          const desktopShell = isDesktopShellRequest(request, url);
          const onboarding = goalBoardOnboardingStatus(serverOptions.homeDirectory, resolved.projects.length);
          if (onboarding.first_run_required || onboarding.update_required) {
            const modeQuery = onboarding.update_required ? "?mode=update" : "";
            const desktopQuery = desktopShell ? `${modeQuery ? "&" : "?"}desktop=1` : "";
            response.writeHead(302, {
              location: `/onboarding${modeQuery}${desktopQuery}`,
              "cache-control": "no-store",
            });
            response.end();
            return;
          }
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": PAGE_CSP,
          });
          response.end(renderGoalBoardProjectIndex(resolved.projects, controlToken, desktopShell));
          return;
        }
        if (request.method === "GET" && (url.pathname === "/sessions" || url.pathname === "/workspaces")) {
          response.writeHead(302, {
            location: isDesktopShellRequest(request, url) ? "/?desktop=1" : "/",
            "cache-control": "no-store",
          });
          response.end();
          return;
        }
        if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
          sendJson(response, 400, { error: L("请先选择一个 GoalBoard 项目") });
          return;
        }
        sendJson(response, 404, { error: L("页面不存在") });
        return;
      }
      if (resolved.kind === "project_not_found") {
        sendJson(response, 404, { error: L("找不到这个 GoalBoard 项目") });
        return;
      }
      const options = resolved.options;
      url.pathname = resolved.pathname;
      if (!fs.existsSync(options.databasePath)) {
        if (url.pathname.startsWith("/api/")) {
          sendJson(response, 404, { error: "GoalBoard 数据库不存在，请先初始化" });
        } else {
          response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          response.end("GoalBoard 数据库不存在，请先运行 goalboard v1 init。\n");
        }
        return;
      }
      const hostReference = goalBoardHostProjectReference({
        databasePath: options.databasePath,
        boardId: options.boardId,
        projectId: options.project?.project_id,
      });
      await localHost.withProject(hostReference, async ({ store, coordinator }) => {
        if (!feedSchedulers.has(options.databasePath)) {
        const feed = new FeedStore(store.db);
        feed.recoverInterruptedSourceRuns(options.boardId);
        new FeedConnectorService(store.db, options.boardId).ensureSources();
        const scheduler = new FeedSourceScheduler(store.db, options.boardId);
        feedSchedulers.set(options.databasePath, { scheduler });
        void scheduler.tick().then((result) => {
          if (result.completed || result.failed) webViewCache.delete(options.databasePath);
        }).catch(() => undefined);
      }
      const goalsAdapter = createWorkbenchGoalsAdapter(coordinator.goals);
      const executionAdapter = createWorkbenchExecutionValidationAdapter(coordinator.executionValidation);
      const readWebView = (): GoalBoardWebView =>
        cachedGoalBoardWebView(webViewCache, store, coordinator, options);
      {
        const projectSessionWorkspaceMatch = url.pathname.match(/^\/(sessions|workspaces)$/);
        if (request.method === "GET" && projectSessionWorkspaceMatch) {
          const desktopQuery = isDesktopShellRequest(request, url) ? "?desktop=1" : "";
          response.writeHead(302, {
            location: `${options.routePrefix}/${desktopQuery}#sessions`,
            "cache-control": "no-store",
          });
          response.end();
          return;
        }
        const readProjectWorkspaceRecord = async (workspaceId: string): Promise<ProjectWorkspaceRecord | null> => {
          if (!options.project) return null;
          const resources = await sessionResources;
          const catalogWorkspaces = await withGoalBoardProjectCatalog(
            { homeDirectory: serverOptions.homeDirectory },
            (catalog) => catalog.listWorkspaceDirectory(options.project!.project_id),
          );
          return sessionProjectOperationsData(
            resources,
            options.project.project_id,
            readWebView(),
            options.projects,
            catalogWorkspaces,
          ).workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
        };
        if (await handleWorkSessionHttp({
          method: request.method,
          pathname: url.pathname,
          readBody: () => readBody(request),
          respond: (status, value) => sendJson(response, status, value),
          resourcesPromise: sessionResources,
          projectOptions: options,
          hasCurrentGoal: (goalId) => readWebView().goals.some((item) => item.goal.goal_id === goalId),
          readGoalContract: (goalId) => coordinator.goalQueries.readGoalContract(options.boardId, goalId),
          workspace: {
            add: (canonicalPath, projectId) => withGoalBoardProjectCatalog(
              { homeDirectory: serverOptions.homeDirectory },
              (catalog) => catalog.addWorkspaceProject({ canonical_path: canonicalPath, project_id: projectId, actor_id: "web-user", user_confirmed: true }),
            ),
            repair: async (current, canonicalPath, projectId) => {
              const registry = (await sessionResources).registry;
              const result = await withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory },
                (catalog) => repairProjectWorkspace({ catalog, registry, current, canonicalPath, projectId, actorId: "web-user" }));
              return { workspace: result.workspace, updated_session_count: result.sessions.length };
            },
            unlink: async (current, projectId) => {
              const registry = (await sessionResources).registry;
              const result = await withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory },
                (catalog) => unlinkProjectWorkspace({ catalog, registry, current, projectId, actorId: "web-user" }));
              return { changed: result.changed, updated_session_count: result.sessions.length };
            },
            isActionError: (error) => error instanceof GoalBoardWorkspaceActionError,
            read: readProjectWorkspaceRecord,
            normalize: (workspacePath) => normalizeRuntimeWorkContext({
              runtime_id: "goalboard-web",
              stable_work_context_id: null,
              host_declares_stable: false,
              workspace: { canonical_path: workspacePath, realpath_verified: false },
            }).workspace,
            exists: (workspacePath) => fs.existsSync(workspacePath),
            isDirectory: (workspacePath) => fs.statSync(workspacePath).isDirectory(),
          },
        })) return;
        if (request.method === "GET" && url.pathname === "/settings/guidance") {
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": PAGE_CSP,
          });
          response.end(renderGoalBoardProjectGuidanceSettings(
            readWebView(),
            coordinator.goalQueries.readProjectGuidance(options.boardId),
            controlToken,
            isDesktopShellRequest(request, url),
          ));
          return;
        }
        if (request.method === "GET" && url.pathname === "/settings/rules") {
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": PAGE_CSP,
          });
          response.end(renderGoalBoardProjectSettings(
            readWebView(),
            controlToken,
            isDesktopShellRequest(request, url),
          ));
          return;
        }
        const projectPlanningPage = renderWorkbenchPlanningRequest(request.method, url.pathname, "project", route => {
          const view = readWebView();
          const methods = route.kind === "method" && route.method_id === "new"
            ? [] : goalsAdapter.planning.effectiveMethods(options.boardId);
          return {
            methods,
            library: () => renderGoalBoardPlanningSettings(view, methods, controlToken, isDesktopShellRequest(request, url)),
            method: (method, mode) => renderGoalBoardPlanningMethodPage(
              method, mode, "project", view.project, controlToken, isDesktopShellRequest(request, url), view.projects),
          };
        }, L);
        if (projectPlanningPage) {
          if ("error" in projectPlanningPage) { sendJson(response, projectPlanningPage.status, { error: projectPlanningPage.error }); return; }
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": PAGE_CSP,
          });
          response.end(projectPlanningPage.html);
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/settings/planning-methods") {
          sendJson(response, 200, {
            methods: goalsAdapter.planning.effectiveMethods(options.boardId),
            composition: goalsAdapter.planning.projectComposition(options.boardId),
          });
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/settings/planning-methods/apply") {
          const body = await readBody(request);
          const methodId = typeof body.method_id === "string" ? body.method_id.trim() : "";
          const source = methodId
            ? resolvePlanningMethodPacks(readPersonalPlanningMethodPacks(serverOptions.homeDirectory))
              .find((method) => method.method_id === methodId && method.scope !== "project") ?? null
            : null;
          if (!source) {
            sendJson(response, 404, { error: L("找不到可选的规划方法") });
            return;
          }
          const method: PlanningMethodPackInput = {
            method_id: source.method_id,
            version: source.version,
            kind: source.kind,
            name: source.name,
            summary: source.summary,
            instructions: source.instructions,
            applies_to: source.applies_to,
            domain_tags: source.domain_tags,
            steps: source.steps,
            required_coverage: source.required_coverage,
            dependency_rules: source.dependency_rules,
            evidence_requirements: source.evidence_requirements,
            completion_checks: source.completion_checks,
            failure_modes: source.failure_modes,
            source_refs: source.source_refs,
            confidence: source.confidence,
            enabled: true,
          };
          try {
            sendJson(response, 200, goalsAdapter.planning.saveProjectMethod({
              board_id: options.boardId,
              method,
              actor_id: "web-user",
              user_confirmed: body.user_confirmed === true,
            }));
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/settings/planning-methods") {
          const body = await readBody(request);
          const scope = body.scope === "personal" ? "personal" : body.scope === "project" ? "project" : null;
          const method = body.method && typeof body.method === "object" && !Array.isArray(body.method)
            ? body.method as PlanningMethodPackInput
            : null;
          if (!scope || !method) {
            sendJson(response, 400, { error: L("保存范围或方法内容无效") });
            return;
          }
          try {
            if (scope === "project") {
              const saved = goalsAdapter.planning.saveProjectMethod({
                board_id: options.boardId,
                method,
                actor_id: "web-user",
                user_confirmed: true,
              });
              sendJson(response, 200, saved);
            } else {
              await withGoalBoardProjectCatalog({ homeDirectory: serverOptions.homeDirectory }, (catalog) => {
                const saved = catalog.personalPlanningMethods.save(method, new Date().toISOString());
                sendJson(response, 200, { method: saved });
              });
            }
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (request.method === "GET" && url.pathname === "/health") {
          sendJson(response, 200, {
            status: "ok",
            process_id: process.pid,
            service_process_id: serviceProcessId(),
            board_id: options.boardId,
            desktop_tui: true,
          });
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/runtime-availability") {
          sendJson(response, 200, desktopRuntimeAvailability());
          return;
        }
        if (request.method === "GET" && url.pathname === "/desktop/pty-client.js") {
          servePtyClient(request, response);
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/board/cursor") {
          sendJson(response, 200, { observed_event_cursor: store.eventCursor(options.boardId) });
          return;
        }
        const renderedGoalsRead = renderWorkbenchGoalsReadRequest(request.method, url.pathname, url.searchParams, () => {
          const view = readWebView();
          return {
            refresh: (goalId, collection) => renderGoalBoardRefreshFragment(view, goalId, collection === "archive", collection === "trash"),
            momentum: (goalId, collection) => renderGoalBoardMomentumFragment(view, goalId, collection),
            document: (goalId, collection) => renderGoalDocumentFragment(view, goalId, collection),
            records: (goalId, collection) => renderGoalRecordsFragment(view, goalId, collection),
            recordEvents: (goalId, collection, offset) => renderGoalRecordEventsFragment(view, goalId, collection, offset),
            quickRecord: (goalId, collection) => renderGoalQuickRecordFragment(view, goalId, collection),
            panel: (goalId, panel, collection) => {
              const visibleGoals = collection === "archive" ? view.archived_goals : view.goals;
              const artifactContext = panel === "completion" && collection !== "trash"
                && visibleGoals.some((item) => item.goal.goal_id === goalId)
                ? renderGoalArtifactContext({ boardId: options.boardId, goalId, artifacts: coordinator.artifacts.query,
                    ledger: createContextLedger(store.db, {
                      authorize: (access, operation) => operation === "read" && access.scope.kind === "personal" && access.scope.id === options.boardId,
                    }).query }) : "";
              return renderGoalPanelFragment(view, goalId, panel, collection, artifactContext);
            },
          };
        });
        if (renderedGoalsRead) {
          if ("error" in renderedGoalsRead) {
            sendJson(response, renderedGoalsRead.status, { error: renderedGoalsRead.error });
            return;
          }
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          });
          response.end(renderedGoalsRead.html);
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/board") {
          sendJson(response, 200, readWebView());
          return;
        }
        if (await handleFeedNativePluginHttp(request, response, url, {
          boardId: options.boardId,
          routePrefix: options.routePrefix,
          databasePath: options.databasePath,
          store,
          coordinator,
          readWebView,
          invalidateWebView: () => webViewCache.delete(options.databasePath),
        })) return;
        if (request.method === "GET" && url.pathname === "/api/capsule") {
          if (!options.project) {
            sendJson(response, 400, { error: L("请先选择一个 GoalBoard 项目") });
            return;
          }
          const available = coordinator.queryAvailable({
            board_id: options.boardId,
            actor_id: "capsule-viewer",
          }).available;
          sendJson(response, 200, buildCapsuleSnapshot(readWebView(), available));
          return;
        }
        if (options.project?.project_id) {
          const handled = await handleDesktopPanelApi(
            request,
            response,
            url,
            serverOptions,
            options.project.project_id,
            coordinator,
            options.boardId,
            ptyHost,
            webUrl,
          );
          if (handled) return;
        }
        const projectReferenceMatch = url.pathname.match(/^\/api\/project-references\/([^/]+)$/);
        if (request.method === "GET" && projectReferenceMatch) {
          try {
            const reference = decodeURIComponent(projectReferenceMatch[1]);
            const evidenceId = url.searchParams.get("evidence_id")?.trim() || null;
            const opened = openArtifactProjectReference({
              evidence: coordinator.evidenceVerification.query,
              readProjectReference,
            }, { boardId: options.boardId, reference, evidenceId, projectRoot: options.projectRoot });
            response.writeHead(200, {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "no-store",
              "content-disposition": `inline; filename="${opened.fileName.replaceAll('"', "")}"`,
              "x-content-type-options": "nosniff",
            });
            response.end(opened.content);
          } catch (error) {
            const status = error instanceof ProjectReferenceError || error instanceof ArtifactProjectReferenceError
              ? error.status : 400;
            sendJson(response, status, {
              error: error instanceof Error ? error.message : "项目内引用无法打开",
            });
          }
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/goals") {
          const body = await readBody(request);
          const requiredText = (name: string, maximum = 4_000): string => {
            const result = typeof body[name] === "string" ? body[name].trim() : "";
            if (!result) throw new Error(`${name} 不能为空`);
            if (result.length > maximum) throw new Error(`${name} 内容过长`);
            return result;
          };
          const optionalText = (name: string): string | undefined => {
            const result = typeof body[name] === "string" ? body[name].trim() : "";
            return result || undefined;
          };
          const draftText = (name: string, maximum = 4_000): string => {
            const result = typeof body[name] === "string" ? body[name].trim() : "";
            if (result.length > maximum) throw new Error(`${name} 内容过长`);
            return result;
          };
          const priority = Number(body.priority ?? 50);
          if (!Number.isFinite(priority) || priority < 0 || priority > 100) {
            sendJson(response, 400, { error: "priority 必须是 0 到 100 的数字" });
            return;
          }
          const goalId = optionalText("goal_id");
          const parentGoalId = optionalText("parent_goal_id");
          const dependencyGoalIds = [
            ...new Set(
              (Array.isArray(body.dependency_goal_ids) ? body.dependency_goal_ids : [])
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ];
          const acceptanceStatements = [
            ...new Set(
              (Array.isArray(body.acceptance_criteria) ? body.acceptance_criteria : [])
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ];
          const knownGoalIds = new Set(
            store.snapshot(options.boardId).goals.map((goal) => goal.goal_id),
          );
          const relationTargets = [...(parentGoalId ? [parentGoalId] : []), ...dependencyGoalIds];
          const missingTargets = relationTargets.filter((target) => !knownGoalIds.has(target));
          if (missingTargets.length) {
            sendJson(response, 400, {
              error: `找不到关联 Goal: ${[...new Set(missingTargets)].join("、")}`,
            });
            return;
          }
          if (goalId && relationTargets.includes(goalId)) {
            sendJson(response, 400, { error: "新 Goal 不能依赖或属于自身" });
            return;
          }
          let created;
          try {
            created = goalsAdapter.commands.createGoal(
              options.boardId,
              {
                ...(goalId ? { goal_id: goalId } : {}),
                title: requiredText("title", 120),
                outcome: draftText("outcome"),
                why: draftText("why"),
                business_logic: draftText("business_logic"),
                definition_state: "draft",
                decomposition_state: "abstract",
                priority,
                acceptance_criteria: acceptanceStatements.map((statement) => ({
                  statement,
                  decision_method: "inspection",
                  pass_condition: statement,
                  required_evidence: ["inspection"],
                })),
              },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-goal-${randomUUID()}`),
                reason: "用户从 GoalBoard 手动录入 Goal",
              },
            );
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
            return;
          }
          if (parentGoalId) {
            goalsAdapter.commands.addRelation(
              options.boardId,
              {
                from_goal_id: created.goal.goal_id,
                to_goal_id: parentGoalId,
                type: "part_of",
                state: "active",
                reason: "用户创建 Goal 时指定上级 Goal",
              },
              {
                actor_id: "web-user",
                idempotency_key: `web-parent-${created.goal.goal_id}-${randomUUID()}`,
              },
            );
          }
          for (const dependencyGoalId of dependencyGoalIds) {
            goalsAdapter.commands.addRelation(
              options.boardId,
              {
                from_goal_id: created.goal.goal_id,
                to_goal_id: dependencyGoalId,
                type: "depends_on",
                state: "active",
                reason: "用户创建 Goal 时指定上游依赖",
              },
              {
                actor_id: "web-user",
                idempotency_key: `web-dependency-${created.goal.goal_id}-${dependencyGoalId}-${randomUUID()}`,
              },
            );
          }
          sendJson(response, 201, {
            goal: created.goal,
            goal_path: `${options.routePrefix}/goals/${encodeURIComponent(created.goal.goal_id)}`,
            observed_event_cursor: store.snapshot(options.boardId).cursor,
          });
          return;
        }
        const draftGoalMatch = url.pathname.match(/^\/api\/goals\/([^/]+)\/draft$/);
        if (request.method === "POST" && draftGoalMatch) {
          const body = await readBody(request);
          const goalId = decodeURIComponent(draftGoalMatch[1]);
          const text = (name: string, maximum = 4_000): string => {
            const value = typeof body[name] === "string" ? body[name].trim() : "";
            if (value.length > maximum) throw new Error(`${name} 内容过长`);
            return value;
          };
          const list = (name: string): string[] => [
            ...new Set(
              (Array.isArray(body[name]) ? body[name] : [])
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ];
          const decompositionState = String(body.decomposition_state ?? "abstract");
          if (!["abstract", "frontier_open", "closed_leaf", "closed_compound"].includes(decompositionState)) {
            sendJson(response, 400, { error: "拆分状态不受支持" });
            return;
          }
          const priority = Number(body.priority ?? 0);
          if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
            sendJson(response, 400, { error: "priority 必须是 0 到 100 的整数" });
            return;
          }
          const criteriaInput = Array.isArray(body.acceptance_criteria)
            ? body.acceptance_criteria
            : [];
          const allowedMethods = new Set([
            "automated_check",
            "measurement",
            "inspection",
            "human_decision",
          ]);
          try {
            const acceptanceCriteria = criteriaInput.map((raw, index) => {
              if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
                throw new Error(`第 ${index + 1} 条验收条件格式无效`);
              }
              const criterion = raw as Record<string, unknown>;
              const decisionMethod = String(criterion.decision_method ?? "inspection");
              if (!allowedMethods.has(decisionMethod)) {
                throw new Error(`第 ${index + 1} 条验收条件的判断方式无效`);
              }
              const target = criterion.target;
              if (
                target != null &&
                (typeof target !== "object" || Array.isArray(target))
              ) {
                throw new Error(`第 ${index + 1} 条验收条件的目标值格式无效`);
              }
              return {
                ...(String(criterion.criterion_id ?? "").trim()
                  ? { criterion_id: String(criterion.criterion_id).trim() }
                  : {}),
                statement: String(criterion.statement ?? "").trim(),
                decision_method: decisionMethod as
                  | "automated_check"
                  | "measurement"
                  | "inspection"
                  | "human_decision",
                pass_condition: String(criterion.pass_condition ?? "").trim(),
                target: (target as Record<string, unknown> | null | undefined) ?? null,
                required_evidence: [
                  ...new Set(
                    (Array.isArray(criterion.required_evidence)
                      ? criterion.required_evidence
                      : [])
                      .map(String)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  ),
                ],
              };
            });
            const title = text("title", 120);
            if (!title) throw new Error("title 不能为空");
            const result = goalsAdapter.commands.updateDraftGoal(
              options.boardId,
              goalId,
              {
                goal_id: goalId,
                title,
                outcome: text("outcome"),
                why: text("why"),
                business_logic: text("business_logic"),
                in_scope: list("in_scope"),
                out_of_scope: list("out_of_scope"),
                constraints: list("constraints"),
                required_inputs: list("required_inputs"),
                promised_outputs: list("promised_outputs"),
                definition_state: "draft",
                decomposition_state: decompositionState as
                  | "abstract"
                  | "frontier_open"
                  | "closed_leaf"
                  | "closed_compound",
                priority,
                acceptance_criteria: acceptanceCriteria,
              },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-draft-${randomUUID()}`),
                reason: text("reason", 1_000),
              },
            );
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const goalRelationMatch = url.pathname.match(/^\/api\/goals\/([^/]+)\/relations$/);
        if (request.method === "POST" && goalRelationMatch) {
          const body = await readBody(request);
          const goalId = decodeURIComponent(goalRelationMatch[1]);
          const targetGoalId = String(body.target_goal_id ?? "").trim();
          const type = String(body.type ?? "") as GoalRelationRecord["type"];
          const direction = String(body.direction ?? "outgoing");
          const reason = String(body.reason ?? "").trim();
          if (!targetGoalId) {
            sendJson(response, 400, { error: "请选择另一个 Goal" });
            return;
          }
          if (!RELATION_TYPES.has(type)) {
            sendJson(response, 400, { error: "关系类型不受支持" });
            return;
          }
          if (direction !== "outgoing" && direction !== "incoming") {
            sendJson(response, 400, { error: "关系方向必须是 outgoing 或 incoming" });
            return;
          }
          if (!reason) {
            sendJson(response, 400, { error: "请说明为什么要建立这条关系" });
            return;
          }
          try {
            const result = goalsAdapter.commands.addRelation(
              options.boardId,
              {
                from_goal_id: direction === "outgoing" ? goalId : targetGoalId,
                to_goal_id: direction === "outgoing" ? targetGoalId : goalId,
                type,
                state: "active",
                reason,
              },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-relation-${randomUUID()}`),
              },
            );
            sendJson(response, 201, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const relationDeactivateMatch = url.pathname.match(
          /^\/api\/relations\/([^/]+)\/deactivate$/,
        );
        if (request.method === "POST" && relationDeactivateMatch) {
          const body = await readBody(request);
          const reason = String(body.reason ?? "").trim();
          if (!reason) {
            sendJson(response, 400, { error: "解除关系时必须说明原因" });
            return;
          }
          try {
            const result = goalsAdapter.commands.deactivateRelation(
              options.boardId,
              {
                relation_id: decodeURIComponent(relationDeactivateMatch[1]),
                reason,
              },
              {
                actor_id: "web-user",
                idempotency_key: String(
                  body.idempotency_key ?? `web-relation-deactivate-${randomUUID()}`,
                ),
              },
            );
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const goalRiskMatch = url.pathname.match(/^\/api\/goals\/([^/]+)\/risks$/);
        if (request.method === "POST" && goalRiskMatch) {
          const body = await readBody(request);
          const reason = String(body.reason ?? "").trim();
          try {
            if (!reason) throw new Error("Risk 必须填写登记原因");
            const result = goalsAdapter.commands.addRisk(
              options.boardId,
              webRiskFacts(body, decodeURIComponent(goalRiskMatch[1])),
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-risk-${randomUUID()}`),
                reason,
              },
            );
            sendJson(response, 201, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const riskUpdateMatch = url.pathname.match(/^\/api\/risks\/([^/]+)\/update$/);
        if (request.method === "POST" && riskUpdateMatch) {
          const body = await readBody(request);
          const reason = String(body.reason ?? "").trim();
          try {
            const result = goalsAdapter.commands.updateRisk(
              options.boardId,
              {
                risk_id: decodeURIComponent(riskUpdateMatch[1]),
                ...webRiskFacts(body),
              },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-risk-update-${randomUUID()}`),
                reason,
              },
            );
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const riskStateMatch = url.pathname.match(/^\/api\/risks\/([^/]+)\/state$/);
        if (request.method === "POST" && riskStateMatch) {
          const body = await readBody(request);
          const requestedState = String(body.state ?? "");
          const state = requestedState as RiskRecord["state"];
          const reason = String(body.reason ?? "").trim();
          const rawResolutionBasis = body.resolution_basis && typeof body.resolution_basis === "object" && !Array.isArray(body.resolution_basis)
            ? body.resolution_basis as Record<string, unknown>
            : null;
          try {
            const riskId = decodeURIComponent(riskStateMatch[1]);
            const idempotencyKey = String(body.idempotency_key ?? `web-risk-state-${randomUUID()}`);
            if (requestedState === "rejected") {
              const snapshot = store.snapshot(options.boardId);
              const currentRisk = snapshot.risks.find((risk) => risk.risk_id === riskId);
              if (!currentRisk) throw new Error("找不到这条 Risk");
              const goalIds = snapshot.goal_risks
                .filter((link) => link.risk_id === riskId)
                .map((link) => link.goal_id);
              const result = goalsAdapter.commands.updateRisk(
                options.boardId,
                {
                  risk_id: riskId,
                  goal_ids: goalIds,
                  description: currentRisk.description,
                  probability: currentRisk.probability,
                  impact: currentRisk.impact,
                  affected_surfaces: currentRisk.affected_surfaces,
                  trigger: currentRisk.trigger,
                  treatment: "mitigate",
                  treatment_plan: currentRisk.treatment_plan || reason,
                  blocking_mode: currentRisk.blocking_mode,
                  revisit_condition: currentRisk.revisit_condition,
                  owner: currentRisk.owner,
                  action_goal_id: typeof body.goal_id === "string" ? body.goal_id : undefined,
                  contract_revision: Number.isInteger(body.contract_revision) ? Number(body.contract_revision) : undefined,
                  action_id: typeof body.action_id === "string" ? body.action_id : undefined,
                  action_token: typeof body.action_token === "string" ? body.action_token : undefined,
                },
                { actor_id: "web-user", actor_kind: "user", idempotency_key: idempotencyKey, reason },
              );
              sendJson(response, 200, { ...result, decision: "rejected" });
            } else {
              const result = goalsAdapter.commands.setRiskState(
                options.boardId,
                {
                  risk_id: riskId,
                  state,
                  reason,
                  goal_id: typeof body.goal_id === "string" ? body.goal_id : undefined,
                  contract_revision: Number.isInteger(body.contract_revision) ? Number(body.contract_revision) : undefined,
                  action_id: typeof body.action_id === "string" ? body.action_id : undefined,
                  action_token: typeof body.action_token === "string" ? body.action_token : undefined,
                  ...(rawResolutionBasis == null
                    ? {}
                    : {
                        resolution_basis: {
                          summary: String(rawResolutionBasis.summary ?? ""),
                          evidence_refs: Array.isArray(rawResolutionBasis.evidence_refs)
                            ? rawResolutionBasis.evidence_refs.map(String)
                            : [],
                          residual_gaps: Array.isArray(rawResolutionBasis.residual_gaps)
                            ? rawResolutionBasis.residual_gaps.map(String)
                            : [],
                        },
                      }),
                },
                { actor_id: "web-user", actor_kind: "user", idempotency_key: idempotencyKey },
              );
              sendJson(response, 200, result);
            }
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const goalImpactMatch = url.pathname.match(/^\/api\/goals\/([^/]+)\/impacts$/);
        if (request.method === "POST" && goalImpactMatch) {
          const body = await readBody(request);
          try {
            const result = goalsAdapter.impacts.add(
              options.boardId,
              webImpactFacts(body, decodeURIComponent(goalImpactMatch[1])),
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-impact-${randomUUID()}`),
              },
            );
            sendJson(response, 201, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const impactUpdateMatch = url.pathname.match(/^\/api\/impacts\/([^/]+)\/update$/);
        if (request.method === "POST" && impactUpdateMatch) {
          const body = await readBody(request);
          try {
            const result = goalsAdapter.impacts.update(
              options.boardId,
              {
                binding_id: decodeURIComponent(impactUpdateMatch[1]),
                ...webImpactFacts(body),
              },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-impact-update-${randomUUID()}`),
                reason: String(body.audit_reason ?? "").trim(),
              },
            );
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const impactDeactivateMatch = url.pathname.match(/^\/api\/impacts\/([^/]+)\/deactivate$/);
        if (request.method === "POST" && impactDeactivateMatch) {
          const body = await readBody(request);
          try {
            const result = goalsAdapter.impacts.deactivate(
              options.boardId,
              {
                binding_id: decodeURIComponent(impactDeactivateMatch[1]),
                reason: String(body.reason ?? "").trim(),
              },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-impact-deactivate-${randomUUID()}`),
              },
            );
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/policy-bindings") {
          const body = await readBody(request);
          const scope = String(body.scope ?? "");
          if (scope !== "project_default" && scope !== "goal") {
            sendJson(response, 400, { error: "scope 必须是 project_default 或 goal" });
            return;
          }
          const goalId = scope === "goal" ? String(body.goal_id ?? "").trim() : null;
          if (scope === "goal" && !goalId) {
            sendJson(response, 400, { error: "当前 Goal 规则必须指定 goal_id" });
            return;
          }
          const policyInput = body.policy as Record<string, unknown> | undefined;
          if (!policyInput || typeof policyInput !== "object" || Array.isArray(policyInput)) {
            sendJson(response, 400, { error: "policy 必须是完整规则对象" });
            return;
          }
          const policy: GoalPolicy = {
            goal_mode: String(policyInput.goal_mode) as GoalPolicy["goal_mode"],
            required_capabilities: Array.isArray(policyInput.required_capabilities)
              ? policyInput.required_capabilities.map(String)
              : [],
            self_verification: policyInput.self_verification === true,
            cross_reviewers: Number(policyInput.cross_reviewers),
            adversarial_reviewers: Number(policyInput.adversarial_reviewers),
            human_approval: policyInput.human_approval === true,
            max_lease_seconds: Number(policyInput.max_lease_seconds),
          };
          const reason = String(body.reason ?? "").trim();
          try {
            const result = goalsAdapter.commands.setPolicy(
              options.boardId,
              { goal_id: goalId, policy, reason },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-policy-${randomUUID()}`),
              },
            );
            sendJson(response, 200, {
              ...result,
              resolved_policy: goalId
                ? coordinator.goalQueries.readGoalContract(options.boardId, goalId).resolved_policy
                : null,
            });
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/project-guidance") {
          sendJson(response, 200, coordinator.goalQueries.readProjectGuidance(options.boardId));
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/project-guidance") {
          const body = await readBody(request);
          try {
            const result = goalsAdapter.commands.addProjectGuidance({
              board_id: options.boardId,
              actor_id: "web-user",
              kind: String(body.kind ?? "") as Parameters<GoalProjectApplication["goals"]["commands"]["addProjectGuidance"]>[0]["kind"],
              content: String(body.content ?? ""),
              source_refs: Array.isArray(body.source_refs) ? body.source_refs.map(String) : [],
              reason: String(body.reason ?? ""),
              confirmation_summary: "用户在项目说明页面直接提交新增",
              user_confirmed: body.user_confirmed === true,
              idempotency_key: String(body.idempotency_key ?? `web-project-guidance-${randomUUID()}`),
            });
            sendJson(response, 200, {
              ...result,
              project_guidance: coordinator.goalQueries.readProjectGuidance(options.boardId),
            });
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const projectGuidanceUpdateMatch = url.pathname.match(/^\/api\/project-guidance\/([^/]+)$/);
        if (request.method === "PATCH" && projectGuidanceUpdateMatch) {
          const body = await readBody(request);
          const action = String(body.action ?? "");
          const confirmationSummary = action === "edit"
            ? "用户在项目说明页面直接提交修改"
            : action === "deactivate"
              ? "用户在项目说明页面直接停用"
              : "用户在项目说明页面直接恢复";
          try {
            const result = goalsAdapter.commands.updateProjectGuidance({
              board_id: options.boardId,
              guidance_id: decodeURIComponent(projectGuidanceUpdateMatch[1]),
              actor_id: "web-user",
              action: action as Parameters<GoalProjectApplication["goals"]["commands"]["updateProjectGuidance"]>[0]["action"],
              kind: body.kind == null
                ? undefined
                : String(body.kind) as Parameters<GoalProjectApplication["goals"]["commands"]["updateProjectGuidance"]>[0]["kind"],
              content: body.content == null ? undefined : String(body.content),
              source_refs: Array.isArray(body.source_refs) ? body.source_refs.map(String) : undefined,
              reason: String(body.reason ?? ""),
              confirmation_summary: confirmationSummary,
              user_confirmed: body.user_confirmed === true,
              idempotency_key: String(body.idempotency_key ?? `web-project-guidance-update-${randomUUID()}`),
            });
            sendJson(response, 200, {
              ...result,
              project_guidance: coordinator.goalQueries.readProjectGuidance(options.boardId),
            });
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const humanReviewMatch = url.pathname.match(
          /^\/api\/goals\/([^/]+)\/review-obligations\/([^/]+)\/review$/,
        );
        if (request.method === "POST" && humanReviewMatch) {
          const body = await readBody(request);
          const verdict = String(body.verdict ?? "");
          if (!["pass", "needs_changes"].includes(verdict)) {
            sendJson(response, 400, {
              error: "用户验收结论必须是 pass 或 needs_changes",
            });
            return;
          }
          try {
            const goalId = decodeURIComponent(humanReviewMatch[1]);
            const obligationId = decodeURIComponent(humanReviewMatch[2]);
            const reasoning = String(body.reasoning ?? "").trim();
            const headerIdempotencyKey = request.headers["x-goalboard-idempotency-key"];
            const idempotencyKey = String(
              body.idempotency_key ??
              (typeof headerIdempotencyKey === "string" ? headerIdempotencyKey : `web-human-review-${randomUUID()}`),
            );
            const result = executionAdapter.commands.submitHumanReview({
              board_id: options.boardId,
              goal_id: goalId,
              obligation_id: obligationId,
              attention_token: String(body.attention_token ?? ""),
              verdict: verdict === "pass" ? "approve" : "request_changes",
              user_id: "web-user",
              session_id: `web:${options.boardId}`,
              message_id: idempotencyKey,
              exact_user_quote: reasoning,
              idempotency_key: idempotencyKey,
            });
            webViewCache.delete(options.databasePath);
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const goalEvidenceMatch = url.pathname.match(/^\/api\/goals\/([^/]+)\/evidence$/);
        if (request.method === "POST" && goalEvidenceMatch) {
          const body = await readBody(request);
          const criterionIds = uniqueTextArray(body.criterion_ids);
          const kind = String(body.kind ?? "attestation");
          const result = String(body.result ?? "passed");
          const locator = String(body.locator ?? "").trim();
          const digest = typeof body.digest === "string" ? body.digest.trim() : "";
          if (!criterionIds.length) {
            sendJson(response, 400, { error: "至少选择一条验收条件" });
            return;
          }
          if (![
            "test",
            "measurement",
            "artifact",
            "inspection",
            "attestation",
            "human_verdict",
          ].includes(kind)) {
            sendJson(response, 400, { error: "Evidence 类型无效" });
            return;
          }
          if (!["passed", "failed", "inconclusive"].includes(result)) {
            sendJson(response, 400, { error: "Evidence 结果必须是 passed、failed 或 inconclusive" });
            return;
          }
          if (!locator || locator.length > 4_000) {
            sendJson(response, 400, { error: "Evidence 定位引用不能为空且不能超过 4000 个字符" });
            return;
          }
          if (digest.length > 16_000) {
            sendJson(response, 400, { error: "Evidence 摘要不能超过 16000 个字符" });
            return;
          }
          try {
            const resultValue = executionAdapter.commands.submitEvidence({
              board_id: options.boardId,
              goal_id: decodeURIComponent(goalEvidenceMatch[1]),
              actor_id: "web-user",
              criterion_ids: criterionIds,
              kind: kind as Parameters<typeof executionAdapter.commands.submitEvidence>[0]["kind"],
              locator,
              locator_context: { project_root: options.projectRoot ?? null },
              digest: digest || null,
              result: result as Parameters<typeof executionAdapter.commands.submitEvidence>[0]["result"],
              contract_revision: Number.isInteger(body.contract_revision) ? Number(body.contract_revision) : undefined,
              action_token: typeof body.action_token === "string" ? body.action_token : undefined,
              idempotency_key: String(body.idempotency_key ?? `web-evidence-${randomUUID()}`),
            });
            sendJson(response, 201, resultValue);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const activeGoalMatch = url.pathname.match(/^\/api\/goals\/([^/]+)\/active$/);
        if (request.method === "POST" && activeGoalMatch) {
          const body = await readBody(request);
          const goalId = decodeURIComponent(activeGoalMatch[1]);
          const reason = String(body.reason ?? "用户从 GoalBoard 设为当前 Goal").trim();
          if (!reason) {
            sendJson(response, 400, { error: "设为当前 Goal 时必须说明原因" });
            return;
          }
          try {
            const result = coordinator.setActiveGoal(
              options.boardId,
              { goal_id: goalId, reason },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-active-goal-${randomUUID()}`),
              },
            );
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const goalArchiveMatch = url.pathname.match(/^\/api\/goals\/([^/]+)\/archive$/);
        if (request.method === "POST" && goalArchiveMatch) {
          const body = await readBody(request);
          if (typeof body.archived !== "boolean") {
            sendJson(response, 400, { error: "archived 必须是 boolean" });
            return;
          }
          const goalId = decodeURIComponent(goalArchiveMatch[1]);
          try {
            const result = goalsAdapter.lifecycle.setArchived(
              options.boardId,
              {
                goal_id: goalId,
                archived: body.archived,
                reason: String(
                  body.reason ??
                    (body.archived ? "用户从 GoalBoard 归档已完成 Goal" : "用户从 GoalBoard 恢复归档 Goal"),
                ),
              },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-archive-${randomUUID()}`),
              },
            );
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const goalTrashMatch = url.pathname.match(/^\/api\/goals\/([^/]+)\/trash$/);
        if (request.method === "POST" && goalTrashMatch) {
          const body = await readBody(request);
          if (typeof body.trashed !== "boolean") {
            sendJson(response, 400, { error: "trashed 必须是 boolean" });
            return;
          }
          if (body.user_confirmed !== true) {
            sendJson(response, 400, { error: "请先在 GoalBoard 中确认此操作" });
            return;
          }
          const goalId = decodeURIComponent(goalTrashMatch[1]);
          try {
            const result = goalsAdapter.lifecycle.setTrashed(
              options.boardId,
              {
                goal_id: goalId,
                trashed: body.trashed,
                reason: String(body.reason ?? "").trim(),
              },
              {
                actor_id: "web-user",
                idempotency_key: String(body.idempotency_key ?? `web-trash-${randomUUID()}`),
              },
            );
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        const contractProposalMatch = url.pathname.match(
          /^\/api\/contract-proposals\/([^/]+)\/decision$/,
        );
        const goalTreeProposalMatch = url.pathname.match(
          /^\/api\/goal-tree-proposals\/([^/]+)\/decision$/,
        );
        if (request.method === "POST" && goalTreeProposalMatch) {
          const body = await readBody(request);
          if (Array.isArray(body.risk_repairs)) {
            if (body.decisions != null || body.confirm_all_pending === true) {
              sendJson(response, 400, { error: "风险修订不能同时提交采用或退回决定" });
              return;
            }
            const proposalId = decodeURIComponent(goalTreeProposalMatch[1]);
            const prepared = coordinator.goalTreeWebInput.prepareRiskRepair(options.boardId, proposalId, {
              risk_repairs: body.risk_repairs, reason: body.reason,
            });
            if ("error" in prepared) {
              sendJson(response, 400, { error: prepared.error });
              return;
            }
            const { decisions: revisionDecisions, reason } = prepared;
            try {
              const result = coordinator.goalTreeDecision.decideGoalTreeProposal({
                board_id: options.boardId,
                proposal_id: proposalId,
                authority: {
                  actor_id: "web-user",
                  actor_kind: "user",
                  authority_source: "web",
                  conversation_ref: `web:${options.boardId}`,
                  message_ref: `web-risk-repair:${randomUUID()}`,
                },
                decisions: revisionDecisions,
                reason,
                idempotency_key: String(body.idempotency_key ?? `web-risk-repair-${randomUUID()}`),
              });
              sendJson(response, 200, result);
            } catch (error) {
              sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
            }
            return;
          }
          if (body.decisions != null && !Array.isArray(body.decisions)) {
            sendJson(response, 400, { error: "decisions 必须是条目决定列表" });
            return;
          }
          try {
            const proposalId = decodeURIComponent(goalTreeProposalMatch[1]);
            const confirmsWholeProposal = body.confirm_all_pending === true;
            const { decisions, decisionReason } = coordinator.goalTreeWebInput.prepareDecision(options.boardId, proposalId, body);
            const result = coordinator.goalTreeDecision.decideGoalTreeProposal({
              board_id: options.boardId,
              proposal_id: proposalId,
              authority: {
                actor_id: "web-user",
                actor_kind: "user",
                authority_source: "web",
                conversation_ref: `web:${options.boardId}`,
                message_ref: `web-decision:${randomUUID()}`,
                whole_confirmation_prompted: confirmsWholeProposal,
              },
              decisions,
              reason: decisionReason || undefined,
              confirm_all_pending: confirmsWholeProposal,
              idempotency_key: String(body.idempotency_key ?? `web-goal-tree-decision-${randomUUID()}`),
            });
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (request.method === "POST" && contractProposalMatch) {
          const body = await readBody(request);
          const decision = String(body.decision);
          if (decision !== "approved" && decision !== "rejected") {
            sendJson(response, 400, { error: "decision 必须是 approved 或 rejected" });
            return;
          }
          const reason = typeof body.reason === "string" ? body.reason.trim() : "";
          if (!reason) {
            sendJson(response, 400, { error: "请填写决定理由或修改意见" });
            return;
          }
          const result = coordinator.legacyContractDecision.decideContractProposal({
            board_id: options.boardId,
            proposal_id: decodeURIComponent(contractProposalMatch[1]),
            actor_id: "web-user",
            actor_kind: "user",
            decision,
            reason,
            idempotency_key: String(body.idempotency_key ?? `web-${randomUUID()}`),
          });
          sendJson(response, 200, result);
          return;
        }
        const candidateMatch = url.pathname.match(/^\/api\/candidates\/([^/]+)\/decision$/);
        if (request.method === "POST" && candidateMatch) {
          const body = await readBody(request);
          const decision = String(body.decision);
          if (decision !== "approved" && decision !== "rejected") {
            sendJson(response, 400, { error: "decision 必须是 approved 或 rejected" });
            return;
          }
          const reason = typeof body.reason === "string" ? body.reason.trim() : "";
          if (!reason) {
            sendJson(response, 400, { error: "请填写决定理由或修改意见" });
            return;
          }
          const result = coordinator.legacyCandidateDecision.decideCandidate({
            board_id: options.boardId,
            candidate_id: decodeURIComponent(candidateMatch[1]),
            actor_id: "web-user",
            actor_kind: "user",
            decision,
            reason,
            idempotency_key: String(body.idempotency_key ?? `web-${randomUUID()}`),
          });
          sendJson(response, 200, result);
          return;
        }
        const rewireMatch = url.pathname.match(/^\/api\/rewires\/([^/]+)\/(?:decision|confirm)$/);
        if (request.method === "POST" && rewireMatch) {
          const body = await readBody(request);
          const decision = String(body.decision ?? "confirmed");
          if (decision !== "confirmed" && decision !== "rejected") {
            sendJson(response, 400, { error: "decision 必须是 confirmed 或 rejected" });
            return;
          }
          const reason = typeof body.reason === "string" ? body.reason.trim() : "";
          if (!reason) {
            sendJson(response, 400, { error: "请填写决定理由或修改意见" });
            return;
          }
          const result = coordinator.legacyRewireDecision.confirmRewire({
            board_id: options.boardId,
            rewire_id: decodeURIComponent(rewireMatch[1]),
            actor_id: "web-user",
            actor_kind: "user",
            decision,
            reason,
            idempotency_key: String(body.idempotency_key ?? `web-${randomUUID()}`),
          });
          sendJson(response, 200, result);
          return;
        }
        if (handleArtifactNativePluginHttp(request, response, url.pathname, {
          boardId: options.boardId, routePrefix: options.routePrefix ?? "",
          projectTitle: options.project?.display_name ?? "GoalBoard",
          query: coordinator.artifacts.query, desktopShell: isDesktopShellRequest(request, url), pageCsp: PAGE_CSP,
        })) return;
        const renderedGoalsPage = await renderWorkbenchGoalsPageRequest(
          request.method, url.pathname, readWebView,
          async (view, { goalId: requestedGoalId, archiveView, trashView, decisionView }) => {
            const desktopShell = isDesktopShellRequest(request, url);
            const operations = options.project
              ? sessionProjectOperationsData(
                  await sessionResources,
                  options.project.project_id,
                  view,
                  options.projects,
                  await withGoalBoardProjectCatalog(
                    { homeDirectory: serverOptions.homeDirectory },
                    (catalog) => catalog.listWorkspaceDirectory(options.project!.project_id),
                  ),
                )
              : { sessions: [], workspaces: [] };
            return renderGoalBoardWeb(
              view,
              requestedGoalId,
              archiveView,
              decisionView,
              trashView,
              controlToken,
              desktopShell,
              {},
              operations,
            );
        });
        if (renderedGoalsPage) {
          if ("error" in renderedGoalsPage) {
            sendJson(response, renderedGoalsPage.status, { error: renderedGoalsPage.error });
            return;
          }
          const headers: Record<string, string> = {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": PAGE_CSP,
          };
          response.writeHead(200, headers);
          response.end(renderedGoalsPage.html);
          return;
        }
        sendJson(response, 404, { error: L("页面或接口不存在") });
      }
      });
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const modulePath = fileURLToPath(import.meta.url);
const requestedModulePath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMain = requestedModulePath != null && (() => {
  try {
    return fs.realpathSync(modulePath) === fs.realpathSync(requestedModulePath);
  } catch {
    return modulePath === requestedModulePath;
  }
})();
if (isMain) {
  const args = process.argv.slice(2);
  const homeArgument = flag(args, "--home");
  const port = Number(flag(args, "--port") ?? 4173);
  const unsupported = ["--db", "--board-id", "--demo"].find((argument) => args.includes(argument));
  if (unsupported) {
    console.error(`GoalBoard Web 只按项目启动；${unsupported} 已不支持。请先在当前 Runtime 使用 GoalBoard Skill 创建、连接或迁移项目。`);
    process.exitCode = 1;
  } else {
    const server = createGoalBoardWebServer({
      ...(homeArgument ? { homeDirectory: path.resolve(homeArgument) } : {}),
    });
    const shutdown = () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000).unref();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    server.listen(port, "127.0.0.1", () => {
      console.log(`GoalBoard Web: http://127.0.0.1:${port}`);
      console.log("项目列表（网页不会修改 Runtime Session 绑定）");
    });
  }
}
import { openWorkSessionRegistry } from "@adeptify/goalboard-app-local-host";
