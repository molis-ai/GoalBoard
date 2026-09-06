import { randomUUID } from "node:crypto";
import type {
  ClarificationSessionRecord, ClarificationTurnRecord, GovernanceClarificationApi,
} from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { GovernanceError, type GovernanceErrorFactory } from "./errors.js";
import { json, parseJson, text, optionalText, type GovernanceRow } from "./mappers.js";
import { GovernanceRepository, type GovernanceSqliteDatabase } from "./repository.js";

/** Persistence for the existing dialogue schema, not another Goal/Run store. */
export class GovernanceClarificationStore implements GovernanceClarificationApi {
  private readonly repository: GovernanceRepository;
  constructor(
    private readonly db: GovernanceSqliteDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly error: GovernanceErrorFactory = (code, message) => new GovernanceError(code, message),
  ) { this.repository = new GovernanceRepository(db); }

  listSessions(boardId: string): ClarificationSessionRecord[] {
    return (this.db.prepare("SELECT * FROM clarification_sessions WHERE board_id = ? ORDER BY updated_at DESC, session_id")
      .all(boardId) as GovernanceRow[]).map(mapClarificationSession);
  }

  listTurns(boardId: string): ClarificationTurnRecord[] {
    return (this.db.prepare("SELECT * FROM clarification_turns WHERE board_id = ? ORDER BY session_id, turn_index, turn_id")
      .all(boardId) as GovernanceRow[]).map(mapClarificationTurn);
  }

