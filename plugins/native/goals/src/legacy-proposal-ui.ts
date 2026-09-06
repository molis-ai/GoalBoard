import type { UiContribution } from "@adeptify/goalboard-contracts/platform/ui";
import { createLegacyRewireRenderer } from "./legacy-rewire-ui.js";
import { createLegacyContractRenderer } from "./legacy-contract-ui.js";
import { createLegacyCandidateRenderer } from "./legacy-candidate-ui.js";
import type { GoalsLegacyProposalUiPrimitives } from "./legacy-proposal-ui-model.js";

export const GOALS_LEGACY_PROPOSAL_UI_CONTRIBUTION_ID = "io.goalboard.native.goals.legacy-proposal";
export type GoalsLegacyProposalRenderer = ReturnType<typeof createLegacyRewireRenderer> & ReturnType<typeof createLegacyContractRenderer> & ReturnType<typeof createLegacyCandidateRenderer>;
export type GoalsLegacyProposalUiModel = { primitives: GoalsLegacyProposalUiPrimitives } & (
  | { kind: "rewire"; args: Parameters<GoalsLegacyProposalRenderer["renderRewireDecision"]> }
  | { kind: "dependency-history"; args: Parameters<GoalsLegacyProposalRenderer["renderResolvedDependencyHistory"]> }
  | { kind: "contract"; args: Parameters<GoalsLegacyProposalRenderer["renderContractProposal"]> }
  | { kind: "candidate"; args: Parameters<GoalsLegacyProposalRenderer["renderCandidateDecision"]> }
);
export const goalsLegacyProposalUiContribution: UiContribution<GoalsLegacyProposalUiModel> = {
  descriptor: { contribution_id: GOALS_LEGACY_PROPOSAL_UI_CONTRIBUTION_ID, plugin_id: "io.goalboard.native.goals", kind: "embedded", label: "Historical proposal decisions",
    surfaces: ["rewire", "dependency-history", "contract", "candidate"].map(surface_id => ({ surface_id, target_slot_id: "workbench.main", format: "declarative-html" })), slots: [] },
  render({ surface, model }) {
    if (surface !== model.kind) throw new Error("Historical proposal surface does not match its model");
    switch (model.kind) {
      case "rewire": return createLegacyRewireRenderer(model.primitives).renderRewireDecision(...model.args);
      case "dependency-history": return createLegacyRewireRenderer(model.primitives).renderResolvedDependencyHistory(...model.args);
      case "contract": return createLegacyContractRenderer(model.primitives).renderContractProposal(...model.args);
      case "candidate": return createLegacyCandidateRenderer(model.primitives).renderCandidateDecision(...model.args);
    }
  },
};
