import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { ExecutionEntryCommands } from "@adeptify/goalboard-plugin-goals";

/** Adapt existing CLI payloads to named application commands; the owner validates them. */
export function createCliExecutionCommandHandlers(commands: ExecutionEntryCommands | AsyncApplicationMethods<ExecutionEntryCommands>) {
  return {
    "claim": async (input: Record<string, unknown>) =>
      commands.claimGoal(input as unknown as Parameters<ExecutionEntryCommands["claimGoal"]>[0]),
    "select-goal": async (input: Record<string, unknown>) =>
      commands.selectGoalAndStart(input as unknown as Parameters<ExecutionEntryCommands["selectGoalAndStart"]>[0]),
    "release": async (input: Record<string, unknown>) =>
      commands.releaseClaim(input as unknown as Parameters<ExecutionEntryCommands["releaseClaim"]>[0]),
    "revoke": async (input: Record<string, unknown>) =>
      commands.revokeClaim(input as unknown as Parameters<ExecutionEntryCommands["revokeClaim"]>[0]),
    "run-start": async (input: Record<string, unknown>) =>
      commands.startRun(input as unknown as Parameters<ExecutionEntryCommands["startRun"]>[0]),
    "run-report": async (input: Record<string, unknown>) =>
      commands.reportRun(input as unknown as Parameters<ExecutionEntryCommands["reportRun"]>[0]),
    "evidence-submit": async (input: Record<string, unknown>) =>
      commands.submitEvidence(input as unknown as Parameters<ExecutionEntryCommands["submitEvidence"]>[0]),
    "review-submit": async (input: Record<string, unknown>) =>
      commands.submitReview(input as unknown as Parameters<ExecutionEntryCommands["submitReview"]>[0]),
  };
}
