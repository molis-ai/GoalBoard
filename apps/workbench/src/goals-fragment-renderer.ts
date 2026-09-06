import { findGoalsFragmentItem, goalsReadCollection, type GoalsFragmentItem, type GoalsPageCollections,
  type GoalDocumentCollection, type LazyGoalPanel } from "@adeptify/goalboard-plugin-goals";

interface FragmentView<TItem extends GoalsFragmentItem> extends GoalsPageCollections<TItem> {
  route_prefix: string;
}
export interface GoalsFragmentRenderers<TItem extends GoalsFragmentItem, TView extends FragmentView<TItem>> {
  document(item: TItem, view: TView): string;
  trash(item: TItem): string;
  completion(item: TItem, view: TView, artifactContext: string): string;
  progress(item: TItem): string;
  factors(item: TItem, view: TView): string;
  records(item: TItem, view: TView): string;
  recordEvents(item: TItem, offset: number): string;
  quickRecord(item: TItem, view: TView): string;
  momentum(view: TView, goalId: string, items: readonly TItem[]): string;
  prefixLinks(html: string, routePrefix: string): string;
}

/** Compose owner output; no templates, event ledger algorithm, HTTP or permission decisions. */
export function createWorkbenchGoalsFragmentRenderer<TItem extends GoalsFragmentItem, TView extends FragmentView<TItem>>(
  owners: GoalsFragmentRenderers<TItem, TView>,
) {
  const prefix = (html: string, view: TView) => owners.prefixLinks(html, view.route_prefix);
  return {
    renderGoalDocumentFragment(view: TView, goalId: string, collection: GoalDocumentCollection = "current"): string | null {
      const item = findGoalsFragmentItem<TItem>(view, goalId, collection, "document");
      if (!item) return null;
      return prefix(collection === "trash" ? owners.trash(item) : owners.document(item, view), view);
    },
    renderGoalPanelFragment(view: TView, goalId: string, panel: LazyGoalPanel,
      collection: GoalDocumentCollection = "current", artifactContext = ""): string | null {
      const item = findGoalsFragmentItem<TItem>(view, goalId, collection, "panel");
      if (!item) return null;
      const html = panel === "completion" ? owners.completion(item, view, artifactContext)
        : panel === "progress" ? owners.progress(item) : owners.factors(item, view);
      return prefix(html, view);
    },
    renderGoalRecordsFragment(view: TView, goalId: string, collection: GoalDocumentCollection = "current"): string | null {
      const item = findGoalsFragmentItem<TItem>(view, goalId, collection, "records");
      return item ? prefix(owners.records(item, view), view) : null;
    },
    renderGoalRecordEventsFragment(view: TView, goalId: string, collection: GoalDocumentCollection = "current", offset = 0): string | null {
      const item = findGoalsFragmentItem<TItem>(view, goalId, collection, "record-events");
      // The owner supplies a standalone ledger page; historically no local-link prefix is applied.
      return item ? owners.recordEvents(item, offset) : null;
    },
    renderGoalQuickRecordFragment(view: TView, goalId: string, collection: GoalDocumentCollection = "current"): string | null {
      const item = findGoalsFragmentItem<TItem>(view, goalId, collection, "quick-record");
      return item ? prefix(owners.quickRecord(item, view), view) : null;
    },
    renderGoalBoardMomentumFragment(view: TView, goalId: string, collection: GoalDocumentCollection = "current"): string | null {
      if (collection === "trash") return null;
      return prefix(owners.momentum(view, goalId, goalsReadCollection<TItem>(view, collection)), view);
    },
  };
}
