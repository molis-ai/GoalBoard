import { randomUUID } from "node:crypto";
import type { GovernanceRecordsApi, GoalTreeProposalDecisionResult } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { GovernanceError, type GovernanceErrorFactory } from "./errors.js";
import { json, parseJson, text, type GovernanceRow } from "./mappers.js";
import { GovernanceRepository, type GovernanceSqliteDatabase } from "./repository.js";

/** Original proposal operation key and journal, with the same cross-owner atomic boundary. */
export class GovernanceProposalOperationStore {
  private readonly repository: GovernanceRepository;
  constructor(private readonly db: GovernanceSqliteDatabase,
    private readonly error: GovernanceErrorFactory = (code, message) => new GovernanceError(code, message)) {
    this.repository = new GovernanceRepository(db);
  }

  executeSubmission(input: Parameters<GovernanceRecordsApi["executeGoalTreeSubmission"]>[0],
    operation: Parameters<GovernanceRecordsApi["executeGoalTreeSubmission"]>[1]) {
    const result = this.execute("submit_goal_tree_proposal", input, () => {
      const value = operation();
      return { value, at: value.proposal.created_at };
    });
    return { ...result.value, replayed: result.replayed };
  }

  executeCheck(input: Parameters<GovernanceRecordsApi["executeGoalTreeCheck"]>[0],
    operation: Parameters<GovernanceRecordsApi["executeGoalTreeCheck"]>[1]) {
    return this.execute("check_goal_tree_proposal", input, operation).value;
  }

  executeContractDecision(input: Parameters<GovernanceRecordsApi["executeContractProposalDecision"]>[0],
    operation: Parameters<GovernanceRecordsApi["executeContractProposalDecision"]>[1]) {
    const result = this.execute("decide_contract_proposal", input, operation);
    return { ...result.value, replayed: result.replayed };
  }

