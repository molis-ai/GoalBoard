import type { GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalActionProjection } from "./execution-validation-contract.js";
import type { GoalsTreeItem } from "./tree-ui-model.js";

export interface GoalsDocumentItem extends GoalsTreeItem {
  goal: GoalsTreeItem["goal"] & Pick<GoalRecord, "outcome" | "why" | "business_logic" | "in_scope" | "definition_state" | "updated_at" | "accepted_by" | "archived_at" | "trashed_at" | "trashed_by">;
  active_claim_actor: string | null;
  action_projection: Pick<GoalActionProjection, "primary_action">;
  main_action_label: string;
  action_summary: string;
  evidence: ReadonlyArray<{ evidence_id: string }>;
  events: ReadonlyArray<{ type: string; actor_id: string; reason: string }>;
}
export interface GoalsDocumentContext {
  activeGoalId: string | null;
  decisionCount: number;
  /** Trusted markup from the existing Draft and execution owners, never user HTML. */
  draftGapsHtml: string;
  companionRuntimeHtml: string;
}
export interface GoalsDocumentUiPrimitives {
  translate(text: string, values?: Record<string, string | number>): string;
  escapeHtml(value: unknown): string;
  formatDate(value: string | null | undefined): string;
  icon(name: "archive" | "user" | "waiting" | "blocked" | "clipboard" | "terminal" | "check" | "arrow" | "target" | "refresh" | "more" | "plus" | "activity" | "link" | "history" | "x"): string;
  renderVisibleGoalStatus(item: Pick<GoalsDocumentItem, "status" | "display_status">): string;
  renderStatus(status: "trashed"): string;
  sectionHeading(iconName: "archive" | "book" | "refresh", title: string, description?: string): string;
}
