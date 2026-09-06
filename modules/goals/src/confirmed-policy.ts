import { randomUUID } from "node:crypto";
import type { ConfirmedPolicyChange, GoalPolicy, GoalsCommandApi } from "@adeptify/goalboard-contracts/modules/goals";
import { GoalsCommandContext, unique } from "./command-support.js";

/** Goal-owned Policy rules and persistence; no user decision is made here. */
export class ConfirmedPolicyCommands {
  constructor(private readonly context: GoalsCommandContext) {}

  registerAcceptedPolicy(input: Parameters<GoalsCommandApi["registerAcceptedPolicy"]>[0]): void {
    this.context.repository.immediate(() => {
      this.context.requireGoal(input.board_id, input.goal_id);
      this.context.repository.replacePolicyBinding(input);
    });
  }

  applyConfirmedPolicy(input: ConfirmedPolicyChange): { policy_binding_id: string } {
    return this.context.repository.immediate(() => {
      if (input.operation === "deactivate") {
        const bindingId = input.policy_binding_id.trim();
        if (!bindingId) throw this.context.error("goal_tree_proposal.policy_id_required", "停用 Policy 需要 policy_binding_id");
        if (!this.context.repository.deactivatePolicyBinding(input.board_id, bindingId)) {
          throw this.context.error("goal_tree_proposal.policy_not_active", "要停用的 Policy 已不存在或不再生效");
        }
        this.context.repository.appendEvent({ eventId: randomUUID(), boardId: input.board_id,
          actorId: input.actor_id, type: "policy.deactivated_from_tree_proposal", objectType: "policy", objectId: bindingId,
          reason: input.reason, at: input.at, payload: { proposal_item_id: input.source_item_id } });
        return { policy_binding_id: bindingId };
      }
      if (input.goal_id) this.context.requireGoal(input.board_id, input.goal_id);
      const policy = this.normalize(input.policy);
      const bindingId = input.policy_binding_id?.trim() || `policy-${randomUUID()}`;
      const replaced = this.context.repository.replacePolicyBinding({ ...input, policy_binding_id: bindingId, policy });
      this.context.repository.appendEvent({ eventId: randomUUID(), boardId: input.board_id,
        actorId: input.actor_id, type: "policy.added_from_tree_proposal", objectType: "policy", objectId: bindingId,
        reason: input.reason, at: input.at, payload: { proposal_item_id: input.source_item_id,
          goal_id: input.goal_id, scope: input.goal_id ? "goal" : "project_default", replaced_binding_ids: replaced } });
      return { policy_binding_id: bindingId };
    });
  }

  private normalize(raw: { [K in keyof GoalPolicy]?: unknown }): Partial<GoalPolicy> {
    const policy: Partial<GoalPolicy> = {};
    if (raw.goal_mode != null) {
      const mode = String(raw.goal_mode);
      if (!["disabled", "preferred", "required"].includes(mode)) {
        throw this.context.error("goal_tree_proposal.policy_goal_mode_invalid", "Goal Mode 无效");
      }
      policy.goal_mode = mode as GoalPolicy["goal_mode"];
    }
    if (raw.required_capabilities != null) {
      if (!Array.isArray(raw.required_capabilities)) {
        throw this.context.error("goal_tree_proposal.policy_capabilities_invalid", "required_capabilities 必须是字符串列表");
      }
      policy.required_capabilities = unique(raw.required_capabilities.map(String).map(value => value.trim()).filter(Boolean)).sort();
    }
    for (const field of ["self_verification", "human_approval"] as const) {
      if (raw[field] != null) {
        if (typeof raw[field] !== "boolean") {
          throw this.context.error("goal_tree_proposal.policy_boolean_invalid", `${field} 必须是布尔值`);
        }
        policy[field] = raw[field] as boolean;
      }
    }
    for (const field of ["cross_reviewers", "adversarial_reviewers", "max_lease_seconds"] as const) {
      if (raw[field] != null) {
        const value = raw[field];
        if (!Number.isInteger(value) || Number(value) < (field === "max_lease_seconds" ? 1 : 0)) {
          throw this.context.error("goal_tree_proposal.policy_number_invalid", `${field} 数值无效`);
        }
        policy[field] = Number(value);
      }
    }
    return policy;
  }
}
