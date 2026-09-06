import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { ExecutionEntryCommands } from "@adeptify/goalboard-plugin-goals";
import { mcpBoardPayload } from "./payload.js";

type EvidenceLocatorContext = NonNullable<Parameters<ExecutionEntryCommands["submitEvidence"]>[0]["locator_context"]>;

/** The host has already checked audience, connection and impersonation before dispatch. */
export function createMcpExecutionToolHandlers(
  commands: ExecutionEntryCommands | AsyncApplicationMethods<ExecutionEntryCommands>,
  evidenceLocatorContext: () => EvidenceLocatorContext,
) {
  return {
    "goalboard_v1_claim": async (input: Record<string, unknown>) =>
      commands.claimGoal(input as unknown as Parameters<ExecutionEntryCommands["claimGoal"]>[0]),
    "goalboard_v1_select_goal": async (input: Record<string, unknown>) =>
      commands.selectGoalAndStart(input as unknown as Parameters<ExecutionEntryCommands["selectGoalAndStart"]>[0]),
    "goalboard_v1_release": async (input: Record<string, unknown>) =>
      commands.releaseClaim(mcpBoardPayload(input)),
    "goalboard_v1_claim_renew": async (input: Record<string, unknown>) =>
      commands.renewClaim(mcpBoardPayload(input)),
    "goalboard_v1_revoke_claim": async (input: Record<string, unknown>) =>
      commands.revokeClaim(mcpBoardPayload(input)),
    "goalboard_v1_run_start": async (input: Record<string, unknown>) =>
      commands.startRun(mcpBoardPayload(input)),
    "goalboard_v1_rework_request": async (input: Record<string, unknown>) =>
      commands.requestGoalRework(mcpBoardPayload(input)),
    "goalboard_v1_run_report": async (input: Record<string, unknown>) =>
      commands.reportRun(mcpBoardPayload(input)),
    "goalboard_v1_evidence_correct": async (input: Record<string, unknown>) =>
      commands.correctEvidence(mcpBoardPayload(input)),
    "goalboard_v1_review_submit": async (input: Record<string, unknown>) =>
      commands.submitReview(mcpBoardPayload(input)),
    goalboard_v1_evidence_submit: async (input: Record<string, unknown>) => {
      const locatorContext = evidenceLocatorContext();
      return commands.submitEvidence({
        ...mcpBoardPayload<Parameters<ExecutionEntryCommands["submitEvidence"]>[0]>(input),
        locator_context: locatorContext,
      });
    },
  };
}
