import type {
  CandidateGoalRecord,
  ContractProposalRecord,
  GovernanceRecordsApi,
  GoalTreeProposalDecisionResult,
  RewireRecord,
} from "@adeptify/goalboard-contracts/modules/governance-collaboration";

import { json, text, type GovernanceRow } from "./mappers.js";
import { GovernanceRepository, type GovernanceSqliteDatabase } from "./repository.js";
import { randomUUID } from "node:crypto";
import { assertGovernanceTransition } from "./state-machine.js";
import { GovernanceGoalTreeRecords } from "./goal-tree-records.js";
import { GovernanceProposalOperationStore } from "./proposal-operation-store.js";
import { GovernanceError, type GovernanceErrorFactory } from "./errors.js";

export class GovernanceRecordStore implements GovernanceRecordsApi {
  private readonly proposalOperations: GovernanceProposalOperationStore;
  private readonly goalTrees: GovernanceGoalTreeRecords;
  constructor(private readonly db: GovernanceSqliteDatabase, errorFactory: GovernanceErrorFactory = (code, message, details) => new GovernanceError(code, message, details)) {
    this.goalTrees = new GovernanceGoalTreeRecords(db, errorFactory);
    this.proposalOperations = new GovernanceProposalOperationStore(db, errorFactory);
  }

  executeGoalTreeSubmission(...args: Parameters<GovernanceRecordsApi["executeGoalTreeSubmission"]>) {
    return this.proposalOperations.executeSubmission(...args);
  }

  executeContractProposalSubmission(...args: Parameters<GovernanceRecordsApi["executeContractProposalSubmission"]>) {
    return this.proposalOperations.executeContractProposalSubmission(...args);
  }

  executeCandidateSubmission(...args: Parameters<GovernanceRecordsApi["executeCandidateSubmission"]>) {
    return this.proposalOperations.executeCandidateSubmission(...args);
  }

  executeDependencyProposalSubmission(...args: Parameters<GovernanceRecordsApi["executeDependencyProposalSubmission"]>) {
    return this.proposalOperations.executeDependencyProposalSubmission(...args);
  }

  recordContractProposalSubmission(input: Parameters<GovernanceRecordsApi["recordContractProposalSubmission"]>[0]): number {
    return this.proposalOperations.recordContractProposalSubmission(input);
  }

  recordCandidateSubmission(input: Parameters<GovernanceRecordsApi["recordCandidateSubmission"]>[0]): number {
    return this.proposalOperations.recordCandidateSubmission(input);
  }

  recordDependencyProposalSubmission(input: Parameters<GovernanceRecordsApi["recordDependencyProposalSubmission"]>[0]): number {
    return this.proposalOperations.recordDependencyProposalSubmission(input);
  }

  executeContractProposalDecision(...args: Parameters<GovernanceRecordsApi["executeContractProposalDecision"]>) {
    return this.proposalOperations.executeContractDecision(...args);
  }

  executeCandidateDecision(...args: Parameters<GovernanceRecordsApi["executeCandidateDecision"]>) {
    return this.proposalOperations.executeCandidateDecision(...args);
  }

  executeRewireDecision(...args: Parameters<GovernanceRecordsApi["executeRewireDecision"]>) {
    return this.proposalOperations.executeRewireDecision(...args);
  }

  executeGoalTreeDecision<TTransition>(input: Parameters<GovernanceRecordsApi["executeGoalTreeDecision"]>[0],
    operation: () => { value: Omit<GoalTreeProposalDecisionResult<TTransition>, "replayed">; at: string }): GoalTreeProposalDecisionResult<TTransition> {
    return this.proposalOperations.executeGoalTreeDecision(input, operation);
  }

  recordGoalTreeDecision(input: Parameters<GovernanceRecordsApi["recordGoalTreeDecision"]>[0]): number {
    return this.proposalOperations.recordGoalTreeDecision(input);
  }

  recordRewireDecision(input: Parameters<GovernanceRecordsApi["recordRewireDecision"]>[0]): number {
    return this.proposalOperations.recordRewireDecision(input);
  }

  recordCandidateDecision(input: Parameters<GovernanceRecordsApi["recordCandidateDecision"]>[0]): number {
    return this.proposalOperations.recordCandidateDecision(input);
  }

  recordContractProposalDecision(input: Parameters<GovernanceRecordsApi["recordContractProposalDecision"]>[0]): number {
    return this.proposalOperations.recordContractDecision(input);
  }

  recordGoalTreeSubmission(input: Parameters<GovernanceRecordsApi["recordGoalTreeSubmission"]>[0]): number {
    return this.proposalOperations.recordSubmission(input);
  }

  executeGoalTreeCheck(...args: Parameters<GovernanceRecordsApi["executeGoalTreeCheck"]>) {
    return this.proposalOperations.executeCheck(...args);
  }

  recordGoalTreeCheck(input: Parameters<GovernanceRecordsApi["recordGoalTreeCheck"]>[0]): number {
    return this.proposalOperations.recordCheck(input);
  }

