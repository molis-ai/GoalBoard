import { randomUUID } from "node:crypto";
import type { CreateGoalInput, GoalRecord, GoalsCommandApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsCommandContext } from "./command-support.js";
import { insertInitialGoalContract } from "./goal-contract-records.js";
import { insertGoalCriteria } from "./goal-contract-records.js";
import type { GoalLifecycleCommands } from "./lifecycle-commands.js";
import { sqliteJson } from "./repository.js";

/** Records an already-authorized Goal creation without inventing a second decision. */
export class ConfirmedGoalCommands {
  constructor(private readonly context: GoalsCommandContext, private readonly validate: (goal: CreateGoalInput) => void,
    private readonly acceptDraft: GoalLifecycleCommands<unknown>["acceptDraft"]) {}

  /** Decision application calls recordConfirmedDraftUpdate after Governance supersession/closure. */
  updateConfirmedDraft(input: Parameters<GoalsCommandApi["updateConfirmedDraft"]>[0]): GoalRecord {
    return this.context.repository.immediate(() => {
      const { board_id: boardId, goal_id: goalId, goal, actor_id: actorId, at } = input;
      const existing = this.context.requireGoal(boardId, goalId);
      if (existing.definition_state === "accepted") {
        throw this.context.error("goal.accepted_contract_immutable", "accepted Contract 不能原地修改；请通过 Contract revision 更新");
      }
      const definitionState = goal.definition_state ?? existing.definition_state;
      const decompositionState = goal.decomposition_state ?? existing.decomposition_state;
      const normalized: CreateGoalInput = {
        ...goal, goal_id: goalId, definition_state: definitionState, decomposition_state: decompositionState,
        in_scope: goal.in_scope?.length ? goal.in_scope : existing.in_scope,
        out_of_scope: goal.out_of_scope?.length ? goal.out_of_scope : existing.out_of_scope,
        constraints: goal.constraints?.length ? goal.constraints : existing.constraints,
        required_inputs: goal.required_inputs?.length ? goal.required_inputs : existing.required_inputs,
        promised_outputs: goal.promised_outputs?.length ? goal.promised_outputs : existing.promised_outputs,
        acceptance_criteria: goal.acceptance_criteria.length ? goal.acceptance_criteria : existing.acceptance_criteria,
      };
      this.validate(normalized);
      if (definitionState === "accepted") {
        this.acceptDraft({ board_id: boardId, goal_id: goalId, proposed_goal: normalized, actor_id: actorId, accepted_at: at });
      } else {
        this.context.repository.db.prepare(`UPDATE goals SET
          title = ?, outcome = ?, why = ?, business_logic = ?,
          in_scope_json = ?, out_of_scope_json = ?, constraints_json = ?, required_inputs_json = ?, promised_outputs_json = ?,
          decomposition_review_json = ?, definition_state = ?, decomposition_state = ?, priority = ?,
          accepted_by = NULL, accepted_at = NULL, updated_at = ? WHERE board_id = ? AND goal_id = ?`).run(
          normalized.title.trim(), normalized.outcome.trim(), normalized.why.trim(), normalized.business_logic.trim(),
          sqliteJson(normalized.in_scope ?? []), sqliteJson(normalized.out_of_scope ?? []), sqliteJson(normalized.constraints ?? []),
          sqliteJson(normalized.required_inputs ?? []), sqliteJson(normalized.promised_outputs ?? []),
          normalized.decomposition_review == null ? null : sqliteJson(normalized.decomposition_review),
          definitionState, decompositionState, normalized.priority ?? existing.priority, at, boardId, goalId);
        this.context.repository.db.prepare("DELETE FROM acceptance_criteria WHERE goal_id = ?").run(goalId);
        insertGoalCriteria(this.context, goalId, normalized);
      }
      return this.context.requireGoal(boardId, goalId);
    });
  }

  createConfirmedGoal(input: Parameters<GoalsCommandApi["createConfirmedGoal"]>[0]): GoalRecord {
    this.validate(input.goal);
    return this.context.repository.immediate(() => {
      this.context.requireBoard(input.board_id);
      if (this.context.repository.getGoal(input.goal_id)) {
        throw this.context.error("goal_tree_proposal.goal_exists", `Goal 已存在: ${input.goal_id}`);
      }
      const goal = insertInitialGoalContract(this.context, { ...input, revision_reason: input.reason });
      this.context.repository.appendEvent({ eventId: randomUUID(), boardId: input.board_id, actorId: input.actor_id,
        type: "goal.created_from_tree_proposal", objectType: "goal", objectId: input.goal_id,
        reason: input.reason, at: input.at, payload: { definition_state: goal.definition_state,
          decomposition_state: goal.decomposition_state, proposal_item_id: input.source_item_id } });
      return goal;
    });
  }

  recordConfirmedDraftUpdate(input: Parameters<GoalsCommandApi["recordConfirmedDraftUpdate"]>[0]): number {
    const goal = this.context.requireGoal(input.board_id, input.goal_id);
    return this.context.repository.appendEvent({
      eventId: randomUUID(), boardId: input.board_id, actorId: input.actor_id,
      type: "goal.updated_from_tree_proposal", objectType: "goal", objectId: input.goal_id,
      reason: input.reason, at: input.at,
      payload: { definition_state: goal.definition_state, decomposition_state: goal.decomposition_state,
        proposal_item_id: input.source_item_id },
    });
  }
}
