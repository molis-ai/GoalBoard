import { buildGoalsDocumentCollection } from "@adeptify/goalboard-plugin-goals";
import type { FeedApplication, FeedSnapshot } from "@adeptify/goalboard-plugin-feed";
import type { GoalBoardWebView, WebProjectNavigation } from "@adeptify/goalboard-app-workbench";
import type { LocalProjectDatabase } from "./project-database.js";
import type { GoalProjectApplication } from "./goal-project-application.js";
import { currentLocale, L } from "./web-locale.js";
import { createLocalFeedApplication } from "./feed-application.js";
import { detectRelayImport } from "./relay-import.js";
import { listFeedSourceCatalog } from "./feed-source-service.js";
import { createLocalFeedConnectorService } from "./feed-connector-service.js";

export interface WebViewOptions {
  databasePath: string; boardId: string; demo?: boolean; projectRoot?: string;
  project?: WebProjectNavigation | null; projects?: WebProjectNavigation[]; routePrefix?: string;
}

interface GoalBoardWebViewCacheEntry {
  cursor: number;
  optionsFingerprint: string;
  view: GoalBoardWebView;
}

export type GoalBoardWebViewCache = Map<string, GoalBoardWebViewCacheEntry>;

function feedDirectorySnapshot(feed: FeedApplication, boardId: string): FeedSnapshot {
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

export function buildGoalBoardWebView(store: LocalProjectDatabase, coordinator: GoalProjectApplication, options: WebViewOptions): GoalBoardWebView {
  const collection = buildGoalsDocumentCollection({
    snapshot: boardId => store.snapshot(boardId), events: boardId => store.readEventsDescending(boardId),
    goals: coordinator.goalQueries, inputs: coordinator.goalInputs, execution: coordinator.executionValidation.query,
    projectGoalLifecycle: (snapshot, goalId) => coordinator.projectGoalLifecycle(snapshot, goalId),
  }, options.boardId, L);
  return {
    snapshot: options.project
      ? { ...collection.snapshot, board: { ...collection.snapshot.board, board_id: "" } }
      : collection.snapshot,
    project: options.project ?? null, projects: options.projects ?? [],
    route_prefix: options.routePrefix ?? "", demo: Boolean(options.demo),
    active_goal_id: collection.active_goal_id, goals: collection.goals,
    archived_goals: collection.archived_goals, trashed_goals: collection.trashed_goals,
    counts: collection.counts, coverage: collection.coverage, input_bindings: collection.input_bindings,
    policy_bindings: collection.policy_bindings, events: collection.events,
    feed: feedDirectorySnapshot(createLocalFeedApplication(store.db), options.boardId),
    relay_import: detectRelayImport(), feed_source_catalog: listFeedSourceCatalog(),
    feed_connector_auth: createLocalFeedConnectorService(store.db, options.boardId).authStatus(),
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
