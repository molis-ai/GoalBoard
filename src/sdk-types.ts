/** Public root SDK aliases. Authoritative definitions belong to the named owner. */
export type DefinitionState = import("@adeptify/goalboard-contracts/modules/goals").GoalDefinitionState;
export type DecompositionState = import("@adeptify/goalboard-contracts/modules/goals").GoalDecompositionState;
export type ValidityState = import("@adeptify/goalboard-contracts/modules/goals").GoalValidityState;
export type FulfillmentState = import("@adeptify/goalboard-contracts/modules/goals").GoalFulfillmentState;
export type ClaimRole = import("@adeptify/goalboard-contracts/modules/execution").ExecutionClaimRole;
export type GoalWorkAction = import("@adeptify/goalboard-plugin-goals").GoalWorkAction;
export type GoalWorkState = import("@adeptify/goalboard-plugin-goals").GoalWorkState;
export type ClaimState = import("@adeptify/goalboard-contracts/modules/execution").ExecutionClaimState;
export type GoalActionActor = import("@adeptify/goalboard-plugin-goals").GoalActionActor;
export type GoalActionKind = import("@adeptify/goalboard-plugin-goals").GoalActionKind;
export type GoalActionStatus = import("@adeptify/goalboard-plugin-goals").GoalActionStatus;
export type GoalActionProgress = import("@adeptify/goalboard-plugin-goals").GoalActionProgress;
export type GoalDisplayStatus = import("@adeptify/goalboard-plugin-goals").GoalDisplayStatus;
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

export type GoalAction = import("@adeptify/goalboard-plugin-goals").GoalAction;

export type GoalActionProjection = import("@adeptify/goalboard-plugin-goals").GoalActionProjection;

export type CompactGoalActionProjection = import("@adeptify/goalboard-plugin-goals").CompactGoalActionProjection;

export type ActionTransitionReceipt = import("@adeptify/goalboard-plugin-goals").ActionTransitionReceipt;

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
export type GoalWorkStateView = import("@adeptify/goalboard-plugin-goals").GoalWorkStateView;

export type AvailableGoal = import("@adeptify/goalboard-plugin-goals").AvailableGoal;
export type BlockedAvailableGoal = import("@adeptify/goalboard-plugin-goals").BlockedAvailableGoal;
export type BlockedAvailableOverview = import("@adeptify/goalboard-plugin-goals").BlockedAvailableOverview;
export type ParallelRuntimeAssignment = import("@adeptify/goalboard-plugin-goals").ParallelRuntimeAssignment;
export type ParallelExecutionSuggestion = import("@adeptify/goalboard-plugin-goals").ParallelExecutionSuggestion;

export type BoardSnapshot = import("@adeptify/goalboard-plugin-goals").BoardSnapshot;

export type GoalContractView = import("@adeptify/goalboard-plugin-goals").GoalContractView;

export type CreateGoalInput = import("@adeptify/goalboard-contracts/modules/goals").CreateGoalInput;
export type ClaimRequest = import("@adeptify/goalboard-plugin-goals").ClaimRequest;

export type ClaimRenewRequest = import("@adeptify/goalboard-plugin-goals").ClaimRenewRequest;

export type ClaimRenewResult = import("@adeptify/goalboard-plugin-goals").ClaimRenewResult;

export type ClaimDecision = import("@adeptify/goalboard-plugin-goals").ClaimDecision;

export type ClaimRunDecision = import("@adeptify/goalboard-plugin-goals").ClaimRunDecision;

export type DraftDialogueStartInput = import("@adeptify/goalboard-plugin-goals").DraftDialogueStartInput;

export type DraftDialogueTurnInput = import("@adeptify/goalboard-plugin-goals").DraftDialogueTurnInput;

export type DraftDialogueResumeInput = import("@adeptify/goalboard-plugin-goals").DraftDialogueResumeInput;

export type DraftDialogueView = import("@adeptify/goalboard-plugin-goals").DraftDialogueView;

export type RevalidationDecision = import("@adeptify/goalboard-contracts/modules/goals").GoalRevalidationDecision<ActionTransitionReceipt>;

export { DEFAULT_GOAL_POLICY } from "@adeptify/goalboard-module-goals";
