import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { GoalAvailabilityQueryApi, ReadyQuery } from "@adeptify/goalboard-plugin-goals";

/** CLI retains the full query result; it does not choose or claim a Goal. */
export function createCliAvailabilityQueryHandlers(queries: GoalAvailabilityQueryApi | AsyncApplicationMethods<GoalAvailabilityQueryApi>) {
  return {
    ready: async (input: Record<string, unknown>) => queries.queryReady({
      board_id: String(input.board_id), actor_id: String(input.actor_id), role: input.role as ReadyQuery["role"],
      capabilities: (input.capabilities as string[]) ?? [], goal_mode_attestation: Boolean(input.goal_mode_attestation),
    }),
    available: async (input: Record<string, unknown>) => queries.queryAvailable({
      board_id: String(input.board_id), actor_id: String(input.actor_id),
      capabilities: (input.capabilities as string[]) ?? [], goal_mode_attestation: Boolean(input.goal_mode_attestation),
    }),
    explain: async (input: Record<string, unknown>) => queries.explainGoal({
      board_id: String(input.board_id), goal_id: String(input.goal_id), actor_id: String(input.actor_id),
      role: input.role as ReadyQuery["role"], capabilities: (input.capabilities as string[]) ?? [],
      goal_mode_attestation: Boolean(input.goal_mode_attestation),
    }),
  };
}
