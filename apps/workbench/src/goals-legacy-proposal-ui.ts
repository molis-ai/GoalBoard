import type { UiHostApi, UiSlotDescriptor } from "@adeptify/goalboard-contracts/platform/ui";
import { GOALS_LEGACY_PROPOSAL_UI_CONTRIBUTION_ID, type GoalsLegacyProposalRenderer, type GoalsLegacyProposalUiPrimitives } from "@adeptify/goalboard-plugin-goals";

export function createGoalsLegacyProposalWorkbenchRenderer(host: UiHostApi, slot: UiSlotDescriptor) {
  return (primitives: GoalsLegacyProposalUiPrimitives): GoalsLegacyProposalRenderer => ({
    renderRewireDecision: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_LEGACY_PROPOSAL_UI_CONTRIBUTION_ID, surface: "rewire", model: { kind: "rewire", args, primitives } } }).html,
    renderResolvedDependencyHistory: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_LEGACY_PROPOSAL_UI_CONTRIBUTION_ID, surface: "dependency-history", model: { kind: "dependency-history", args, primitives } } }).html,
    renderContractProposal: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_LEGACY_PROPOSAL_UI_CONTRIBUTION_ID, surface: "contract", model: { kind: "contract", args, primitives } } }).html,
    renderCandidateDecision: (...args) => host.mount({ slot, contribution: { contribution_id: GOALS_LEGACY_PROPOSAL_UI_CONTRIBUTION_ID, surface: "candidate", model: { kind: "candidate", args, primitives } } }).html,
  });
}
