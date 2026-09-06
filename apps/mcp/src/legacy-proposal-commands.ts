import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { LegacyProposalApplicationApi } from "@adeptify/goalboard-plugin-goals";
import { mcpBoardPayload } from "./payload.js";

/** Wire conversion only; authority is supplied by the host before dispatch. */
export function createMcpLegacyProposalHandlers(application: LegacyProposalApplicationApi | AsyncApplicationMethods<LegacyProposalApplicationApi>) {
  return {
    goalboard_v1_contract_propose: async (args: Record<string, unknown>) =>
      application.submitContractProposal(mcpBoardPayload(args)),
    goalboard_v1_contract_decide: async (args: Record<string, unknown>) =>
      application.decideContractProposal(mcpBoardPayload(args)),
    goalboard_v1_candidate_submit: async (args: Record<string, unknown>) =>
      application.submitCandidate(mcpBoardPayload(args)),
    goalboard_v1_dependency_propose: async (args: Record<string, unknown>) =>
      application.submitDependencyProposal(mcpBoardPayload(args)),
    goalboard_v1_candidate_decide: async (args: Record<string, unknown>) =>
      application.decideCandidate(mcpBoardPayload(args)),
    goalboard_v1_rewire_confirm: async (args: Record<string, unknown>) =>
      application.confirmRewire(mcpBoardPayload(args)),
  };
}