  recordContractDecision(input: Parameters<GovernanceRecordsApi["recordContractProposalDecision"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: `contract_proposal.${input.decision}`, object_type: "contract_proposal", object_id: input.proposal_id,
      reason: input.reason, at: input.at,
      payload: { goal_id: input.goal_id, canonical_goal_changed: input.decision === "approved",
        ...(input.decision === "approved" ? { confirmed_fields: input.confirmed_fields } : {}) },
    });
    return this.repository.eventCursor(input.board_id);
  }

  executeCandidateDecision(input: Parameters<GovernanceRecordsApi["executeCandidateDecision"]>[0],
    operation: Parameters<GovernanceRecordsApi["executeCandidateDecision"]>[1]) {
    const result = this.execute("decide_candidate", input, operation);
    return { ...result.value, replayed: result.replayed };
  }

  recordCandidateDecision(input: Parameters<GovernanceRecordsApi["recordCandidateDecision"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: `candidate.${input.decision}`, object_type: "candidate", object_id: input.candidate_id,
      reason: input.reason, at: input.at, payload: {},
    });
    return this.repository.eventCursor(input.board_id);
  }

  executeRewireDecision(input: Parameters<GovernanceRecordsApi["executeRewireDecision"]>[0],
    operation: Parameters<GovernanceRecordsApi["executeRewireDecision"]>[1]) {
    const result = this.execute("confirm_rewire", input, operation);
    return { ...result.value, replayed: result.replayed };
  }

  recordRewireDecision(input: Parameters<GovernanceRecordsApi["recordRewireDecision"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: `rewire.${input.state}`, object_type: "rewire", object_id: input.rewire_id,
      reason: input.reason, at: input.at,
      payload: input.state === "rejected"
        ? { formal_goal_id: input.formal_goal_id, proposed_changes_applied: false }
        : { formal_goal_id: input.formal_goal_id, added_relation_ids: input.added_relation_ids,
            deactivated_relation_ids: input.deactivated_relation_ids, added_risk_ids: input.added_risk_ids,
            goals_needing_revalidation: input.goals_needing_revalidation },
    });
    return this.repository.eventCursor(input.board_id);
  }

  executeGoalTreeDecision<TTransition>(input: Parameters<GovernanceRecordsApi["executeGoalTreeDecision"]>[0],
    operation: () => { value: Omit<GoalTreeProposalDecisionResult<TTransition>, "replayed">; at: string }): GoalTreeProposalDecisionResult<TTransition> {
    const result = this.execute("decide_goal_tree_proposal", input, operation);
    return { ...result.value, replayed: result.replayed };
  }

  recordGoalTreeDecision(input: Parameters<GovernanceRecordsApi["recordGoalTreeDecision"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.authority.actor_id,
      type: "goal_tree_proposal.decided", object_type: "goal_tree_proposal", object_id: input.proposal_id,
      reason: "用户在当前入口明确决定了 Goal Tree 提案中的部分条目",
      payload: {
        runtime_actor_id: input.runtime_actor_id, authority_source: input.authority.authority_source,
        conversation_ref: input.authority.conversation_ref, message_ref: input.authority.message_ref,
        whole_confirmation_prompted: input.authority.whole_confirmation_prompted === true,
        prompted_proposal_id: input.authority.prompted_proposal_id ?? null,
        applied_item_ids: input.applied_item_ids, rejected_item_ids: input.rejected_item_ids,
        revised_item_ids: input.revised_item_ids, conflict_item_ids: input.conflict_item_ids,
        revision_proposal_ids: input.revision_proposal_ids, semantic_review: input.semantic_review,
      }, at: input.at,
    });
    return this.repository.eventCursor(input.board_id);
  }

  executeContractProposalSubmission(input: Parameters<GovernanceRecordsApi["executeContractProposalSubmission"]>[0],
    operation: Parameters<GovernanceRecordsApi["executeContractProposalSubmission"]>[1]) {
    const result = this.execute("submit_contract_proposal", input, operation);
    return { ...result.value, replayed: result.replayed };
  }

  executeCandidateSubmission(input: Parameters<GovernanceRecordsApi["executeCandidateSubmission"]>[0],
    operation: Parameters<GovernanceRecordsApi["executeCandidateSubmission"]>[1]) {
    const result = this.execute("submit_candidate", input, operation);
    return { ...result.value, replayed: result.replayed };
  }

  executeDependencyProposalSubmission(input: Parameters<GovernanceRecordsApi["executeDependencyProposalSubmission"]>[0],
    operation: Parameters<GovernanceRecordsApi["executeDependencyProposalSubmission"]>[1]) {
    const result = this.execute("submit_dependency_proposal", input, operation);
    return { ...result.value, replayed: result.replayed };
  }

  recordContractProposalSubmission(input: Parameters<GovernanceRecordsApi["recordContractProposalSubmission"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: "contract_proposal.submitted", object_type: "contract_proposal", object_id: input.proposal_id,
      reason: "目标说明方案已提交，等待用户决定",
      payload: { goal_id: input.goal_id, field_count: input.field_count, dependency_rewire_ids: input.dependency_rewire_ids }, at: input.at,
    });
    return this.repository.eventCursor(input.board_id);
  }

  recordCandidateSubmission(input: Parameters<GovernanceRecordsApi["recordCandidateSubmission"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: "candidate.submitted", object_type: "candidate", object_id: input.candidate_id,
      reason: "澄清或执行中发现了 Goal 之外的新工作，等待用户决定",
      payload: { blocking_mode: input.blocking_mode }, at: input.at,
    });
    return this.repository.eventCursor(input.board_id);
  }

  recordDependencyProposalSubmission(input: Parameters<GovernanceRecordsApi["recordDependencyProposalSubmission"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: "rewire.proposed", object_type: "rewire", object_id: input.rewire_id,
      reason: "Runtime 提交了 Dependency Proposal，等待用户决定",
      payload: { proposal_kind: "dependency", dependency_count: input.dependency_count, blocking_mode: input.blocking_mode }, at: input.at,
    });
    return this.repository.eventCursor(input.board_id);
  }

  private execute<T>(operationName: "submit_goal_tree_proposal" | "check_goal_tree_proposal" | "decide_contract_proposal" | "decide_candidate" | "confirm_rewire" | "decide_goal_tree_proposal" | "submit_contract_proposal" | "submit_candidate" | "submit_dependency_proposal",
    input: Parameters<GovernanceRecordsApi["executeGoalTreeSubmission"]>[0],
    operation: () => { value: T; at: string }): { value: T; replayed: boolean } {
    return this.repository.immediate(() => {
      const saved = this.db.prepare(`SELECT request_hash, outcome_json FROM idempotency_records
        WHERE board_id = ? AND actor_id = ? AND operation = ? AND idempotency_key = ?`)
        .get(input.board_id, input.actor_id, operationName, input.idempotency_key) as GovernanceRow | undefined;
      if (saved) {
        if (text(saved.request_hash) !== input.request_hash) {
          throw this.error("request.idempotency_key_reused", `幂等键 ${input.idempotency_key} 已被不同请求使用`);
        }
        const value = parseJson<T | null>(saved.outcome_json, null);
        if (value) return { value, replayed: true };
      }
      const result = operation();
      this.db.prepare(`INSERT INTO idempotency_records (
        board_id, actor_id, operation, idempotency_key, request_hash, outcome_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.board_id, input.actor_id, operationName,
        input.idempotency_key, input.request_hash, json(result.value), result.at);
      return { value: result.value, replayed: false };
    });
  }

  recordRevision(input: Parameters<GovernanceRecordsApi["recordGoalTreeRevision"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.authority.actor_id,
      type: "goal_tree_proposal.revision_requested", object_type: "goal_tree_proposal", object_id: input.proposal_id,
      reason: "用户在当前对话要求修订部分 Goal Tree 条目",
      payload: {
        supersedes_proposal_id: input.supersedes_proposal_id, supersedes_item_ids: input.supersedes_item_ids,
        authority_source: input.authority.authority_source, conversation_ref: input.authority.conversation_ref,
        message_ref: input.authority.message_ref,
      }, at: input.at,
    });
    return this.repository.eventCursor(input.board_id);
  }

  recordEquivalentRewireSupersession(input: Parameters<GovernanceRecordsApi["recordEquivalentRewireSupersession"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: "rewire.superseded_by_goal_tree_proposal", object_type: "rewire", object_id: input.rewire_id,
      reason: "等价关系变更已通过 native Goal Tree Proposal 落地，关闭重复待确认入口",
      payload: { goal_tree_proposal_id: input.goal_tree_proposal_id, relation_changes: input.relation_changes }, at: input.at,
    });
    return this.repository.eventCursor(input.board_id);
  }

  recordCheck(input: Parameters<GovernanceRecordsApi["recordGoalTreeCheck"]>[0]): number {
    const conflict = input.conflict_item_ids.length > 0;
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: "goal_tree_proposal.checked", object_type: "goal_tree_proposal", object_id: input.proposal_id,
      reason: input.origin === "legacy_contract_proposal"
        ? conflict ? "当前 Runtime 检查到历史 Contract Proposal 不能安全决定" : "当前 Runtime 检查到历史 Contract Proposal 可以安全决定"
        : conflict ? "当前 Runtime 检查到部分 Goal Tree 提案条目不再满足当前校验或基准" : "当前 Runtime 检查到 Goal Tree 提案的各条目基准仍有效",
      payload: {
        ...(input.origin === "legacy_contract_proposal" ? { origin: input.origin, raw_proposal_id: input.raw_proposal_id } : {}),
        conflict_item_ids: input.conflict_item_ids, planning_issue_codes: input.planning_issue_codes,
      },
      at: input.at,
    });
    return this.repository.eventCursor(input.board_id);
  }

  recordSubmission(input: Parameters<GovernanceRecordsApi["recordGoalTreeSubmission"]>[0]): number {
    this.repository.appendEvent({
      event_id: randomUUID(), board_id: input.board_id, actor_id: input.actor_id,
      type: input.supersedes_proposal_id ? "goal_tree_proposal.revised" : "goal_tree_proposal.submitted",
      object_type: "goal_tree_proposal", object_id: input.proposal_id,
      reason: input.supersedes_proposal_id
        ? "当前 Runtime 提交了保留历史的 Goal Tree 提案修订版本"
        : "当前 Runtime 提交了等待用户确认的统一 Goal Tree 提案",
      payload: { root_goal_id: input.root_goal_id, discovered_in_run_id: input.discovered_in_run_id,
        base_event_cursor: input.base_event_cursor, version: input.version,
        supersedes_proposal_id: input.supersedes_proposal_id, item_ids: input.item_ids },
      at: input.at,
    });
    return this.repository.eventCursor(input.board_id);
  }
}
