export type DefinitionState = import("@adeptify/goalboard-contracts/modules/goals").GoalDefinitionState;
export type DecompositionState = import("@adeptify/goalboard-contracts/modules/goals").GoalDecompositionState;
export type ValidityState = import("@adeptify/goalboard-contracts/modules/goals").GoalValidityState;
export type FulfillmentState = import("@adeptify/goalboard-contracts/modules/goals").GoalFulfillmentState;
export type ClaimRole = import("@adeptify/goalboard-contracts/modules/execution").ExecutionClaimRole;
export type GoalWorkAction = "clarify" | "execute" | "review" | "revalidate" | "complete";
export type GoalWorkState =
  | "clarification_pending"
  | "clarifying"
  | "clarification_blocked"
  | "waiting_children"
  | "execution_pending"
  | "executing"
  | "execution_blocked"
  | "completion_pending"
  | "completion_blocked"
  | "review_pending"
  | "reviewing"
  | "review_blocked"
  | "waiting_for_human"
  | "revalidation_pending"
  | "revalidating"
  | "revalidation_blocked"
  | "replaced"
  | "invalidated"
  | "satisfied"
  | "trashed"
  | "archived";
export type ClaimState = import("@adeptify/goalboard-contracts/modules/execution").ExecutionClaimState;
export type GoalActionActor = "runtime" | "user";
export type GoalActionKind =
  | "clarify"
  | "execute"
  | "submit_evidence"
  | "revise"
  | "review"
  | "revalidate"
  | "mitigate_risk"
  | "accept_risk"
  | "release"
  | "renew"
  | "repair"
  | "wait";
export type GoalActionStatus = "ready" | "active" | "blocked";
export type GoalActionProgress = "not_started" | "in_progress" | "work_recorded" | "verified";
export type GoalDisplayStatus = "continue" | "in_progress" | "waiting_user" | "waiting" | "blocked" | "completed";
export type ImpactAccess = import("@adeptify/goalboard-contracts/modules/goals").ImpactAccess;
export type RiskBlockingMode = import("@adeptify/goalboard-contracts/modules/goals").RiskBlockingMode;
export type GoalMode = import("@adeptify/goalboard-contracts/modules/goals").GoalPolicy["goal_mode"];
export type ProjectGuidanceKind = import("@adeptify/goalboard-contracts/modules/goals").ProjectGuidanceKind;
export type ProjectGuidanceEntryRecord = import("@adeptify/goalboard-contracts/modules/goals").ProjectGuidanceEntryRecord;
export type ProjectGuidanceChangeKind = import("@adeptify/goalboard-contracts/modules/goals").ProjectGuidanceRevisionRecord["change_kind"];
export type ProjectGuidanceRevisionRecord = import("@adeptify/goalboard-contracts/modules/goals").ProjectGuidanceRevisionRecord;
export type ProjectGuidanceView = import("@adeptify/goalboard-contracts/modules/goals").ProjectGuidanceView;
export type AddProjectGuidanceInput = import("@adeptify/goalboard-contracts/modules/goals").AddProjectGuidanceInput;
export type AddProjectGuidanceResult = import("@adeptify/goalboard-contracts/modules/goals").AddProjectGuidanceResult;
export type UpdateProjectGuidanceInput = import("@adeptify/goalboard-contracts/modules/goals").UpdateProjectGuidanceInput;
export type UpdateProjectGuidanceResult = import("@adeptify/goalboard-contracts/modules/goals").UpdateProjectGuidanceResult;
export type AcceptanceCriterion = import("@adeptify/goalboard-contracts/modules/goals").GoalAcceptanceCriterion;
export type GoalRecord = import("@adeptify/goalboard-contracts/modules/goals").GoalRecord;
export type GoalRelationRecord = import("@adeptify/goalboard-contracts/modules/goals").GoalRelationRecord;
export type GoalTrashStatus = import("@adeptify/goalboard-contracts/modules/goals").GoalTrashStatus;
export type GoalTrashResult = import("@adeptify/goalboard-contracts/modules/goals").GoalTrashResult;

export type ImpactBindingRecord = import("@adeptify/goalboard-contracts/modules/goals").ImpactBindingRecord;

export type RiskRecord = import("@adeptify/goalboard-contracts/modules/goals").RiskRecord;
export type GoalPolicy = import("@adeptify/goalboard-contracts/modules/goals").GoalPolicy;
export type TaskContext = import("@adeptify/goalboard-contracts/modules/goals").GoalTaskContext;
export type LegacyProductContext = import("@adeptify/goalboard-contracts/modules/goals").GoalLegacyProductContext;
export type DecompositionReview = import("@adeptify/goalboard-contracts/modules/goals").GoalDecompositionReview;
export type LeafReadiness = import("@adeptify/goalboard-contracts/modules/goals").GoalLeafReadiness;
export type ClaimRecord = import("@adeptify/goalboard-contracts/modules/execution").ExecutionClaimRecord;
export type RunRecord = import("@adeptify/goalboard-contracts/modules/execution").ExecutionRunRecord;

