import type { GoalsEntryApi, AsyncGoalsEntryApi } from "@adeptify/goalboard-plugin-goals";
import type { ImpactFactsInput } from "@adeptify/goalboard-contracts/modules/goals";

/** Named CLI conversions only; Goals retains business validation and transitions. */
export function createCliGoalCommandHandlers<TTransition>(goals: GoalsEntryApi<TTransition> | AsyncGoalsEntryApi<TTransition>) {
  type Commands = typeof goals.commands;
  type Lifecycle = typeof goals.lifecycle;
  const actor = (input: Record<string, unknown>) => ({
    actor_id: String(input.actor_id), idempotency_key: String(input.idempotency_key),
  });
  return {
    "relation-add": async (input: Record<string, unknown>) => goals.commands.addRelation(
      String(input.board_id), input.relation as Parameters<Commands["addRelation"]>[1],
      { ...actor(input), reason: input.reason == null ? undefined : String(input.reason) },
    ),
    "impact-add": async (input: Record<string, unknown>) => goals.impacts.add(
      String(input.board_id), input.impact as ImpactFactsInput, actor(input),
    ),
    "policy-set": async (input: Record<string, unknown>) => goals.commands.setPolicy(
      String(input.board_id), input.binding as Parameters<Commands["setPolicy"]>[1], actor(input),
    ),
    "risk-add": async (input: Record<string, unknown>) => goals.commands.addRisk(
      String(input.board_id), input.risk as Parameters<Commands["addRisk"]>[1], actor(input),
    ),
    "risk-state": async (input: Record<string, unknown>) => goals.commands.setRiskState(
      String(input.board_id), input.risk as Parameters<Commands["setRiskState"]>[1], actor(input),
    ),
    revalidate: async (input: Record<string, unknown>) => goals.lifecycle.revalidate(
      input as unknown as Parameters<Lifecycle["revalidate"]>[0],
    ),
    complete: async (input: Record<string, unknown>) => goals.lifecycle.evaluateCompletion(
      input as unknown as Parameters<Lifecycle["evaluateCompletion"]>[0],
    ),
  };
}
