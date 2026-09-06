import { randomUUID } from "node:crypto";
import type { AcceptedRiskFacts, ConfirmedRiskChange, GoalValidityState, RiskRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsCommandContext } from "./command-support.js";
import { RISK_STATES, type RiskCommands } from "./risk-commands.js";
import { sqliteJson } from "./repository.js";

/** Authorized Risk facts/lifecycle in a proposal; confirmation remains an application concern. */
export class ConfirmedRiskCommands {
  constructor(private readonly context: GoalsCommandContext,
    private readonly normalize: RiskCommands<unknown>["normalizeRiskFacts"],
    private readonly setValidity: (boardId: string, goalId: string, state: GoalValidityState, at: string) => void) {}

  applyConfirmedRisk(input: ConfirmedRiskChange): { risk_id: string } {
    return this.context.repository.immediate(() => this.apply(input));
  }

  /** Facts already validated in a legacy confirmation; preserves its aggregate audit. */
  registerAcceptedRisk(facts: AcceptedRiskFacts, at: string): void {
    this.context.repository.immediate(() => {
      for (const goalId of facts.goal_ids) this.context.requireGoal(facts.board_id, goalId);
      this.context.repository.insertOpenRisk(facts, at);
    });
  }

  registerAcceptedRewireRisk(facts: AcceptedRiskFacts, actorId: string, at: string): void {
    this.registerAcceptedRisk(facts, at);
    this.context.repository.appendEvent({
      eventId: randomUUID(), boardId: facts.board_id, actorId,
      type: "risk.added", objectType: "risk", objectId: facts.risk_id,
      reason: `用户确认 Rewire 时纳入 Risk：${facts.description}`,
      payload: { goal_ids: facts.goal_ids, blocking_mode: facts.blocking_mode }, at,
    });
  }

  private apply(input: ConfirmedRiskChange): { risk_id: string } {
    const { board_id: boardId, risk_id: riskId, actor_id: actorId, reason, at } = input;
    const repository = this.context.repository;
    if (input.operation === "deactivate") {
      const result = repository.db.prepare("UPDATE risks SET state = 'expired', updated_at = ? WHERE board_id = ? AND risk_id = ?").run(at, boardId, riskId);
      if (result.changes !== 1) throw this.context.error("goal_tree_proposal.risk_not_found", "要停用的 Risk 不存在");
      repository.appendEvent({ eventId: randomUUID(), boardId, actorId, type: "risk.expired_from_tree_proposal",
        objectType: "risk", objectId: riskId, reason, at, payload: { proposal_item_id: input.source_item_id } });
      return { risk_id: riskId };
    }
    const facts = this.normalize(boardId, input.facts);
    const requestedState = input.requested_state;
    if (requestedState && !RISK_STATES.has(requestedState as RiskRecord["state"])) {
      throw this.context.error("goal_tree_proposal.risk_state_invalid",
        `Risk 生命周期状态“${requestedState}”不受支持；mitigate 是 treatment，降低措施完成后应使用 state=resolved`);
    }
    if (input.operation === "create" && requestedState && requestedState !== "open") {
      throw this.context.error("goal_tree_proposal.risk_state_invalid", "新建 Risk 必须从 open 开始；后续状态变化应通过 update 并记录用户确认");
    }
    const previous = input.operation === "create" ? null : repository.getRisk(boardId, riskId);
    if (input.operation !== "create" && !previous) {
      throw this.context.error("goal_tree_proposal.risk_not_found", "要更新的 Risk 不存在");
    }
    const previousState = previous?.state ?? null;
    const state = (requestedState || previousState || "open") as RiskRecord["state"];
    const rawBasis = input.resolution_basis;
    const resolutionBasis = state !== "resolved" ? null
      : rawBasis ? { summary: rawBasis.summary.trim(), evidence_refs: rawBasis.evidence_refs, residual_gaps: rawBasis.residual_gaps ?? [] }
      : requestedState ? null : previous?.resolution_basis ?? null;
    if (requestedState === "resolved" && (!resolutionBasis?.summary || resolutionBasis.evidence_refs.length === 0 || !Array.isArray(rawBasis?.residual_gaps))) {
      throw this.context.error("goal_tree_proposal.risk_resolution_basis_required", "Risk 标记为已解决时，必须记录解决摘要、至少一条证据引用和 residual_gaps");
    }
    const previousGoalIds = previous ? repository.listRiskGoalIds(riskId) : [];
    const values = [facts.description, facts.probability, facts.impact, sqliteJson(facts.affected_surfaces),
      facts.trigger, facts.treatment, facts.treatment_plan, facts.blocking_mode, facts.revisit_condition, facts.owner,
      state, resolutionBasis == null ? null : sqliteJson(resolutionBasis)];
    if (input.operation === "create") {
      repository.insertOpenRisk({ ...facts, risk_id: riskId, board_id: boardId }, at);
    } else {
      const result = repository.db.prepare(`UPDATE risks SET description = ?, probability = ?, impact = ?, affected_surfaces_json = ?,
        trigger = ?, treatment = ?, treatment_plan = ?, blocking_mode = ?, revisit_condition = ?, owner = ?, state = ?, resolution_basis_json = ?, updated_at = ?
        WHERE board_id = ? AND risk_id = ?`).run(...values, at, boardId, riskId);
      if (result.changes !== 1) throw this.context.error("goal_tree_proposal.risk_not_found", "要更新的 Risk 不存在");
      repository.db.prepare("DELETE FROM goal_risks WHERE risk_id = ?").run(riskId);
      const link = repository.db.prepare("INSERT INTO goal_risks (goal_id, risk_id) VALUES (?, ?)");
      for (const goalId of facts.goal_ids) link.run(goalId, riskId);
    }
    if (previous) {
      const wasInvalidating = previous.blocking_mode === "invalidate_on_trigger" && previousState === "triggered";
      const isInvalidating = facts.blocking_mode === "invalidate_on_trigger" && state === "triggered";
      const nextInvalidated = new Set(isInvalidating ? facts.goal_ids : []);
      if (wasInvalidating) {
        for (const goalId of previousGoalIds.filter(id => !nextInvalidated.has(id))) this.setValidity(boardId, goalId, "needs_revalidation", at);
      }
      if (isInvalidating) {
        for (const goalId of facts.goal_ids) this.setValidity(boardId, goalId, "invalidated", at);
      }
    }
    repository.appendEvent({ eventId: randomUUID(), boardId, actorId,
      type: input.operation === "create" ? "risk.created_from_tree_proposal" : "risk.updated_from_tree_proposal",
      objectType: "risk", objectId: riskId, reason, at, payload: { proposal_item_id: input.source_item_id,
        previous_goal_ids: previousGoalIds, goal_ids: facts.goal_ids, previous_blocking_mode: previous?.blocking_mode ?? null,
        blocking_mode: facts.blocking_mode, previous_state: previousState, state, resolution_basis: resolutionBasis } });
    return { risk_id: riskId };
  }
}
