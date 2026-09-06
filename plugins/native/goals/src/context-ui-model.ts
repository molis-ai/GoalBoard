import type { GoalRecord, GoalInputBindingRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsTreeItem, GoalsTreeView } from "./tree-ui-model.js";

export interface GoalsDraftItem {
  goal: Pick<GoalRecord, "goal_id" | "title" | "outcome" | "why" | "business_logic" | "priority" | "definition_state" | "decomposition_state" | "in_scope" | "out_of_scope" | "constraints" | "required_inputs" | "promised_outputs" | "acceptance_criteria">;
  status: GoalsTreeItem["status"];
}
export interface GoalsContextItem extends GoalsTreeItem {
  goal: GoalsTreeItem["goal"] & GoalsDraftItem["goal"] & Pick<GoalRecord, "decomposition_review">;
  input_bindings: Array<Pick<GoalInputBindingRecord, "input_name" | "source_ref" | "state" | "reason" | "snapshot_digest">>;
  coverage: Array<{ requirement_id: string; statement: string; disposition: string; blocking: boolean; reason: string | null; revisit_condition: string | null }>;
}
export type GoalsContextView = GoalsTreeView<GoalsContextItem>;
export interface GoalsRecordItem extends GoalsContextItem {
  goal: GoalsContextItem["goal"] & Pick<GoalRecord, "updated_at" | "accepted_by">;
  active_claim_actor: string | null;
  work_state: GoalsTreeItem["status"];
}
export interface GoalsRecordRelationsContent {
  /** Trusted read-only markup from Goals relation, safety and policy contributions. */
  relationsHtml: string;
  safetyHtml: string;
  policyHtml: string;
}
export interface GoalsContextSection {
  key: string;
  iconName: "book" | "clipboard" | "file";
  title: string;
  description: string;
  body: string;
  active?: boolean;
  cardId?: string;
  cardAttributes?: string;
}
export interface GoalsContextUiPrimitives {
  translate(text: string, values?: Record<string, string | number>): string;
  escapeHtml(value: unknown): string;
  formatDate(value: string | null | undefined): string;
  currentLocale(): string;
  listJoin(values: string[]): string;
  icon(name: "check" | "chevron-down" | "chevron-right" | "completed" | "x" | "plus" | "risk" | "arrow" | "impact" | "settings" | "book"): string;
  renderList(values: string[], empty: string): string;
  renderReference(value: string, label: string): string;
  subsectionHeading(iconName: "clipboard" | "link" | "check" | "folder", title: string, description?: string): string;
  renderFocusSectionDeck(cards: GoalsContextSection[], label: string, className: string): string;
  explainWorkState(state: GoalsTreeItem["status"]): { label: string; meaning: string; nextAction: string };
  explainParentCompletion(goal: Pick<GoalRecord, "definition_state" | "decomposition_state" | "decomposition_review" | "fulfillment_state">, completedChildren: number, totalChildren: number): { label: string; meaning: string; tone: "automatic" | "needs_confirmation" | "conflict" };
}
