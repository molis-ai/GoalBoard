import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { LegacyProposalApplicationApi } from "@adeptify/goalboard-plugin-goals";

/** Wire conversion only; the application retains validation and transaction ownership. */
export function createCliLegacyProposalHandlers(application: LegacyProposalApplicationApi | AsyncApplicationMethods<LegacyProposalApplicationApi>) {
  return {
    "contract-propose": async (input: Record<string, unknown>) =>
      application.submitContractProposal(input as unknown as Parameters<LegacyProposalApplicationApi["submitContractProposal"]>[0]),
    "contract-decide": async (input: Record<string, unknown>) =>
      application.decideContractProposal(input as unknown as Parameters<LegacyProposalApplicationApi["decideContractProposal"]>[0]),
    "candidate-submit": async (input: Record<string, unknown>) =>
      application.submitCandidate(input as unknown as Parameters<LegacyProposalApplicationApi["submitCandidate"]>[0]),
    "dependency-propose": async (input: Record<string, unknown>) =>
      application.submitDependencyProposal(input as unknown as Parameters<LegacyProposalApplicationApi["submitDependencyProposal"]>[0]),
    "candidate-decide": async (input: Record<string, unknown>) =>
      application.decideCandidate(input as unknown as Parameters<LegacyProposalApplicationApi["decideCandidate"]>[0]),
    "rewire-confirm": async (input: Record<string, unknown>) =>
      application.confirmRewire(input as unknown as Parameters<LegacyProposalApplicationApi["confirmRewire"]>[0]),
  };
}
