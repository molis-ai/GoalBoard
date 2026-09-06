import { createHash, randomUUID } from "node:crypto";
import type { GoalsQueryApi, GoalsCommandApi, GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionApplicationApi } from "@adeptify/goalboard-contracts/modules/execution";
import type { GovernanceApplicationApi, ClarificationSessionRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { DraftDialogueApplicationApi, DraftDialogueStartInput, DraftDialogueTurnInput, DraftDialogueResumeInput, DraftDialogueView } from "./draft-dialogue-contract.js";
import type { ExecutionValidationApplicationApi } from "./execution-validation-contract.js";

export interface DraftDialogueApplicationOptions {
  goals: { query: Pick<GoalsQueryApi, "getGoal" | "getBoard">; commands: Pick<GoalsCommandApi, "createGoal"> };
  execution: Pick<ExecutionApplicationApi, "query">;
  validation: { query: Pick<ExecutionValidationApplicationApi["query"], "getGoalWorkState" | "getGoalActionProjection">;
    commands: Pick<ExecutionValidationApplicationApi["commands"], "selectGoalAndStart"> };
  governance: Pick<GovernanceApplicationApi, "clarification" | "provenance">;
  clock?: () => Date;
  errorFactory: (code: string, message: string) => Error;
}

/** One user journey, composed exclusively through the existing fact owners. */
export class DraftDialogueApplication implements DraftDialogueApplicationApi {
  private readonly clock: () => Date;
  constructor(private readonly ports: DraftDialogueApplicationOptions) {
    this.clock = ports.clock ?? (() => new Date());
  }

  startDraftDialogue(input: DraftDialogueStartInput): DraftDialogueView & { replayed: boolean } {
    const roughIdea = this.requiredText(input.rough_idea, "draft_dialogue.rough_idea_required", "请先记录用户的粗略想法");
    const actorId = this.requiredText(input.actor_id, "draft_dialogue.actor_required", "澄清需要当前 Runtime 的 actor_id");
    const goalId = input.goal_id?.trim() || `draft-${randomUUID()}`;
    const firstLine = roughIdea.split(/\r?\n/, 1)[0]?.trim() || roughIdea.trim();
    const title = (input.draft_title?.trim() || (firstLine.length <= 120 ? firstLine : `${firstLine.slice(0, 117)}…`)).trim();
    const hash = requestHash({ board_id: input.board_id, actor_id: actorId, rough_idea: roughIdea,
      draft_title: title, goal_id: input.goal_id?.trim() || null, capabilities: input.capabilities ?? [],
      goal_mode_attestation: input.goal_mode_attestation ?? false, lease_seconds: input.lease_seconds ?? null });
    return this.ports.governance.clarification.execute({ ...input, actor_id: actorId,
      operation: "draft_dialogue_start", request_hash: hash }, () => {
      if (!this.ports.goals.query.getBoard(input.board_id)) {
        throw this.error("board.not_found", `Board 不存在: ${input.board_id}`);
      }
      const existing = input.goal_id?.trim() ? this.ports.goals.query.getGoal(input.board_id, goalId) : null;
      if (existing && !needsClarification(existing)) {
        throw this.error("draft_dialogue.goal_not_clarifiable", "只能为仍待澄清的 Goal 开始自然语言对话");
      }
      if (existing && this.ports.governance.clarification.listSessions(input.board_id)
        .some(session => session.goal_id === goalId && session.state !== "closed")) {
        throw this.error("draft_dialogue.already_open", "这条 Goal 已有可恢复的澄清对话；请使用 draft_dialogue_resume 而不是创建第二份会话");
      }
      const goal = existing ?? this.ports.goals.commands.createGoal(input.board_id, {
        goal_id: goalId, title, outcome: "", why: "", business_logic: "",
        definition_state: "draft", decomposition_state: "abstract", acceptance_criteria: [],
      }, { actor_id: actorId, idempotency_key: `draft-dialogue-goal:${input.idempotency_key}`,
        reason: "用户在当前 Runtime 中提交了粗略想法，开始自然语言澄清" }).goal;
      const current = this.ports.validation.query.getGoalWorkState({ board_id: input.board_id, goal_id: goal.goal_id });
      let claim = current.active_claim;
      let run = current.active_run;
      if (run) {
        if (run.role !== "clarifier" || run.actor_id !== actorId) {
          throw this.error("draft_dialogue.active_elsewhere", "这条 Goal 正由另一个 Runtime 推进，不能静默接管其工作");
        }
      } else {
        const selected = this.ports.validation.commands.selectGoalAndStart({
          board_id: input.board_id, goal_id: goal.goal_id, actor_id: actorId, role: "clarifier",
          capabilities: input.capabilities ?? [], goal_mode_attestation: input.goal_mode_attestation ?? false,
          lease_seconds: input.lease_seconds, idempotency_key: `draft-dialogue-run:${input.idempotency_key}`,
        });
        if (!selected.allowed || !selected.claim || !selected.run) {
          throw this.error("draft_dialogue.claim_denied", selected.reasons.map(item => item.message).join("；") || "当前 Goal 暂时不能进入澄清");
        }
        claim = selected.claim;
        run = selected.run;
      }
      if (!claim || !run) throw this.error("draft_dialogue.claim_denied", "当前 Goal 的澄清工作缺少有效 Claim 或 Run");
      const at = this.clock().toISOString();
      const sessionId = `clarification-session-${randomUUID()}`;
      const cursor = this.ports.governance.clarification.start({
        session_id: sessionId, board_id: input.board_id, goal_id: goal.goal_id,
        claim_id: claim.claim_id, run_id: run.run_id, rough_idea: roughIdea, state: "clarifying",
        current_understanding: null, next_question: null, proposal_summary: null,
        created_by: actorId, created_at: at, updated_at: at, closed_at: null,
      }, { turn_id: `clarification-turn-${randomUUID()}`, session_id: sessionId,
        board_id: input.board_id, goal_id: goal.goal_id, run_id: run.run_id, actor_id: actorId,
        turn_index: 1, turn_kind: "rough_idea", user_message: roughIdea, current_understanding: null,
        known_facts: [], assumptions: [], next_question: null, proposal_summary: null, created_at: at }, !existing);
      return this.readView(input.board_id, goal.goal_id, sessionId, cursor);
    });
  }

  recordDraftDialogueTurn(input: DraftDialogueTurnInput): DraftDialogueView & { replayed: boolean } {
    const actorId = this.requiredText(input.actor_id, "draft_dialogue.actor_required", "澄清需要当前 Runtime 的 actor_id");
    const userMessage = this.requiredText(input.user_message, "draft_dialogue.user_message_required", "需要记录用户本轮回答");
    const understanding = this.requiredText(input.current_understanding, "draft_dialogue.understanding_required", "Runtime 必须先用人话写下当前理解");
    const nextQuestion = input.next_question?.trim() || null;
    const proposalSummary = input.proposal_summary?.trim() || null;
    if (nextQuestion && proposalSummary) {
      throw this.error("draft_dialogue.next_step_ambiguous", "一轮澄清只能继续提出一个关键问题，或标记为准备提交提案，不能同时做两件事");
    }
    if (!nextQuestion && !proposalSummary) {
      throw this.error("draft_dialogue.next_step_required", "没有关键未知项时请写入待确认提案摘要；否则只提出一个真正影响结果的问题");
    }
    const hash = requestHash({ board_id: input.board_id, goal_id: input.goal_id, run_id: input.run_id,
      actor_id: actorId, user_message: userMessage, current_understanding: understanding,
      known_facts: input.known_facts ?? [], assumptions: input.assumptions ?? [],
      next_question: nextQuestion, proposal_summary: proposalSummary });
    return this.ports.governance.clarification.execute({ ...input, actor_id: actorId,
      operation: "draft_dialogue_turn", request_hash: hash }, () => {
      const claimId = this.requireActiveRun(input.board_id, input.goal_id, input.run_id, actorId);
      const session = this.requireSession(input.board_id, input.goal_id);
      const at = this.clock().toISOString();
      const turnId = `clarification-turn-${randomUUID()}`;
      const facts = this.ports.governance.provenance.normalizeFacts(input.known_facts ?? [], turnId);
      const assumptions = this.ports.governance.provenance.normalizeAssumptions(input.assumptions ?? [], turnId);
      const turns = this.ports.governance.clarification.listTurns(input.board_id).filter(turn => turn.session_id === session.session_id);
      const turnIndex = turns.reduce((max, turn) => Math.max(max, turn.turn_index), 0) + 1;
      const cursor = this.ports.governance.clarification.recordTurn({
        turn_id: turnId, session_id: session.session_id, board_id: input.board_id, goal_id: input.goal_id,
        run_id: input.run_id, actor_id: actorId, turn_index: turnIndex, turn_kind: "user_answer",
        user_message: userMessage, current_understanding: understanding, known_facts: facts, assumptions,
        next_question: nextQuestion, proposal_summary: proposalSummary, created_at: at,
      }, claimId);
      return this.readView(input.board_id, input.goal_id, session.session_id, cursor);
    });
  }

  resumeDraftDialogue(input: DraftDialogueResumeInput): DraftDialogueView & { replayed: boolean } {
    const actorId = this.requiredText(input.actor_id, "draft_dialogue.actor_required", "澄清需要当前 Runtime 的 actor_id");
    const hash = requestHash({ board_id: input.board_id, goal_id: input.goal_id, actor_id: actorId,
      capabilities: input.capabilities ?? [], goal_mode_attestation: input.goal_mode_attestation ?? false,
      lease_seconds: input.lease_seconds ?? null });
    return this.ports.governance.clarification.execute({ ...input, actor_id: actorId,
      operation: "draft_dialogue_resume", request_hash: hash }, () => {
      const session = this.requireSession(input.board_id, input.goal_id);
      const goal = this.requireGoal(input.board_id, input.goal_id);
      if (!needsClarification(goal)) throw this.error("draft_dialogue.not_clarifiable", "只有仍待澄清的 Goal 可以恢复自然语言对话");
      const current = this.readView(input.board_id, input.goal_id, session.session_id);
      if (current.run && current.run.role === "clarifier") {
        if (current.run.actor_id !== actorId) {
          throw this.error("draft_dialogue.active_elsewhere", "这个 Goal 正由另一个 Runtime 澄清，不能静默抢占；请等待其释放或过期");
        }
        return this.readView(input.board_id, input.goal_id, session.session_id);
      }
      const projection = this.ports.validation.query.getGoalActionProjection({ board_id: input.board_id, goal_id: input.goal_id });
      const action = projection.primary_action?.actor === "runtime" && projection.primary_action.kind === "clarify"
        ? projection.primary_action
        : projection.actions.filter(item => item.actor === "runtime" && item.kind === "clarify").length === 1
          ? projection.actions.find(item => item.actor === "runtime" && item.kind === "clarify")! : null;
      const selected = this.ports.validation.commands.selectGoalAndStart({
        board_id: input.board_id, goal_id: input.goal_id, actor_id: actorId, role: "clarifier",
        ...(action ? { action_id: action.action_id, action_token: projection.action_token } : {}),
        capabilities: input.capabilities ?? [], goal_mode_attestation: input.goal_mode_attestation ?? false,
        lease_seconds: input.lease_seconds, idempotency_key: `draft-dialogue-resume-run:${input.idempotency_key}`,
      });
      if (!selected.allowed || !selected.claim || !selected.run) {
        throw this.error("draft_dialogue.resume_denied", selected.reasons.map(item => item.message).join("；") || "当前 Goal 不能恢复澄清");
      }
      const cursor = this.ports.governance.clarification.resume({ board_id: input.board_id,
        goal_id: input.goal_id, session_id: session.session_id, claim_id: selected.claim.claim_id,
        run_id: selected.run.run_id, actor_id: actorId, at: this.clock().toISOString() });
      return this.readView(input.board_id, input.goal_id, session.session_id, cursor);
    });
  }

  private readView(boardId: string, goalId: string, sessionId: string, cursor?: number): DraftDialogueView {
    const records = this.ports.governance.clarification;
    const dialogue = records.listSessions(boardId).find(item => item.session_id === sessionId);
    if (!dialogue || dialogue.goal_id !== goalId) throw this.error("draft_dialogue.not_found", "找不到这条 Goal 澄清记录");
    const goal = this.ports.goals.query.getGoal(boardId, goalId);
    if (!goal) throw this.error("goal.not_found", `找不到这个 Goal: ${goalId}`);
    const state = this.ports.validation.query.getGoalWorkState({ board_id: boardId, goal_id: goalId });
    return { dialogue, goal, turns: records.listTurns(boardId).filter(item => item.session_id === sessionId),
      work_state: state, claim: state.active_claim, run: state.active_run,
      observed_event_cursor: cursor ?? records.eventCursor(boardId) };
  }

  private requireSession(boardId: string, goalId: string): ClarificationSessionRecord {
    this.requireGoal(boardId, goalId);
    const session = this.ports.governance.clarification.listSessions(boardId)
      .find(item => item.goal_id === goalId && item.state !== "closed");
    if (!session) throw this.error("draft_dialogue.not_found", "这个 Goal 没有可恢复的澄清记录；请先使用 draft_dialogue_start 初始化");
    return session;
  }

  private requireGoal(boardId: string, goalId: string): GoalRecord {
    const goal = this.ports.goals.query.getGoal(boardId, goalId);
    if (!goal) throw this.error("goal.not_found", `Goal 不存在: ${goalId}`);
    return goal;
  }

  private requireActiveRun(boardId: string, goalId: string, runId: string, actorId: string): string {
    const pair = this.ports.execution.query.getRunWithClaim(boardId, runId);
    if (!pair || pair.run.goal_id !== goalId) throw this.error("draft_dialogue.run_not_found", "找不到这条 Goal 澄清 Run");
    if (pair.run.actor_id !== actorId || pair.claim.actor_id !== actorId) {
      throw this.error("draft_dialogue.run_not_owner", "只有当前澄清 Runtime 可以写入本轮对话进展");
    }
    if (pair.run.role !== "clarifier") throw this.error("draft_dialogue.clarifier_required", "只有 clarifier Run 可以记录 Goal 澄清");
    if (pair.run.state !== "started") throw this.error("draft_dialogue.run_not_active", "这条澄清 Run 已不在进行中，请先恢复 Goal 澄清对话");
    if (pair.claim.state !== "active" || pair.claim.expires_at <= this.clock().toISOString()) {
      throw this.error("draft_dialogue.claim_not_active", "澄清 Claim 已释放、撤销或过期，请先恢复 Goal 澄清对话");
    }
    return pair.claim.claim_id;
  }

  private requiredText(value: string, code: string, message: string): string {
    const result = value.trim();
    if (!result) throw this.error(code, message);
    return result;
  }

  private error(code: string, message: string): Error { return this.ports.errorFactory(code, message); }
}

function needsClarification(goal: GoalRecord): boolean {
  return goal.definition_state !== "accepted" || goal.decomposition_state === "abstract" ||
    goal.decomposition_state === "frontier_open" || goal.acceptance_criteria.length === 0;
}

// Preserves persisted request identity from the original dialogue implementation.
function requestHash(value: unknown): string {
  function canonicalize(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item)
      .sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, canonicalize(value)]));
    return item;
  }
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
