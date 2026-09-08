import type { GoalLifecycleReason as DecisionReason, GoalInputBindingRecord, GoalRecord, ImpactBindingRecord, GoalRelationRecord, GoalPolicy } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionClaimRecord as ClaimRecord, ExecutionRunRecord as RunRecord } from "@adeptify/goalboard-contracts/modules/execution";
import type { EvidenceRecord } from "@adeptify/goalboard-contracts/modules/evidence-verification";
import type { ReviewObligationRecord, ReviewRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalActionProjection, GoalDisplayStatus, GoalWorkState, GoalWorkStateView } from "./execution-validation-contract.js";
import type { GoalPresentationState } from "./tree-order.js";
import type { GoalsPolicyBinding } from "./policy-ui-model.js";
import type { GoalsSafetyRisk } from "./safety-ui-model.js";
import type { GoalsDecisionEvent } from "./decision-view.js";

/** Read-only Goal presentation; facts and work states remain defined by their owners. */
export const GOALS_PRESENTATION_STATES: readonly GoalPresentationState[] = [
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

export interface GoalsCoverageItem {
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

export type GoalsInputBinding = Omit<GoalInputBindingRecord, "board_id">;

export interface GoalsDocumentView {
  goal: GoalRecord;
  status: GoalPresentationState;
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
  risks: GoalsSafetyRisk[];
  impacts: ImpactBindingRecord[];
  relations: GoalRelationRecord[];
  coverage: GoalsCoverageItem[];
  input_bindings: GoalsInputBinding[];
  policy_bindings: GoalsPolicyBinding[];
  events: GoalsDecisionEvent[];
  resolved_policy: GoalPolicy;
  passed_criteria: string[];
  pending_reviews: string[];
}
