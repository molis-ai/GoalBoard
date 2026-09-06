import type { HostMethodCapability, LocalHostProjectClient, AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { ExecutionValidationCommandApi } from "./execution-validation-contract.js";

/** Runtime entry commands deliberately exclude trusted human-review submission. */
export type ExecutionEntryCommands = Omit<ExecutionValidationCommandApi, "submitHumanReview">;

export const executionEntryCapabilities = {
  claimGoal: {
    capability_id: "io.goalboard.execution.claim-goal", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["claimGoal"]>,
  renewClaim: {
    capability_id: "io.goalboard.execution.renew-claim", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["renewClaim"]>,
  selectGoalAndStart: {
    capability_id: "io.goalboard.execution.select-goal-and-start", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["selectGoalAndStart"]>,
  releaseClaim: {
    capability_id: "io.goalboard.execution.release-claim", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["releaseClaim"]>,
  revokeClaim: {
    capability_id: "io.goalboard.execution.revoke-claim", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["revokeClaim"]>,
  startRun: {
    capability_id: "io.goalboard.execution.start-run", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["startRun"]>,
  requestGoalRework: {
    capability_id: "io.goalboard.execution.request-goal-rework", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["requestGoalRework"]>,
  reportRun: {
    capability_id: "io.goalboard.execution.report-run", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["reportRun"]>,
  submitEvidence: {
    capability_id: "io.goalboard.execution.submit-evidence", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["submitEvidence"]>,
  correctEvidence: {
    capability_id: "io.goalboard.execution.correct-evidence", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["correctEvidence"]>,
  submitReview: {
    capability_id: "io.goalboard.execution.submit-review", version: 1, operation: "command",
  } as HostMethodCapability<ExecutionEntryCommands["submitReview"]>,
};

export function createExecutionEntryClient(client: LocalHostProjectClient): AsyncApplicationMethods<ExecutionEntryCommands> {
  return {
    claimGoal: (...input) => client.invoke(executionEntryCapabilities.claimGoal, input),
    renewClaim: (...input) => client.invoke(executionEntryCapabilities.renewClaim, input),
    selectGoalAndStart: (...input) => client.invoke(executionEntryCapabilities.selectGoalAndStart, input),
    releaseClaim: (...input) => client.invoke(executionEntryCapabilities.releaseClaim, input),
    revokeClaim: (...input) => client.invoke(executionEntryCapabilities.revokeClaim, input),
    startRun: (...input) => client.invoke(executionEntryCapabilities.startRun, input),
    requestGoalRework: (...input) => client.invoke(executionEntryCapabilities.requestGoalRework, input),
    reportRun: (...input) => client.invoke(executionEntryCapabilities.reportRun, input),
    submitEvidence: (...input) => client.invoke(executionEntryCapabilities.submitEvidence, input),
    correctEvidence: (...input) => client.invoke(executionEntryCapabilities.correctEvidence, input),
    submitReview: (...input) => client.invoke(executionEntryCapabilities.submitReview, input),
  };
}
