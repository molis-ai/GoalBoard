import { randomUUID } from "node:crypto";
import type { GoalsActorWrite, GoalsImpactApi, ImpactBindingRecord, ImpactFactsInput, ImpactWriteResult } from "@adeptify/goalboard-contracts/modules/goals";
import { GoalsCommandContext, requestHash } from "./command-support.js";
import { GoalImpactRepository } from "./impact-repository.js";

export class GoalImpactCommands implements GoalsImpactApi {
  private readonly impacts: GoalImpactRepository;
  constructor(private readonly context: GoalsCommandContext) {
    this.impacts = new GoalImpactRepository(context.repository.db);
  }

  list(boardId: string): ImpactBindingRecord[] { return this.impacts.list(boardId); }
  get(boardId: string, bindingId: string): ImpactBindingRecord | null { return this.impacts.get(boardId, bindingId); }

  add(boardId: string, input: ImpactFactsInput, write: GoalsActorWrite): ImpactWriteResult & { binding_id: string } {
    const hash = requestHash({ board_id: boardId, ...input });
    return this.context.repository.immediate(() => {
      const replay = this.context.replay<ImpactWriteResult & { binding_id: string }>(boardId, write.actor_id, "add_impact", write.idempotency_key, hash);
      if (replay) return { ...replay, replayed: true };
      const facts = this.normalize(boardId, input);
      const bindingId = `impact-${randomUUID()}`;
      const at = this.context.now().toISOString();
      const impact: ImpactBindingRecord = { ...facts, binding_id: bindingId, board_id: boardId,
        created_by: write.actor_id, created_at: at, updated_at: at, deactivated_at: null, deactivation_reason: null };
      this.impacts.insert(impact);
      const cursor = this.event(boardId, bindingId, write.actor_id, "impact.added", facts.reason, facts, at);
      const outcome = { binding_id: bindingId, impact, observed_event_cursor: cursor };
      this.context.remember(boardId, write.actor_id, "add_impact", write.idempotency_key, hash, outcome, at);
      return { ...outcome, replayed: false };
    });
  }

  update(boardId: string, input: ImpactFactsInput & { binding_id: string }, write: GoalsActorWrite): ImpactWriteResult {
    const hash = requestHash({ board_id: boardId, ...input, audit_reason: write.reason });
    return this.context.repository.immediate(() => {
      const replay = this.context.replay<ImpactWriteResult>(boardId, write.actor_id, "update_impact", write.idempotency_key, hash);
      if (replay) return { ...replay, replayed: true };
      const auditReason = write.reason?.trim();
      if (!auditReason) throw this.context.error("impact.audit_reason_required", "更新 Impact 时必须说明修改原因");
      const bindingId = input.binding_id.trim();
      const previous = this.require(boardId, bindingId);
      if (previous.state === "inactive") throw this.context.error("impact.inactive_immutable", "已停用的 Impact 作为历史保留，不能原地修改");
      if (input.goal_id.trim() !== previous.goal_id) throw this.context.error("impact.goal_immutable", "Impact 的归属 Goal 不能通过更新迁移；请在目标 Goal 新建绑定并停用原记录");
      const facts = this.normalize(boardId, input);
      const at = this.context.now().toISOString();
      const impact = { ...previous, ...facts, updated_at: at };
      this.impacts.update(impact);
      const cursor = this.event(boardId, bindingId, write.actor_id, "impact.updated", auditReason, {
        previous: { goal_id: previous.goal_id, surface: previous.surface, access: previous.access,
          input_snapshot: previous.input_snapshot, state: previous.state, reason: previous.reason }, current: facts,
      }, at);
      const outcome = { impact, observed_event_cursor: cursor };
      this.context.remember(boardId, write.actor_id, "update_impact", write.idempotency_key, hash, outcome, at);
      return { ...outcome, replayed: false };
    });
  }

  deactivate(boardId: string, input: { binding_id: string; reason: string }, write: GoalsActorWrite): ImpactWriteResult {
    const hash = requestHash({ board_id: boardId, ...input });
    return this.context.repository.immediate(() => {
      const replay = this.context.replay<ImpactWriteResult>(boardId, write.actor_id, "deactivate_impact", write.idempotency_key, hash);
      if (replay) return { ...replay, replayed: true };
      const reasonText = input.reason.trim();
      if (!reasonText) throw this.context.error("impact.deactivation_reason_required", "停用 Impact 时必须说明原因");
      const bindingId = input.binding_id.trim();
      const previous = this.require(boardId, bindingId);
      if (previous.state === "inactive") throw this.context.error("impact.already_inactive", "Impact 已经停用");
      const at = this.context.now().toISOString();
      const impact: ImpactBindingRecord = { ...previous, state: "inactive", updated_at: at,
        deactivated_at: at, deactivation_reason: reasonText };
      this.impacts.update(impact);
      const cursor = this.event(boardId, bindingId, write.actor_id, "impact.deactivated", reasonText, {
        goal_id: previous.goal_id, surface: previous.surface, access: previous.access, previous_state: previous.state,
      }, at);
      const outcome = { impact, observed_event_cursor: cursor };
      this.context.remember(boardId, write.actor_id, "deactivate_impact", write.idempotency_key, hash, outcome, at);
      return { ...outcome, replayed: false };
    });
  }

  registerAccepted(boardId: string, input: Omit<ImpactFactsInput, "state"> & { binding_id: string }, actorId: string, at: string): void {
    this.context.requireGoal(boardId, input.goal_id);
    this.impacts.insert({ ...input, board_id: boardId, state: "confirmed", input_snapshot: input.input_snapshot ?? null,
      created_by: actorId, created_at: at, updated_at: at, deactivated_at: null, deactivation_reason: null });
  }

  private require(boardId: string, bindingId: string): ImpactBindingRecord {
    const impact = this.impacts.get(boardId, bindingId);
    if (!impact) throw this.context.error("impact.not_found", `Impact 不存在: ${bindingId}`);
    return impact;
  }

  private normalize(boardId: string, input: ImpactFactsInput) {
    const goalId = input.goal_id.trim();
    const surface = input.surface.trim();
    const state = input.state ?? "confirmed";
    const reason = input.reason.trim();
    this.context.requireGoal(boardId, goalId);
    if (!surface) throw this.context.error("impact.surface_required", "影响面不能为空");
    if (!["read", "write", "decide", "exclusive"].includes(input.access)) throw this.context.error("impact.access_invalid", "Impact access 无效");
    if (!["proposed", "confirmed"].includes(state)) throw this.context.error("impact.state_invalid", "Impact 状态必须是提议中或已确认");
    if (!reason) throw this.context.error("impact.reason_required", "Impact 必须说明绑定原因");
    return { goal_id: goalId, surface, access: input.access, input_snapshot: input.input_snapshot?.trim() || null, state, reason };
  }

  private event(boardId: string, bindingId: string, actorId: string, type: string, reason: string, payload: unknown, at: string): number {
    return this.context.repository.appendEvent({ eventId: randomUUID(), boardId, actorId, type,
      objectType: "impact", objectId: bindingId, reason, payload, at });
  }
}
