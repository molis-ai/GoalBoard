import { importV3Capability, projectResumeFactsCapability, trashedGoalsCapability, initializeBoardCapability, snapshotBoardCapability, createGoalCapability,
  goalsEntryCapabilities, executionEntryCapabilities, goalEntryCompositionCapabilities,
  draftDialogueCapabilities, goalTreeCapabilities, legacyProposalsCapabilities,
  readGoalContractCapability, readProjectGuidanceCapability, setActiveGoalCapability } from "@adeptify/goalboard-plugin-goals";
import { pluginDevelopmentCapability } from "@adeptify/goalboard-contracts/platform/tooling";
import { SqlitePluginRuntimeRepository, SqlitePluginPrivateStorage } from "@adeptify/goalboard-plugin-runtime";
import { UiHost } from "@adeptify/goalboard-ui-host";
import { runPluginDevelopment } from "./plugin-development.js";
import { importV3Board } from "./board-v3-import.js";
import type { LocalHost } from "./local-host.js";
import type { GoalBoardProjectRuntime } from "./project-host.js";

export function registerProjectCapabilities(host: LocalHost<GoalBoardProjectRuntime>): void {
  host.register(pluginDevelopmentCapability, async (runtime, input) => {
    runtime.coordinator.initializeBoard({ board_id: input.board_id, title: "Plugin Development",
      actor_id: input.actor_id, idempotency_key: "plugin-development-board" });
    const privateStorage = new SqlitePluginPrivateStorage(runtime.store.db);
    return runPluginDevelopment(input, { board_id: input.board_id, actor_id: input.actor_id,
      artifacts: runtime.coordinator.artifacts, ui: new UiHost(),
      repository: new SqlitePluginRuntimeRepository(runtime.store.db),
      privateStorageFor: (context, manifest) => privateStorage.forPlugin(context, manifest) });
  });
  host.register(goalsEntryCapabilities.commands.addRelation, (runtime, input) =>
    runtime.coordinator.goals.commands.addRelation(...input));
  host.register(goalsEntryCapabilities.commands.setPolicy, (runtime, input) =>
    runtime.coordinator.goals.commands.setPolicy(...input));
  host.register(goalsEntryCapabilities.commands.addRisk, (runtime, input) =>
    runtime.coordinator.goals.commands.addRisk(...input));
  host.register(goalsEntryCapabilities.commands.setRiskState, (runtime, input) =>
    runtime.coordinator.goals.commands.setRiskState(...input));
  host.register(goalsEntryCapabilities.commands.addProjectGuidance, (runtime, input) =>
    runtime.coordinator.goals.commands.addProjectGuidance(...input));
  host.register(goalsEntryCapabilities.commands.updateProjectGuidance, (runtime, input) =>
    runtime.coordinator.goals.commands.updateProjectGuidance(...input));
  host.register(goalsEntryCapabilities.impacts.add, (runtime, input) =>
    runtime.coordinator.goals.impacts.add(...input));
  host.register(goalsEntryCapabilities.lifecycle.revalidate, (runtime, input) =>
    runtime.coordinator.goals.lifecycle.revalidate(...input));
  host.register(goalsEntryCapabilities.lifecycle.evaluateCompletion, (runtime, input) =>
    runtime.coordinator.goals.lifecycle.evaluateCompletion(...input));
  host.register(goalsEntryCapabilities.planning.saveProjectMethod, (runtime, input) =>
    runtime.coordinator.goals.planning.saveProjectMethod(...input));
  host.register(goalsEntryCapabilities.planning.analyzeChange, (runtime, input) =>
    runtime.coordinator.goals.planning.analyzeChange(...input));
  host.register(goalsEntryCapabilities.planning.validateBoardGraph, (runtime, input) =>
    runtime.coordinator.goals.planning.validateBoardGraph(...input));
  host.register(executionEntryCapabilities.claimGoal, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.claimGoal(...input));
  host.register(executionEntryCapabilities.renewClaim, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.renewClaim(...input));
  host.register(executionEntryCapabilities.selectGoalAndStart, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.selectGoalAndStart(...input));
  host.register(executionEntryCapabilities.releaseClaim, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.releaseClaim(...input));
  host.register(executionEntryCapabilities.revokeClaim, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.revokeClaim(...input));
  host.register(executionEntryCapabilities.startRun, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.startRun(...input));
  host.register(executionEntryCapabilities.requestGoalRework, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.requestGoalRework(...input));
  host.register(executionEntryCapabilities.reportRun, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.reportRun(...input));
  host.register(executionEntryCapabilities.submitEvidence, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.submitEvidence(...input));
  host.register(executionEntryCapabilities.correctEvidence, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.correctEvidence(...input));
  host.register(executionEntryCapabilities.submitReview, (runtime, input) =>
    runtime.coordinator.executionValidation.commands.submitReview(...input));
  host.register(goalEntryCompositionCapabilities.queryReady, (runtime, input) =>
    runtime.coordinator.queryReady(...input));
  host.register(goalEntryCompositionCapabilities.queryAvailable, (runtime, input) =>
    runtime.coordinator.queryAvailable(...input));
  host.register(goalEntryCompositionCapabilities.explainGoal, (runtime, input) =>
    runtime.coordinator.explainGoal(...input));
  host.register(goalEntryCompositionCapabilities.queryAvailableWithProjections, (runtime, [input]) => ({
    available: runtime.coordinator.queryAvailable(input),
    action_projections: runtime.coordinator.executionValidation.query.getGoalActionProjections({ board_id: input.board_id }),
  }));
  host.register(goalEntryCompositionCapabilities.setTrashedWithWorkState, (runtime, input) => {
    const result = runtime.coordinator.goals.lifecycle.setTrashed(...input);
    const work_state = runtime.coordinator.executionValidation.query.getGoalWorkState({
      board_id: input[0], goal_id: result.goal.goal_id,
    });
    return { result, work_state };
  });
  host.register(goalEntryCompositionCapabilities.readPlanningComposition, (runtime, [boardId]) => ({
    methods: runtime.coordinator.goals.planning.effectiveMethods(boardId),
    composition: runtime.coordinator.goals.planning.projectComposition(boardId),
  }));
  host.register(draftDialogueCapabilities.startDraftDialogue, (runtime, input) =>
    runtime.coordinator.draftDialogue.startDraftDialogue(...input));
  host.register(draftDialogueCapabilities.recordDraftDialogueTurn, (runtime, input) =>
    runtime.coordinator.draftDialogue.recordDraftDialogueTurn(...input));
  host.register(draftDialogueCapabilities.resumeDraftDialogue, (runtime, input) =>
    runtime.coordinator.draftDialogue.resumeDraftDialogue(...input));
  host.register(goalTreeCapabilities.submitGoalTreeProposal, (runtime, input) =>
    runtime.coordinator.goalTreeSubmission.submitGoalTreeProposal(...input));
  host.register(goalTreeCapabilities.listGoalTreeProposals, (runtime, input) =>
    runtime.coordinator.goalTree.listGoalTreeProposals(...input));
  host.register(goalTreeCapabilities.checkGoalTreeProposal, (runtime, input) =>
    runtime.coordinator.goalTreeCheck.checkGoalTreeProposal(...input));
  host.register(goalTreeCapabilities.decideGoalTreeProposal, (runtime, input) =>
    runtime.coordinator.goalTreeDecision.decideGoalTreeProposal(...input));
  host.register(legacyProposalsCapabilities.submitContractProposal, (runtime, input) =>
    runtime.coordinator.legacyProposalSubmission.submitContractProposal(...input));
  host.register(legacyProposalsCapabilities.decideContractProposal, (runtime, input) =>
    runtime.coordinator.legacyContractDecision.decideContractProposal(...input));
  host.register(legacyProposalsCapabilities.submitCandidate, (runtime, input) =>
    runtime.coordinator.legacyProposalSubmission.submitCandidate(...input));
  host.register(legacyProposalsCapabilities.submitDependencyProposal, (runtime, input) =>
    runtime.coordinator.legacyProposalSubmission.submitDependencyProposal(...input));
  host.register(legacyProposalsCapabilities.decideCandidate, (runtime, input) =>
    runtime.coordinator.legacyCandidateDecision.decideCandidate(...input));
  host.register(legacyProposalsCapabilities.confirmRewire, (runtime, input) =>
    runtime.coordinator.legacyRewireDecision.confirmRewire(...input));
  host.register(readGoalContractCapability, (runtime, input) =>
    runtime.coordinator.goalQueries.readGoalContract(input.board_id, input.goal_id));
  host.register(readProjectGuidanceCapability, (runtime, input) =>
    runtime.coordinator.goalQueries.readProjectGuidance(input.board_id));
  host.register(setActiveGoalCapability, (runtime, input) =>
    runtime.coordinator.setActiveGoal(input.board_id, input.goal, input.write));
  host.register(initializeBoardCapability, (runtime, input) =>
    runtime.coordinator.initializeBoard(input));
  host.register(snapshotBoardCapability, (runtime, input) =>
    runtime.store.snapshot(input.board_id));
  host.register(importV3Capability, (runtime, { legacy, ...input }) =>
    importV3Board(runtime.store, runtime.coordinator, legacy, input));
  host.register(projectResumeFactsCapability, (runtime, input) => {
    const snapshot = runtime.store.snapshot(input.board_id);
    return {
      goals: snapshot.goals,
      projections: runtime.coordinator.executionValidation.query.getGoalActionProjections({
        board_id: input.board_id,
        snapshot,
      }),
    };
  });
  host.register(trashedGoalsCapability, (runtime, input) => ({
    goals: runtime.coordinator.goalQueries.listTrashedGoals(input.board_id),
    observed_event_cursor: runtime.store.eventCursor(input.board_id),
  }));
  host.register(createGoalCapability, (runtime, input) =>
    runtime.coordinator.goals.commands.createGoal(
      input.board_id,
      input.goal,
      {
        actor_id: input.actor_id,
        idempotency_key: input.idempotency_key,
        reason: input.reason,
      },
    ));
}
