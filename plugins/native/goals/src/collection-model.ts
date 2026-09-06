/** UI-only collection selection and labels; counts are supplied by the authoritative query. */
export interface GoalCollectionItem {
  goal: { goal_id: string; title: string };
}
export interface GoalCollectionView<T extends GoalCollectionItem> {
  goals: T[];
  archived_goals: T[];
  trashed_goals: T[];
  active_goal_id: string | null;
  counts: {
    clarifying: number; executing: number; reviewing: number; revalidating: number;
    clarification_blocked: number; execution_blocked: number; completion_blocked: number;
    review_blocked: number; revalidation_blocked: number; invalidated: number;
  };
}
type Translate = (text: string, values?: Record<string, string | number>) => string;

export function buildGoalCollectionModel<T extends GoalCollectionItem>(
  view: GoalCollectionView<T>, requestedGoalId: string | undefined,
  archiveView: boolean, trashView: boolean, decisionView: boolean, L: Translate,
) {
  const visibleGoals = trashView ? view.trashed_goals : archiveView ? view.archived_goals : view.goals;
  const collectionView = archiveView || trashView;
  const collectionTitle = trashView ? L("回收站") : archiveView ? L("已归档") : L("Goal Tree");
  const collectionSuffix = trashView ? L("回收站") : archiveView ? L("归档") : "";
  const selected = decisionView ? undefined :
    visibleGoals.find(item => item.goal.goal_id === requestedGoalId) ??
    (collectionView ? undefined : visibleGoals.find(item => item.goal.goal_id === view.active_goal_id)) ??
    visibleGoals[0];
  const selectedId = selected?.goal.goal_id ?? "";
  const title = decisionView ? L("等待你的决定 · GoalBoard") :
    selected ? selected.goal.title + " · GoalBoard" :
    trashView ? L("回收站 · GoalBoard") : archiveView ? L("已归档 Goal · GoalBoard") : "GoalBoard";
  const phaseSummary = [
    { label: L("澄清中"), count: view.counts.clarifying },
    { label: L("执行中"), count: view.counts.executing },
    { label: L("复核中"), count: view.counts.reviewing },
    { label: L("重新验证中"), count: view.counts.revalidating },
  ].filter(item => item.count > 0).map(item => `${item.label} ${item.count}`).join(" · ");
  const blockedCount = view.counts.clarification_blocked + view.counts.execution_blocked +
    view.counts.completion_blocked + view.counts.review_blocked + view.counts.revalidation_blocked + view.counts.invalidated;
  const footerStatus = [phaseSummary, blockedCount > 0 ? L("受阻 {count}", { count: blockedCount }) : ""]
    .filter(Boolean).join(" · ") || L("当前没有进行中的 Goal");
  const collectionNote = trashView ? L("可恢复；历史与关联处理记录会保留") : archiveView ? L("可随时恢复") : footerStatus;
  const searchPlaceholder = trashView ? L("在回收站内搜索") : archiveView ? L("在已归档 Goal 中搜索") : L("在当前 Goal Tree 内搜索");
  const searchLabel = trashView ? L("搜索回收站") : archiveView ? L("搜索已归档 Goal") : L("搜索 Goal");
  return { visibleGoals, selected, selectedId, title, collectionView, collectionTitle, collectionSuffix,
    collectionNote, searchPlaceholder, searchLabel, archiveView, trashView };
}

export type GoalCollectionModel<T extends GoalCollectionItem = GoalCollectionItem> = ReturnType<typeof buildGoalCollectionModel<T>>;
