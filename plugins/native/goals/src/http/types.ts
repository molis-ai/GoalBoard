import type { GoalsApplicationApi, GoalsCommandApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalEventApplication } from "../goal-event-application.js";
import type { BoardSnapshot } from "../goal-entry-contract.js";
import type { ActionTransitionReceipt, ExecutionValidationApplicationApi } from "../execution-validation-contract.js";
import type { GoalReadApplication } from "../goal-query-application.js";
import type { GoalTreeWebDecisionInput } from "../goal-tree-web-decision-input.js";
import type { GoalTreeDecisionApplication } from "../goal-tree-decision.js";
import type { LegacyContractDecisionApplication } from "../legacy-contract-decision.js";
import type { LegacyCandidateDecisionApplication } from "../legacy-candidate-decision.js";
import type { LegacyRewireDecisionApplication } from "../legacy-rewire-decision.js";

/** Host authenticates the channel; Native Goals interprets only the selected product operation. */
export interface GoalsHttpContext {
  method: string | undefined;
  pathname: string;
  search: URLSearchParams;
  readBody(): Promise<Record<string, unknown>>;
  respond(status: number, body: unknown): void;
  options: { boardId: string; routePrefix: string; projectRoot?: string };
  idempotencyHeader: string | string[] | undefined;
  snapshot(): BoardSnapshot;
  changed(): void;
  commands: GoalsApplicationApi<ActionTransitionReceipt>["commands"];
  impacts: GoalsApplicationApi<ActionTransitionReceipt>["impacts"];
  lifecycle: GoalsApplicationApi<ActionTransitionReceipt>["lifecycle"];
  query: Pick<GoalReadApplication, "readGoalContract" | "readProjectGuidance">;
  executionCommands: Pick<ExecutionValidationApplicationApi<BoardSnapshot>["commands"], "submitHumanReview" | "submitEvidence">;
  setActiveGoal: GoalsCommandApi["setActiveGoal"];
  goalTreeWebInput: Pick<GoalTreeWebDecisionInput, "prepareRiskRepair" | "prepareDecision">;
  goalTreeDecision: Pick<GoalTreeDecisionApplication, "decideGoalTreeProposal">;
  legacyContractDecision: Pick<LegacyContractDecisionApplication, "decideContractProposal">;
  legacyCandidateDecision: Pick<LegacyCandidateDecisionApplication, "decideCandidate">;
  legacyRewireDecision: Pick<LegacyRewireDecisionApplication, "confirmRewire">;
  goalEvents: Pick<GoalEventApplication,
    | "readState"
    | "configure"
    | "report"
    | "listLatestEvents"
    | "listLatestTimeline"
    | "readEvent"
    | "recordProgress"
    | "applyConcern"
    | "requestDecision"
    | "recordTrustedDecision"
    | "setAgreement"
    | "submitClosure"
    | "resumeWork"
    | "continueWithEventWork"
    | "isEventStateOwner"
    | "recordNote"
    | "reopenCompletedEventWork"
  >;
  journalEvents(): import("../decision-view.js").GoalsDecisionEvent[];
}