export type EvidenceRecord =
  import("@adeptify/goalboard-contracts/modules/evidence-verification").EvidenceRecord;
export type EvidenceCorrectionRecord =
  import("@adeptify/goalboard-contracts/modules/evidence-verification").EvidenceCorrectionRecord;

export type ReviewObligationRecord =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ReviewObligationRecord;
export type ReviewRecord =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ReviewRecord;

export type ContractRevisionEffect = import("@adeptify/goalboard-contracts/modules/goals").GoalContractRevisionEffect;

export type GoalContractRevisionRecord = import("@adeptify/goalboard-contracts/modules/goals").GoalContractRevisionRecord;

export type GoalRiskLinkRecord = import("@adeptify/goalboard-contracts/modules/goals").GoalRiskLinkRecord;

export type CoverageContractRevisionRecord = import("@adeptify/goalboard-contracts/modules/goals").CoverageContractRevisionRecord;

export type GoalLifecycleEventRecord = import("@adeptify/goalboard-plugin-goals").BoardSnapshot["lifecycle_events"][number];

export interface GoalAction {
  action_id: string;
  actor: GoalActionActor;
  kind: GoalActionKind;
  status: GoalActionStatus;
  target_type: string;
  target_id: string;
  reasons: DecisionReason[];
}

export interface GoalActionProjection {
  goal_id: string;
  contract_revision: number;
  progress: GoalActionProgress;
  primary_action: GoalAction | null;
  actions: GoalAction[];
  action_token: string;
  display_status: GoalDisplayStatus;
}

export interface CompactGoalActionProjection {
  goal_id: string;
  contract_revision: number;
  progress: GoalActionProgress;
  primary_action: GoalAction | null;
  action_token: string;
  display_status: GoalDisplayStatus;
}

export interface ActionTransitionReceipt {
  goal_id: string;
  previous_action_token: string;
  projection: GoalActionProjection;
  affected_goals: CompactGoalActionProjection[];
  summary: string;
  observed_event_cursor: number;
}

export type DependencyProposalBasis =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").DependencyProposalBasis;
export type DependencyProposal =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").DependencyProposal;

export type ContractFieldName =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ContractFieldName;
export type ContractFieldSource =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ContractFieldSource;
export type ContractProposalImpact =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ContractProposalImpact;
export type ContractProposalRisk =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ContractProposalRisk;
export type ContractProposalRecord =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ContractProposalRecord;

/**
 * Dialogue facts live beside, rather than inside, the canonical Goal
 * Contract. They let the current Runtime resume a Draft conversation without
 * treating an inference or an unapproved structure as settled Goal truth.
 */
export type ClarificationSessionState = import("@adeptify/goalboard-contracts/modules/governance-collaboration").ClarificationSessionState;

export type ClarificationFact = import("@adeptify/goalboard-contracts/modules/governance-collaboration").ClarificationFact;

export type ClarificationAssumption = import("@adeptify/goalboard-contracts/modules/governance-collaboration").ClarificationAssumption;

export type ClarificationSessionRecord = import("@adeptify/goalboard-contracts/modules/governance-collaboration").ClarificationSessionRecord;

export type ClarificationTurnRecord = import("@adeptify/goalboard-contracts/modules/governance-collaboration").ClarificationTurnRecord;

/**
 * A proposed Goal Tree is deliberately separate from canonical Goals. It can
 * describe a whole family of changes while the user is still deciding what
 * should become real.
 */
export type GoalTreeProposalOrigin =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalOrigin;
export type GoalTreeProposalState =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalState;
export type GoalTreeProposalItemKind =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalItemKind;
export type GoalTreeProposalOperation =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalOperation;
export type GoalTreeProposalItemState =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalItemState;
export type GoalTreeProposalDecisionAction =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalDecisionAction;
export type GoalTreeProposalDecisionState =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalDecisionState;
export type ProposalAffectedObjectType =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ProposalAffectedObjectType;
export type ProposalAffectedObject =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ProposalAffectedObject;
export type ProposalObjectVersion =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").ProposalObjectVersion;

/**
 * The user decision audit is recorded separately from the Runtime that
 * carried it over MCP. A local Runtime can attest that the user explicitly
 * confirmed in the current dialogue; this is auditable provenance, not a
 * cryptographic trust boundary.
 */
export type GoalTreeProposalDecisionAuthority =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalDecisionAuthority;
export type GoalTreeProposalDecisionRecord =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalDecisionRecord;
export type GoalTreeProposalNarrative =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalNarrative;
export type GoalTreeProposalItemExplanation =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalItemExplanation;

