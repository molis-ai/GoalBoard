import type { CreateGoalInput, GoalPolicy, GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ContractFieldSource, ContractProposalImpact, ContractProposalRisk, ContractProposalRecord, CandidateGoalRecord, RewireRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";

export interface SubmitContractProposalInput {
  board_id: string;
  goal_id: string;
  actor_id: string;
  discovered_in_run_id: string;
  proposed_goal: CreateGoalInput;
  field_sources: ContractFieldSource[];
  review_policy: GoalPolicy;
  proposed_impacts?: ContractProposalImpact[];
  proposed_risks?: ContractProposalRisk[];
  dependency_rewire_ids?: string[];
  idempotency_key: string;
}

export interface DecideContractProposalInput {
  board_id: string;
  proposal_id: string;
  actor_id: string;
  actor_kind: "user" | "runtime";
  decision: "approved" | "rejected";
  reason: string;
  idempotency_key: string;
}

/** Existing compatibility workflows; validation and decisions remain with their owners. */
export interface LegacyProposalApplicationApi {
  submitContractProposal(input: SubmitContractProposalInput): { proposal: ContractProposalRecord; replayed: boolean; observed_event_cursor: number };
  decideContractProposal(input: DecideContractProposalInput): { proposal: ContractProposalRecord; goal: GoalRecord; replayed: boolean; observed_event_cursor: number };
  submitCandidate(input: {
    board_id: string;
    actor_id: string;
    discovered_in_run_id?: string | null;
    proposed_goal: CreateGoalInput;
    proposed_relations?: Array<Record<string, unknown>>;
    proposed_impacts?: Array<Record<string, unknown>>;
    proposed_risks?: Array<Record<string, unknown>>;
    blocking_mode?: CandidateGoalRecord["blocking_mode"];
    idempotency_key: string;
  }): { candidate: CandidateGoalRecord; replayed: boolean; observed_event_cursor: number };
  submitDependencyProposal(input: {
    board_id: string;
    actor_id: string;
    discovered_in_run_id: string;
    dependencies: Array<Record<string, unknown>>;
    blocking_mode?: "none" | "current_run";
    idempotency_key: string;
  }): { rewire: RewireRecord; replayed: boolean; observed_event_cursor: number };
  decideCandidate(input: {
    board_id: string;
    candidate_id: string;
    actor_id: string;
    actor_kind: "user" | "runtime";
    decision: "approved" | "rejected" | "dismissed";
    reason: string;
    idempotency_key: string;
  }): { candidate: CandidateGoalRecord; replayed: boolean; observed_event_cursor: number };
  confirmRewire(input: {
    board_id: string;
    rewire_id: string;
    actor_id: string;
    actor_kind: "user" | "runtime";
    decision?: "confirmed" | "rejected";
    reason: string;
    idempotency_key: string;
  }): { rewire: RewireRecord; replayed: boolean; observed_event_cursor: number };
}
