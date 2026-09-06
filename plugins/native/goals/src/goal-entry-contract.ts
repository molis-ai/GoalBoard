import type { GoalFactsView, ImpactBindingRecord, ProjectGuidanceView, GoalsActorWrite, GoalsBoardRecord, GoalContractRevisionRecord, CoverageContractRevisionRecord, PlanningMethodPack, ProjectGuidanceEntryRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionClaimRecord, ExecutionRunRecord } from "@adeptify/goalboard-contracts/modules/execution";
import type { EvidenceRecord, EvidenceCorrectionRecord } from "@adeptify/goalboard-contracts/modules/evidence-verification";
import type { ReviewObligationRecord, ReviewRecord, CandidateGoalRecord, ContractProposalRecord, RewireRecord, ClarificationSessionRecord, ClarificationTurnRecord, GoalTreeProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { HostCapabilityDefinition } from "@adeptify/goalboard-contracts/platform/app-host";
import type { GoalWorkStateView, GoalActionProjection, ExecutionValidationSnapshot } from "./execution-validation-contract.js";

/** Existing full project snapshot; every record is defined by its fact owner. */
export interface BoardSnapshot extends ExecutionValidationSnapshot {
  board: GoalsBoardRecord;
  impacts: ImpactBindingRecord[];
  evidence_corrections: EvidenceCorrectionRecord[];
  goal_contract_revisions: GoalContractRevisionRecord[];
  coverage_contract_revisions: CoverageContractRevisionRecord[];
  clarification_sessions: ClarificationSessionRecord[];
  clarification_turns: ClarificationTurnRecord[];
  planning_method_packs: PlanningMethodPack[];
  project_guidance: ProjectGuidanceEntryRecord[];
}

/** Public entry contract: Goal facts enriched by the existing execution and governance owners. */
export interface GoalContractView extends GoalFactsView {
  work_state: GoalWorkStateView;
  action_projection: GoalActionProjection;
  impacts: ImpactBindingRecord[];
  claims: ExecutionClaimRecord[];
  runs: ExecutionRunRecord[];
  evidence: EvidenceRecord[];
  evidence_corrections: EvidenceCorrectionRecord[];
  review_obligations: ReviewObligationRecord[];
  reviews: ReviewRecord[];
  candidates: CandidateGoalRecord[];
  contract_proposals: ContractProposalRecord[];
  rewires: RewireRecord[];
  clarification_sessions: ClarificationSessionRecord[];
  clarification_turns: ClarificationTurnRecord[];
  goal_tree_proposals: GoalTreeProposalRecord[];
}

export const readGoalContractCapability = {
  capability_id: "io.goalboard.local-host.goals.contract",
  version: 1,
  operation: "query",
} as HostCapabilityDefinition<{ board_id: string; goal_id: string }, GoalContractView>;

export const readProjectGuidanceCapability = {
  capability_id: "io.goalboard.local-host.project.guidance",
  version: 1,
  operation: "query",
} as HostCapabilityDefinition<{ board_id: string }, ProjectGuidanceView>;

export const setActiveGoalCapability = {
  capability_id: "io.goalboard.local-host.goals.set-active",
  version: 1,
  operation: "command",
} as HostCapabilityDefinition<{
  board_id: string;
  goal: { goal_id: string; reason: string };
  write: GoalsActorWrite;
}, { active_goal_id: string; replayed: boolean; observed_event_cursor: number }>;
