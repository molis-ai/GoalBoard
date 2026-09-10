export type GoalDocumentCollection = "current" | "archive" | "trash";
type ParametersReader = { get(name: string): string | null };
export type GoalsReadRoute =
  | { kind: "refresh"; collection: GoalDocumentCollection; goal_id?: string }
  | { kind: "momentum"; collection: "current" | "archive"; goal_id: string }
  | { kind: "document"; collection: GoalDocumentCollection; goal_id: string };
export interface GoalsRouteError { status: 400 | 404; error: string }

/** Parse only the existing GET presentation routes, after the host strips Project scope. */
export function resolveGoalsReadRoute(pathname: string, params: ParametersReader): { route: GoalsReadRoute } | GoalsRouteError | null {
  const refresh = pathname === "/api/board/refresh";
  const momentum = pathname === "/api/board/momentum";
  const document = pathname.match(/^\/api\/goals\/([^/]+)\/document$/);
  if (!refresh && !momentum && !document) return null;
  let goalId = "";
  if (document) {
    try { goalId = decodeURIComponent(document[1]!); }
    catch { return { status: 404, error: "Goal 内容不存在" }; }
  }
  const collection = params.get("view") ?? "current";
  if (momentum) {
    if (collection !== "current" && collection !== "archive") return { status: 400, error: "Goal 推进态势集合无效" };
    return { route: { kind: "momentum", collection, goal_id: params.get("goal_id")?.trim() || "" } };
  }
  if (collection !== "current" && collection !== "archive" && collection !== "trash") return { status: 400, error: "Goal 正文集合无效" };
  if (refresh) return { route: { kind: "refresh", collection, goal_id: params.get("goal_id")?.trim() || undefined } };
  return { route: { kind: "document", collection, goal_id: goalId } };
}

export function goalsReadRouteNotFound(route: GoalsReadRoute): string {
  switch (route.kind) {
    case "momentum": return "Goal 推进态势不存在";
    default: return `找不到这个 Goal: ${route.goal_id}`;
  }
}

export interface GoalsPageRoute { collection: GoalDocumentCollection; goal_id?: string }
export interface GoalsPageCollections<TItem extends { goal: { goal_id: string } } = { goal: { goal_id: string } }> {
  goals: readonly TItem[];
  archived_goals: readonly TItem[];
  trashed_goals: readonly TItem[];
}

export interface GoalsFragmentItem {
  goal: { goal_id: string; archived_at: string | null; trashed_at: string | null };
}
export function goalsReadCollection<TItem extends { goal: { goal_id: string } }>(
  view: GoalsPageCollections<TItem>, collection: GoalDocumentCollection,
): readonly TItem[] {
  return collection === "trash" ? view.trashed_goals : collection === "archive" ? view.archived_goals : view.goals;
}
export function findGoalsFragmentItem<TItem extends GoalsFragmentItem>(
  view: GoalsPageCollections<TItem>, goalId: string, collection: GoalDocumentCollection,
): TItem | null {
  const item = goalsReadCollection(view, collection).find(candidate => candidate.goal.goal_id === goalId);
  return item ?? null;
}

/** Keep a direct Goal URL readable after archive/trash; this is presentation selection, not authority. */
export function resolveGoalsPageCollection(route: GoalsPageRoute, view: GoalsPageCollections): { route: GoalsPageRoute } | GoalsRouteError {
  const goalId = route.goal_id;
  const requestedArchived = goalId ? view.archived_goals.some(item => item.goal.goal_id === goalId) : false;
  const requestedTrashed = goalId ? view.trashed_goals.some(item => item.goal.goal_id === goalId) : false;
  const trashView = route.collection === "trash" || requestedTrashed;
  const archiveView = !trashView && (route.collection === "archive" || requestedArchived);
  const collection = trashView ? view.trashed_goals : archiveView ? view.archived_goals : view.goals;
  if (goalId && !collection.some(item => item.goal.goal_id === goalId)) {
    return { status: 404, error: `找不到这个 Goal: ${goalId}` };
  }
  return { route: { ...route, collection: trashView ? "trash" : archiveView ? "archive" : "current" } };
}

export function resolveGoalsPageRoute(pathname: string): { route: GoalsPageRoute } | GoalsRouteError | null {
  if (pathname === "/") return { route: { collection: "current" } };
  if (pathname === "/archive" || pathname === "/trash") return { route: { collection: pathname.slice(1) as "archive" | "trash" } };
  const match = pathname.match(/^\/(?:(archive|trash)\/)?goals\/([^/]+)$/);
  if (!match) return null;
  try { return { route: { collection: (match[1] ?? "current") as GoalDocumentCollection, goal_id: decodeURIComponent(match[2]!) } }; }
  catch { return { status: 404, error: "Goal 页面不存在" }; }
}