  execute<T>(input: Parameters<GovernanceClarificationApi["execute"]>[0], operation: () => T): T & { replayed: boolean } {
    return this.repository.immediate(() => {
      const saved = this.db.prepare(`SELECT request_hash, outcome_json FROM idempotency_records
        WHERE board_id = ? AND actor_id = ? AND operation = ? AND idempotency_key = ?`)
        .get(input.board_id, input.actor_id, input.operation, input.idempotency_key) as GovernanceRow | undefined;
      if (saved) {
        if (text(saved.request_hash) !== input.request_hash) {
          throw this.error("request.idempotency_key_reused", `幂等键 ${input.idempotency_key} 已被不同请求使用`);
        }
        return { ...parseJson<T>(saved.outcome_json, null as T), replayed: true };
      }
      const result = operation();
      this.db.prepare(`INSERT INTO idempotency_records (
        board_id, actor_id, operation, idempotency_key, request_hash, outcome_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.board_id, input.actor_id, input.operation,
        input.idempotency_key, input.request_hash, json(result), this.now());
      return { ...result, replayed: false };
    });
  }

  start(session: ClarificationSessionRecord, turn: ClarificationTurnRecord, createdDraft: boolean): number {
    this.db.prepare(`INSERT INTO clarification_sessions (
      session_id, board_id, goal_id, claim_id, run_id, rough_idea, state,
      current_understanding, next_question, proposal_summary, created_by, created_at, updated_at, closed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      session.session_id, session.board_id, session.goal_id, session.claim_id, session.run_id,
      session.rough_idea, session.state, session.current_understanding, session.next_question,
      session.proposal_summary, session.created_by, session.created_at, session.updated_at, session.closed_at);
    this.insertTurn(turn);
    this.repository.appendEvent({ event_id: randomUUID(), board_id: session.board_id,
      actor_id: session.created_by, type: "clarification.started", object_type: "clarification_session",
      object_id: session.session_id, at: session.created_at,
      reason: createdDraft ? "当前 Runtime 根据用户粗略想法创建 Draft 并开始澄清" : "当前 Runtime 为已有待澄清 Goal 开始自然语言澄清",
      payload: { goal_id: session.goal_id, claim_id: session.claim_id, run_id: session.run_id,
        initial_turn_id: turn.turn_id, created_draft: createdDraft } });
    return this.eventCursor(session.board_id);
  }

  recordTurn(turn: ClarificationTurnRecord, claimId: string): number {
    const state = turn.proposal_summary ? "proposal_ready" : "clarifying";
    this.insertTurn(turn);
    this.db.prepare(`UPDATE clarification_sessions SET claim_id = ?, run_id = ?, state = ?,
      current_understanding = ?, next_question = ?, proposal_summary = ?, updated_at = ? WHERE session_id = ?`)
      .run(claimId, turn.run_id, state, turn.current_understanding, turn.next_question,
        turn.proposal_summary, turn.created_at, turn.session_id);
    this.repository.appendEvent({ event_id: randomUUID(), board_id: turn.board_id,
      actor_id: turn.actor_id, type: "clarification.turn_recorded", object_type: "clarification_turn",
      object_id: turn.turn_id, at: turn.created_at,
      reason: turn.proposal_summary ? "当前 Runtime 已记录用户回答并准备提交待确认 Goal Tree 提案" : "当前 Runtime 已记录用户回答，并提出下一个关键问题",
      payload: { session_id: turn.session_id, goal_id: turn.goal_id, run_id: turn.run_id,
        turn_index: turn.turn_index, state, known_fact_count: turn.known_facts.length,
        assumption_count: turn.assumptions.length, next_question: turn.next_question } });
    return this.eventCursor(turn.board_id);
  }

  resume(input: Parameters<GovernanceClarificationApi["resume"]>[0]): number {
    this.db.prepare("UPDATE clarification_sessions SET claim_id = ?, run_id = ?, updated_at = ? WHERE session_id = ?")
      .run(input.claim_id, input.run_id, input.at, input.session_id);
    this.repository.appendEvent({ event_id: randomUUID(), board_id: input.board_id,
      actor_id: input.actor_id, type: "clarification.resumed", object_type: "clarification_session",
      object_id: input.session_id, reason: "当前 Runtime 从持久化 Goal 澄清记录恢复工作", at: input.at,
      payload: { goal_id: input.goal_id, claim_id: input.claim_id, run_id: input.run_id } });
    return this.eventCursor(input.board_id);
  }

  eventCursor(boardId: string): number { return this.repository.eventCursor(boardId); }

  closeAccepted(boardId: string, goalId: string, actorId: string, reason: string, at: string): string[] {
    const sessions = this.listSessions(boardId)
      .filter(session => session.goal_id === goalId && session.state !== "closed")
      .sort((left, right) => left.session_id.localeCompare(right.session_id));
    for (const session of sessions) {
      this.db.prepare("UPDATE clarification_sessions SET state = 'closed', updated_at = ?, closed_at = ? WHERE session_id = ? AND state != 'closed'")
        .run(at, at, session.session_id);
      this.repository.appendEvent({ event_id: randomUUID(), board_id: boardId, actor_id: actorId,
        type: "clarification.closed", object_type: "clarification_session", object_id: session.session_id,
        reason, at, payload: { goal_id: goalId, previous_state: session.state, definition_state: "accepted" } });
    }
    return sessions.map(session => session.session_id);
  }

  private insertTurn(turn: ClarificationTurnRecord): void {
    this.db.prepare(`INSERT INTO clarification_turns (
      turn_id, session_id, board_id, goal_id, run_id, actor_id, turn_index, turn_kind,
      user_message, current_understanding, known_facts_json, assumptions_json,
      next_question, proposal_summary, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(turn.turn_id,
      turn.session_id, turn.board_id, turn.goal_id, turn.run_id, turn.actor_id, turn.turn_index,
      turn.turn_kind, turn.user_message, turn.current_understanding, json(turn.known_facts),
      json(turn.assumptions), turn.next_question, turn.proposal_summary, turn.created_at);
  }
}

function mapClarificationSession(row: GovernanceRow): ClarificationSessionRecord {
  return { session_id: text(row.session_id), board_id: text(row.board_id), goal_id: text(row.goal_id),
    claim_id: optionalText(row.claim_id), run_id: optionalText(row.run_id), rough_idea: text(row.rough_idea),
    state: text(row.state) as ClarificationSessionRecord["state"], current_understanding: optionalText(row.current_understanding),
    next_question: optionalText(row.next_question), proposal_summary: optionalText(row.proposal_summary),
    created_by: text(row.created_by), created_at: text(row.created_at), updated_at: text(row.updated_at), closed_at: optionalText(row.closed_at) };
}

function mapClarificationTurn(row: GovernanceRow): ClarificationTurnRecord {
  return { turn_id: text(row.turn_id), session_id: text(row.session_id), board_id: text(row.board_id),
    goal_id: text(row.goal_id), run_id: optionalText(row.run_id), actor_id: text(row.actor_id),
    turn_index: Number(row.turn_index), turn_kind: text(row.turn_kind) as ClarificationTurnRecord["turn_kind"],
    user_message: text(row.user_message), current_understanding: optionalText(row.current_understanding),
    known_facts: parseJson(row.known_facts_json, [] as ClarificationTurnRecord["known_facts"]),
    assumptions: parseJson(row.assumptions_json, [] as ClarificationTurnRecord["assumptions"]),
    next_question: optionalText(row.next_question), proposal_summary: optionalText(row.proposal_summary), created_at: text(row.created_at) };
}
