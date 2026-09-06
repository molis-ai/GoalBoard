import type { GoalsEntryApi, AsyncGoalsEntryApi } from "@adeptify/goalboard-plugin-goals";
import type { ImpactFactsInput } from "@adeptify/goalboard-contracts/modules/goals";
import { mcpBoardPayload } from "./payload.js";

/** Wire adaptation after host authorization; application owners still decide business validity. */
export function createMcpGoalToolHandlers<TTransition>(
  goals: GoalsEntryApi<TTransition> | AsyncGoalsEntryApi<TTransition>,
  audience: "runtime" | "management",
) {
  type Commands = typeof goals.commands;
  type Planning = typeof goals.planning;
  type Payload = { board_id: string; actor_id: string; idempotency_key: string };
  return {
    goalboard_v1_project_guidance_add: async (input: Record<string, unknown>) => goals.commands.addProjectGuidance({
      board_id: String(input.board_id), actor_id: String(input.actor_id),
      kind: String(input.kind) as Parameters<Commands["addProjectGuidance"]>[0]["kind"],
      content: String(input.content), source_refs: (input.source_refs as string[]) ?? [],
      reason: String(input.reason), confirmation_summary: String(input.confirmation_summary),
      user_confirmed: input.user_confirmed === true, idempotency_key: String(input.idempotency_key),
    }),
    goalboard_v1_project_guidance_update: async (input: Record<string, unknown>) => goals.commands.updateProjectGuidance({
      board_id: String(input.board_id), guidance_id: String(input.guidance_id), actor_id: String(input.actor_id),
      action: String(input.action) as Parameters<Commands["updateProjectGuidance"]>[0]["action"],
      kind: input.kind == null ? undefined : String(input.kind) as Parameters<Commands["updateProjectGuidance"]>[0]["kind"],
      content: input.content == null ? undefined : String(input.content),
      source_refs: input.source_refs == null ? undefined : input.source_refs as string[],
      reason: String(input.reason), confirmation_summary: String(input.confirmation_summary),
      user_confirmed: input.user_confirmed === true, idempotency_key: String(input.idempotency_key),
    }),
    goalboard_v1_planning_method_save: async (input: Record<string, unknown>) => goals.planning.saveProjectMethod({
      board_id: String(input.board_id), method: input.method as Parameters<Planning["saveProjectMethod"]>[0]["method"],
      actor_id: String(input.actor_id), user_confirmed: input.user_confirmed === true,
    }),
    goalboard_v1_planning_analyze_change: async (input: Record<string, unknown>) => goals.planning.analyzeChange(
      String(input.board_id), (input.changed_goal_ids as string[]) ?? [],
    ),
    goalboard_v1_planning_graph_check: async (input: Record<string, unknown>) => goals.planning.validateBoardGraph(String(input.board_id)),
    goalboard_v1_relation_add: async (input: Record<string, unknown>) => {
      const payload = mcpBoardPayload<Payload & { relation: Parameters<Commands["addRelation"]>[1] }>(input);
      return goals.commands.addRelation(payload.board_id, payload.relation, payload);
    },
    goalboard_v1_impact_add: async (input: Record<string, unknown>) => {
      const payload = mcpBoardPayload<Payload & { impact: ImpactFactsInput }>(input);
      return goals.impacts.add(payload.board_id, payload.impact, payload);
    },
    goalboard_v1_policy_set: async (input: Record<string, unknown>) => {
      const payload = mcpBoardPayload<Payload & { binding: Parameters<Commands["setPolicy"]>[1] }>(input);
      return goals.commands.setPolicy(payload.board_id, payload.binding, payload);
    },
    goalboard_v1_risk_add: async (input: Record<string, unknown>) => {
      const payload = mcpBoardPayload<Payload & { risk: Parameters<Commands["addRisk"]>[1] }>(input);
      return goals.commands.addRisk(payload.board_id, payload.risk, payload);
    },
    goalboard_v1_risk_state: async (input: Record<string, unknown>) => {
      const payload = mcpBoardPayload<Payload & { risk: Parameters<Commands["setRiskState"]>[1] }>(input);
      return goals.commands.setRiskState(payload.board_id, payload.risk, {
        actor_id: payload.actor_id, actor_kind: audience === "runtime" ? "runtime" : "user",
        idempotency_key: payload.idempotency_key,
      });
    },
    goalboard_v1_revalidate: async (input: Record<string, unknown>) => goals.lifecycle.revalidate(mcpBoardPayload(input)),
    goalboard_v1_complete: async (input: Record<string, unknown>) => goals.lifecycle.evaluateCompletion(mcpBoardPayload(input)),
  };
}