  recordGoalTreeRevision(input: Parameters<GovernanceRecordsApi["recordGoalTreeRevision"]>[0]): number {
    return this.proposalOperations.recordRevision(input);
  }

  recordEquivalentRewireSupersession(input: Parameters<GovernanceRecordsApi["recordEquivalentRewireSupersession"]>[0]): number {
    return this.proposalOperations.recordEquivalentRewireSupersession(input);
  }

  recordTreeRewireDecision(input: Parameters<GovernanceRecordsApi["recordTreeRewireDecision"]>[0]): number {
    const repository = new GovernanceRepository(this.db);
    repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: `rewire.${input.state}_from_tree_proposal`, object_type: "rewire", object_id: input.rewire_id,
      reason: input.reason, at: input.at,
      payload: { proposal_item_id: input.source_item_id,
        ...(input.state === "applied" ? { relation_ids: input.relation_ids } : {}) },
    });
    return repository.eventCursor(input.board_id);
  }

  recordTreeCandidateApproval(input: Parameters<GovernanceRecordsApi["recordTreeCandidateApproval"]>[0]): number {
    const repository = new GovernanceRepository(this.db);
    repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: "candidate.approved_from_tree_proposal", object_type: "candidate", object_id: input.candidate_id,
      reason: input.reason, at: input.at,
      payload: input.mode === "promote"
        ? { proposal_id: input.proposal_id, proposal_item_id: input.source_item_id,
            formal_goal_id: input.formal_goal_id, materialized_by_proposal_id: input.materialized_by_proposal_id,
            relation_ids: input.relation_ids }
        : { proposal_item_id: input.source_item_id, formal_goal_id: input.formal_goal_id },
    });
    return repository.eventCursor(input.board_id);
  }

  recordGoalTreeItemDecision(...args: Parameters<GovernanceRecordsApi["recordGoalTreeItemDecision"]>) {
    return this.goalTrees.recordGoalTreeItemDecision(...args);
  }

  refreshGoalTreeProposalState(...args: Parameters<GovernanceRecordsApi["refreshGoalTreeProposalState"]>) {
    return this.goalTrees.refreshGoalTreeProposalState(...args);
  }

  findGoalTreeItemOwner(...args: Parameters<GovernanceRecordsApi["findGoalTreeItemOwner"]>) {
    return this.goalTrees.findGoalTreeItemOwner(...args);
  }

  insertGoalTreeProposal(...args: Parameters<GovernanceRecordsApi["insertGoalTreeProposal"]>) {
    return this.goalTrees.insertGoalTreeProposal(...args);
  }

  insertGoalTreeProposalItem(...args: Parameters<GovernanceRecordsApi["insertGoalTreeProposalItem"]>) {
    return this.goalTrees.insertGoalTreeProposalItem(...args);
  }

  supersedeGoalTreeProposal(...args: Parameters<GovernanceRecordsApi["supersedeGoalTreeProposal"]>) {
    return this.goalTrees.supersedeGoalTreeProposal(...args);
  }

  setGoalTreeItemCheck(...args: Parameters<GovernanceRecordsApi["setGoalTreeItemCheck"]>) {
    return this.goalTrees.setGoalTreeItemCheck(...args);
  }

  transitionGoalTreeProposal(...args: Parameters<GovernanceRecordsApi["transitionGoalTreeProposal"]>) {
    return this.goalTrees.transitionGoalTreeProposal(...args);
  }

  transitionGoalTreeItem(...args: Parameters<GovernanceRecordsApi["transitionGoalTreeItem"]>) {
    return this.goalTrees.transitionGoalTreeItem(...args);
  }

  insertGoalTreeDecision(...args: Parameters<GovernanceRecordsApi["insertGoalTreeDecision"]>) {
    return this.goalTrees.insertGoalTreeDecision(...args);
  }

  supersedePendingContractProposals(
    boardId: string,
    goalId: string,
    at: string,
    decision: Record<string, unknown>,
  ): string[] {
    const pending = this.db.prepare(`SELECT proposal_id FROM contract_proposals
      WHERE board_id = ? AND goal_id = ? AND state = 'pending' ORDER BY created_at`)
      .all(boardId, goalId) as Array<{ proposal_id: string }>;
    if (!pending.length) return [];
    this.db.prepare(`UPDATE contract_proposals SET state = 'superseded', decided_at = ?, decision_json = ?
      WHERE board_id = ? AND goal_id = ? AND state = 'pending'`)
      .run(at, json(decision), boardId, goalId);
    return pending.map(proposal => proposal.proposal_id);
  }

  transitionContractProposal(
    boardId: string,
    proposalId: string,
    state: ContractProposalRecord["state"],
    decision: Record<string, unknown>,
    at: string,
  ): void {
    const current = this.db.prepare("SELECT state FROM contract_proposals WHERE board_id = ? AND proposal_id = ?")
      .get(boardId, proposalId) as GovernanceRow | undefined;
    if (current) {
      assertGovernanceTransition("contract_proposal", text(current.state) as ContractProposalRecord["state"], state);
    }
    this.db.prepare(`UPDATE contract_proposals SET state = ?, decision_json = ?, decided_at = ?
      WHERE board_id = ? AND proposal_id = ?`).run(state, json(decision), at, boardId, proposalId);
  }

  insertContractProposal(proposal: ContractProposalRecord): void {
    this.db.prepare(`INSERT INTO contract_proposals (
      proposal_id, board_id, goal_id, submitted_by, discovered_in_run_id,
      proposed_goal_json, field_sources_json, review_policy_json,
      proposed_impacts_json, proposed_risks_json, dependency_rewire_ids_json,
      state, decision_json, created_at, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        proposal.proposal_id, proposal.board_id, proposal.goal_id, proposal.submitted_by,
        proposal.discovered_in_run_id, json(proposal.proposed_goal), json(proposal.field_sources),
        json(proposal.review_policy), json(proposal.proposed_impacts), json(proposal.proposed_risks),
        json(proposal.dependency_rewire_ids), proposal.state,
        proposal.decision == null ? null : json(proposal.decision), proposal.created_at,
        proposal.decided_at,
      );
  }

  insertCandidate(candidate: CandidateGoalRecord): void {
    this.db.prepare(`INSERT INTO candidates (
      candidate_id, board_id, submitted_by, discovered_in_run_id, proposed_goal_json,
      proposed_relations_json, proposed_impacts_json, proposed_risks_json,
      blocking_mode, state, decision_json, created_at, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        candidate.candidate_id, candidate.board_id, candidate.submitted_by,
        candidate.discovered_in_run_id, json(candidate.proposed_goal),
        json(candidate.proposed_relations), json(candidate.proposed_impacts),
        json(candidate.proposed_risks), candidate.blocking_mode, candidate.state,
        candidate.decision == null ? null : json(candidate.decision), candidate.created_at,
        candidate.decided_at,
      );
  }

  transitionCandidate(
    boardId: string,
    candidateId: string,
    state: CandidateGoalRecord["state"],
    decision: Record<string, unknown> | null,
    at: string | null,
  ): boolean {
    const current = this.db.prepare("SELECT state FROM candidates WHERE board_id = ? AND candidate_id = ?")
      .get(boardId, candidateId) as GovernanceRow | undefined;
    if (current) {
      assertGovernanceTransition("candidate", text(current.state) as CandidateGoalRecord["state"], state);
    }
    const result = this.db.prepare(`UPDATE candidates SET state = ?, decision_json = ?, decided_at = ?
      WHERE board_id = ? AND candidate_id = ?`)
      .run(state, decision == null ? null : json(decision), at, boardId, candidateId);
    return Number(result.changes) === 1;
  }

  insertRewire(rewire: RewireRecord): void {
    this.db.prepare(`INSERT INTO rewires (
      rewire_id, board_id, candidate_id, proposal_json, impact_json, state, created_at, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(rewire.rewire_id, rewire.board_id, rewire.candidate_id, json(rewire.proposal),
        json(rewire.impact), rewire.state, rewire.created_at, rewire.decided_at);
  }

  transitionRewire(
    boardId: string,
    rewireId: string,
    state: RewireRecord["state"],
    update: { impact?: Record<string, unknown>; proposal?: RewireRecord["proposal"] },
    at: string | null,
  ): boolean {
    const current = this.db.prepare("SELECT proposal_json, impact_json FROM rewires WHERE board_id = ? AND rewire_id = ?")
      .get(boardId, rewireId) as GovernanceRow | undefined;
    if (!current) return false;
    const currentState = this.db.prepare("SELECT state FROM rewires WHERE board_id = ? AND rewire_id = ?")
      .get(boardId, rewireId) as GovernanceRow | undefined;
    if (currentState) {
      assertGovernanceTransition("rewire", text(currentState.state) as RewireRecord["state"], state);
    }
    const result = this.db.prepare(`UPDATE rewires SET proposal_json = ?, impact_json = ?, state = ?, decided_at = ?
      WHERE board_id = ? AND rewire_id = ?`)
      .run(
        update.proposal ? json(update.proposal) : text(current.proposal_json),
        update.impact ? json(update.impact) : text(current.impact_json),
        state, at, boardId, rewireId,
      );
    return Number(result.changes) === 1;
  }

  getRewireStateAndProposal(boardId: string, rewireId: string): {
    state: RewireRecord["state"];
    proposal: RewireRecord["proposal"];
  } | null {
    const row = this.db.prepare("SELECT state, proposal_json FROM rewires WHERE board_id = ? AND rewire_id = ?")
      .get(boardId, rewireId) as GovernanceRow | undefined;
    if (!row) return null;
    return { state: text(row.state) as RewireRecord["state"], proposal: JSON.parse(text(row.proposal_json)) };
  }
}