export type GoalTreeProposalItemRecord =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalItemRecord;
export type GoalTreeProposalRecord =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalRecord;

export type GoalTreeProposalItemInput =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalItemInput;
export type GoalTreeProposalSubmitInput =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalSubmitInput;
export type GoalTreeProposalCheckInput =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalCheckInput;
export type GoalTreeProposalItemDecisionInput =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalItemDecisionInput;
export type GoalTreeProposalDecideInput =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").GoalTreeProposalDecideInput;

export type CandidateGoalRecord =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").CandidateGoalRecord;
export type RewireRecord =
  import("@adeptify/goalboard-contracts/modules/governance-collaboration").RewireRecord;

export type DecisionReason = import("@adeptify/goalboard-contracts/modules/goals").GoalLifecycleReason;

export type ReadyGoal = import("@adeptify/goalboard-plugin-goals").ReadyGoal;

/**
 * The one user-facing work state for a Goal. It is derived from canonical
 * Goal, relation, Claim, Run and Review facts; it is never a second mutable
 * status field.
 */
export interface GoalWorkStateView {
  goal_id: string;
  work_state: GoalWorkState;
  next_action: GoalWorkAction | null;
  active_claim: ClaimRecord | null;
  active_claim_lease: {
    remaining_seconds: number;
    renewal_window_seconds: number;
    renew_recommended: boolean;
    next_action: "renew_claim" | null;
  } | null;
  active_run: RunRecord | null;
  pending_review_roles: Array<"self_verifier" | "cross_reviewer" | "adversarial_reviewer" | "human_approver">;
  child_goal_ids: string[];
  reasons: DecisionReason[];
}

export type AvailableGoal = import("@adeptify/goalboard-plugin-goals").AvailableGoal;
export type BlockedAvailableGoal = import("@adeptify/goalboard-plugin-goals").BlockedAvailableGoal;
export type BlockedAvailableOverview = import("@adeptify/goalboard-plugin-goals").BlockedAvailableOverview;
export type ParallelRuntimeAssignment = import("@adeptify/goalboard-plugin-goals").ParallelRuntimeAssignment;
export type ParallelExecutionSuggestion = import("@adeptify/goalboard-plugin-goals").ParallelExecutionSuggestion;

export type BoardSnapshot = import("@adeptify/goalboard-plugin-goals").BoardSnapshot;

export type GoalContractView = import("@adeptify/goalboard-plugin-goals").GoalContractView;

export type CreateGoalInput = import("@adeptify/goalboard-contracts/modules/goals").CreateGoalInput;
export interface ClaimRequest {
  board_id: string;
  goal_id: string;
  action_id?: string;
  action_token?: string;
  actor_id: string;
  role?: ClaimRole;
  capabilities?: string[];
  goal_mode_attestation?: boolean;
  lease_seconds?: number;
  strengthen_policy?: Partial<GoalPolicy>;
  idempotency_key: string;
}

export interface ClaimRenewRequest {
  board_id: string;
  claim_id: string;
  actor_id: string;
  lease_seconds?: number;
  idempotency_key: string;
}

export interface ClaimRenewResult {
  claim: ClaimRecord;
  replayed: boolean;
  observed_event_cursor: number;
  transition: ActionTransitionReceipt;
}

export interface ClaimDecision {
  allowed: boolean;
  observed_event_cursor: number;
  reasons: DecisionReason[];
  claim: ClaimRecord | null;
  replayed: boolean;
}

export interface ClaimRunDecision {
  allowed: boolean;
  observed_event_cursor: number;
  reasons: DecisionReason[];
  claim: ClaimRecord | null;
  run: RunRecord | null;
  work_state: GoalWorkStateView | null;
  projection?: GoalActionProjection | null;
  transition?: ActionTransitionReceipt | null;
  replayed: boolean;
}

export type DraftDialogueStartInput = import("@adeptify/goalboard-plugin-goals").DraftDialogueStartInput;

export type DraftDialogueTurnInput = import("@adeptify/goalboard-plugin-goals").DraftDialogueTurnInput;

export type DraftDialogueResumeInput = import("@adeptify/goalboard-plugin-goals").DraftDialogueResumeInput;

export type DraftDialogueView = import("@adeptify/goalboard-plugin-goals").DraftDialogueView;

export type RevalidationDecision = import("@adeptify/goalboard-contracts/modules/goals").GoalRevalidationDecision<ActionTransitionReceipt>;

export const DEFAULT_GOAL_POLICY: GoalPolicy = {
  goal_mode: "preferred",
  required_capabilities: [],
  self_verification: true,
  cross_reviewers: 0,
  adversarial_reviewers: 0,
  human_approval: false,
  max_lease_seconds: 1800,
};
