import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { GoalEntryCompositionApi, ReadyQuery } from "@adeptify/goalboard-plugin-goals";
import { availableResponse, type McpPresentationErrorFactory } from "./query-presentation.js";

/** The owner computes eligibility; this adapter controls only wire arguments and presentation. */
export function createMcpAvailabilityToolHandlers(
  queries: GoalEntryCompositionApi | AsyncApplicationMethods<GoalEntryCompositionApi>,
  createError: McpPresentationErrorFactory,
) {
  return {
    goalboard_v1_ready: async (input: Record<string, unknown>) => ({
      result: await queries.queryReady({
        board_id: String(input.board_id), actor_id: String(input.actor_id), role: input.role as ReadyQuery["role"],
        capabilities: (input.capabilities as string[]) ?? [], goal_mode_attestation: Boolean(input.goal_mode_attestation),
      }),
      prettyPrint: true,
    }),
    goalboard_v1_available: async (input: Record<string, unknown>) => {
      const detailLevel = input.detail_level == null ? "summary" : String(input.detail_level);
      if (detailLevel !== "summary" && detailLevel !== "full") {
        throw createError("available.detail_level_invalid", `detail_level=${detailLevel}；allowed: summary, full`, {
          field: "detail_level", received_value: detailLevel, allowed_values: ["summary", "full"],
        });
      }
      const facts = await queries.queryAvailableWithProjections({
        board_id: String(input.board_id), actor_id: String(input.actor_id),
        capabilities: (input.capabilities as string[]) ?? [], goal_mode_attestation: Boolean(input.goal_mode_attestation),
      });
      const legacyAvailable = availableResponse(facts.available, detailLevel);
      return {
        result: { ...legacyAvailable, action_projections: facts.action_projections },
        prettyPrint: detailLevel === "full",
      };
    },
    goalboard_v1_explain: async (input: Record<string, unknown>) => ({
      result: await queries.explainGoal({
        board_id: String(input.board_id), goal_id: String(input.goal_id), actor_id: String(input.actor_id),
        role: input.role as ReadyQuery["role"], capabilities: (input.capabilities as string[]) ?? [],
        goal_mode_attestation: Boolean(input.goal_mode_attestation),
      }),
      prettyPrint: true,
    }),
  };
}
