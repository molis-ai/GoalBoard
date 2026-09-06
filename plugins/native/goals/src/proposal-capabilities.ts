import type { HostMethodCapability as MethodCapability, LocalHostProjectClient, AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { DraftDialogueApplicationApi } from "./draft-dialogue-contract.js";
import type { GoalTreeApplicationApi } from "./goal-tree-contract.js";
import type { LegacyProposalApplicationApi } from "./legacy-proposal-contract.js";

/** Finite public operations, using the original application parameters/results without a wire bus. */
export const draftDialogueCapabilities = {
  startDraftDialogue: {
    capability_id: "io.goalboard.goals.start-draft-dialogue", version: 1, operation: "command",
  } as MethodCapability<DraftDialogueApplicationApi["startDraftDialogue"]>,
  recordDraftDialogueTurn: {
    capability_id: "io.goalboard.goals.record-draft-dialogue-turn", version: 1, operation: "command",
  } as MethodCapability<DraftDialogueApplicationApi["recordDraftDialogueTurn"]>,
  resumeDraftDialogue: {
    capability_id: "io.goalboard.goals.resume-draft-dialogue", version: 1, operation: "command",
  } as MethodCapability<DraftDialogueApplicationApi["resumeDraftDialogue"]>,
};

export const goalTreeCapabilities = {
  submitGoalTreeProposal: {
    capability_id: "io.goalboard.goals.submit-goal-tree-proposal", version: 1, operation: "command",
  } as MethodCapability<GoalTreeApplicationApi["submitGoalTreeProposal"]>,
  listGoalTreeProposals: {
    capability_id: "io.goalboard.goals.list-goal-tree-proposals", version: 1, operation: "query",
  } as MethodCapability<GoalTreeApplicationApi["listGoalTreeProposals"]>,
  checkGoalTreeProposal: {
    capability_id: "io.goalboard.goals.check-goal-tree-proposal", version: 1, operation: "command",
  } as MethodCapability<GoalTreeApplicationApi["checkGoalTreeProposal"]>,
  decideGoalTreeProposal: {
    capability_id: "io.goalboard.goals.decide-goal-tree-proposal", version: 1, operation: "command",
  } as MethodCapability<GoalTreeApplicationApi["decideGoalTreeProposal"]>,
};

export const legacyProposalsCapabilities = {
  submitContractProposal: {
    capability_id: "io.goalboard.goals.submit-contract-proposal", version: 1, operation: "command",
  } as MethodCapability<LegacyProposalApplicationApi["submitContractProposal"]>,
  decideContractProposal: {
    capability_id: "io.goalboard.goals.decide-contract-proposal", version: 1, operation: "command",
  } as MethodCapability<LegacyProposalApplicationApi["decideContractProposal"]>,
  submitCandidate: {
    capability_id: "io.goalboard.goals.submit-candidate", version: 1, operation: "command",
  } as MethodCapability<LegacyProposalApplicationApi["submitCandidate"]>,
  submitDependencyProposal: {
    capability_id: "io.goalboard.goals.submit-dependency-proposal", version: 1, operation: "command",
  } as MethodCapability<LegacyProposalApplicationApi["submitDependencyProposal"]>,
  decideCandidate: {
    capability_id: "io.goalboard.goals.decide-candidate", version: 1, operation: "command",
  } as MethodCapability<LegacyProposalApplicationApi["decideCandidate"]>,
  confirmRewire: {
    capability_id: "io.goalboard.goals.confirm-rewire", version: 1, operation: "command",
  } as MethodCapability<LegacyProposalApplicationApi["confirmRewire"]>,
};

/** The client serializes calls through the Host; business implementations remain synchronous owners. */
export function createGoalProposalClients(client: LocalHostProjectClient): {
  draftDialogue: AsyncApplicationMethods<DraftDialogueApplicationApi>;
  goalTree: AsyncApplicationMethods<GoalTreeApplicationApi>;
  legacyProposals: AsyncApplicationMethods<LegacyProposalApplicationApi>;
} {
  return {
    draftDialogue: {
      startDraftDialogue: (...input) => client.invoke(draftDialogueCapabilities.startDraftDialogue, input),
      recordDraftDialogueTurn: (...input) => client.invoke(draftDialogueCapabilities.recordDraftDialogueTurn, input),
      resumeDraftDialogue: (...input) => client.invoke(draftDialogueCapabilities.resumeDraftDialogue, input),
    },
    goalTree: {
      submitGoalTreeProposal: (...input) => client.invoke(goalTreeCapabilities.submitGoalTreeProposal, input),
      listGoalTreeProposals: (...input) => client.invoke(goalTreeCapabilities.listGoalTreeProposals, input),
      checkGoalTreeProposal: (...input) => client.invoke(goalTreeCapabilities.checkGoalTreeProposal, input),
      decideGoalTreeProposal: (...input) => client.invoke(goalTreeCapabilities.decideGoalTreeProposal, input),
    },
    legacyProposals: {
      submitContractProposal: (...input) => client.invoke(legacyProposalsCapabilities.submitContractProposal, input),
      decideContractProposal: (...input) => client.invoke(legacyProposalsCapabilities.decideContractProposal, input),
      submitCandidate: (...input) => client.invoke(legacyProposalsCapabilities.submitCandidate, input),
      submitDependencyProposal: (...input) => client.invoke(legacyProposalsCapabilities.submitDependencyProposal, input),
      decideCandidate: (...input) => client.invoke(legacyProposalsCapabilities.decideCandidate, input),
      confirmRewire: (...input) => client.invoke(legacyProposalsCapabilities.confirmRewire, input),
    },
  };
}
