import { importV3Capability, projectResumeFactsCapability, trashedGoalsCapability, initializeBoardCapability, snapshotBoardCapability, createGoalCapability } from "@adeptify/goalboard-plugin-goals";
export { importV3Capability, projectResumeFactsCapability, trashedGoalsCapability, initializeBoardCapability, snapshotBoardCapability, createGoalCapability } from "@adeptify/goalboard-plugin-goals";
export type { CreateGoalCapabilityInput, ImportV3CapabilityInput } from "@adeptify/goalboard-plugin-goals";
import { goalsEntryCapabilities, executionEntryCapabilities, goalEntryCompositionCapabilities } from "@adeptify/goalboard-plugin-goals";
import { draftDialogueCapabilities, goalTreeCapabilities, legacyProposalsCapabilities } from "@adeptify/goalboard-plugin-goals";
import { readGoalContractCapability, readProjectGuidanceCapability, setActiveGoalCapability } from "@adeptify/goalboard-plugin-goals";
import path from "node:path";

import {
  LocalHost,
} from "@adeptify/goalboard-app-local-host";
import type {
  LocalHostProjectClient,
  LocalHostProjectReference,
  LocalHostStatus,
} from "@adeptify/goalboard-contracts/platform/app-host";
import type { PlanningMethodPack } from "@adeptify/goalboard-contracts/modules/goals";

import { GoalProjectApplication } from "@adeptify/goalboard-app-local-host";
import { LocalProjectDatabase } from "@adeptify/goalboard-app-local-host";
import { importV3Board } from "../v1/migration.js";
import { pluginDevelopmentCapability } from "@adeptify/goalboard-contracts/platform/tooling";
import { runPluginDevelopment } from "@adeptify/goalboard-app-local-host";
import { SqlitePluginRuntimeRepository, SqlitePluginPrivateStorage } from "@adeptify/goalboard-plugin-runtime";
import { UiHost } from "@adeptify/goalboard-ui-host";

export interface GoalBoardProjectRuntime {
  store: LocalProjectDatabase;
  coordinator: GoalProjectApplication;
}

export interface GoalBoardLocalHostOptions {
  planningMethods?: () => readonly PlanningMethodPack[];
  clock?: () => Date;
  instanceId?: string;
  onRuntimeOpen?: (reference: LocalHostProjectReference) => void;
  onRuntimeClose?: (reference: LocalHostProjectReference) => void;
}

export function goalBoardHostProjectReference(input: {
  databasePath: string;
  boardId: string;
  projectId?: string | null;
}): LocalHostProjectReference {
  const storageKey = path.resolve(input.databasePath);
  const boardId = input.boardId.trim() || `database:${storageKey}`;
  return {
    project_id: input.projectId?.trim() || boardId,
    board_id: boardId,
    storage_key: storageKey,
  };
}

/**
 * Compatibility composition adapter. It is the only legacy location allowed
 * to construct Store + Coordinator while their remaining owners migrate.
 */
export class GoalBoardLocalHost {
  private readonly host: LocalHost<GoalBoardProjectRuntime>;

  constructor(options: GoalBoardLocalHostOptions = {}) {
    this.host = new LocalHost({
      instanceId: options.instanceId,
      runtimeFactory: {
        open: (reference) => {
          options.onRuntimeOpen?.(reference);
          const store = new LocalProjectDatabase(reference.storage_key);
          const coordinator = new GoalProjectApplication(
            store,
            options.clock ?? (() => new Date()),
            [...(options.planningMethods?.() ?? [])],
          );
          return {
            store,
            coordinator,
          };
        },
        close: (runtime, reference) => {
          runtime.store.close();
          options.onRuntimeClose?.(reference);
        },
      },
    });
    this.host.register(pluginDevelopmentCapability, async (runtime, input) => {
      runtime.coordinator.initializeBoard({ board_id: input.board_id, title: "Plugin Development",
        actor_id: input.actor_id, idempotency_key: "plugin-development-board" });
      const privateStorage = new SqlitePluginPrivateStorage(runtime.store.db);
      return runPluginDevelopment(input, { board_id: input.board_id, actor_id: input.actor_id,
        artifacts: runtime.coordinator.artifacts, ui: new UiHost(),
        repository: new SqlitePluginRuntimeRepository(runtime.store.db),
        privateStorageFor: (context, manifest) => privateStorage.forPlugin(context, manifest) });
    });
    this.host.register(goalsEntryCapabilities.commands.addRelation, (runtime, input) =>
      runtime.coordinator.goals.commands.addRelation(...input));
    this.host.register(goalsEntryCapabilities.commands.setPolicy, (runtime, input) =>
      runtime.coordinator.goals.commands.setPolicy(...input));
    this.host.register(goalsEntryCapabilities.commands.addRisk, (runtime, input) =>
      runtime.coordinator.goals.commands.addRisk(...input));
    this.host.register(goalsEntryCapabilities.commands.setRiskState, (runtime, input) =>
      runtime.coordinator.goals.commands.setRiskState(...input));
    this.host.register(goalsEntryCapabilities.commands.addProjectGuidance, (runtime, input) =>
      runtime.coordinator.goals.commands.addProjectGuidance(...input));
    this.host.register(goalsEntryCapabilities.commands.updateProjectGuidance, (runtime, input) =>
      runtime.coordinator.goals.commands.updateProjectGuidance(...input));
    this.host.register(goalsEntryCapabilities.impacts.add, (runtime, input) =>
      runtime.coordinator.goals.impacts.add(...input));
    this.host.register(goalsEntryCapabilities.lifecycle.revalidate, (runtime, input) =>
      runtime.coordinator.goals.lifecycle.revalidate(...input));
    this.host.register(goalsEntryCapabilities.lifecycle.evaluateCompletion, (runtime, input) =>
      runtime.coordinator.goals.lifecycle.evaluateCompletion(...input));
    this.host.register(goalsEntryCapabilities.planning.saveProjectMethod, (runtime, input) =>
      runtime.coordinator.goals.planning.saveProjectMethod(...input));
    this.host.register(goalsEntryCapabilities.planning.analyzeChange, (runtime, input) =>
      runtime.coordinator.goals.planning.analyzeChange(...input));
    this.host.register(goalsEntryCapabilities.planning.validateBoardGraph, (runtime, input) =>
      runtime.coordinator.goals.planning.validateBoardGraph(...input));
    this.host.register(executionEntryCapabilities.claimGoal, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.claimGoal(...input));
    this.host.register(executionEntryCapabilities.renewClaim, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.renewClaim(...input));
    this.host.register(executionEntryCapabilities.selectGoalAndStart, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.selectGoalAndStart(...input));
    this.host.register(executionEntryCapabilities.releaseClaim, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.releaseClaim(...input));
    this.host.register(executionEntryCapabilities.revokeClaim, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.revokeClaim(...input));
    this.host.register(executionEntryCapabilities.startRun, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.startRun(...input));
    this.host.register(executionEntryCapabilities.requestGoalRework, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.requestGoalRework(...input));
    this.host.register(executionEntryCapabilities.reportRun, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.reportRun(...input));
    this.host.register(executionEntryCapabilities.submitEvidence, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.submitEvidence(...input));
    this.host.register(executionEntryCapabilities.correctEvidence, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.correctEvidence(...input));
    this.host.register(executionEntryCapabilities.submitReview, (runtime, input) =>
      runtime.coordinator.executionValidation.commands.submitReview(...input));
    this.host.register(goalEntryCompositionCapabilities.queryReady, (runtime, input) =>
      runtime.coordinator.queryReady(...input));
    this.host.register(goalEntryCompositionCapabilities.queryAvailable, (runtime, input) =>
      runtime.coordinator.queryAvailable(...input));
    this.host.register(goalEntryCompositionCapabilities.explainGoal, (runtime, input) =>
      runtime.coordinator.explainGoal(...input));
    this.host.register(goalEntryCompositionCapabilities.queryAvailableWithProjections, (runtime, [input]) => ({
      available: runtime.coordinator.queryAvailable(input),
      action_projections: runtime.coordinator.executionValidation.query.getGoalActionProjections({ board_id: input.board_id }),
    }));
    this.host.register(goalEntryCompositionCapabilities.setTrashedWithWorkState, (runtime, input) => {
      const result = runtime.coordinator.goals.lifecycle.setTrashed(...input);
      const work_state = runtime.coordinator.executionValidation.query.getGoalWorkState({
        board_id: input[0], goal_id: result.goal.goal_id,
      });
      return { result, work_state };
    });
    this.host.register(goalEntryCompositionCapabilities.readPlanningComposition, (runtime, [boardId]) => ({
      methods: runtime.coordinator.goals.planning.effectiveMethods(boardId),
      composition: runtime.coordinator.goals.planning.projectComposition(boardId),
    }));
    this.host.register(draftDialogueCapabilities.startDraftDialogue, (runtime, input) =>
      runtime.coordinator.draftDialogue.startDraftDialogue(...input));
    this.host.register(draftDialogueCapabilities.recordDraftDialogueTurn, (runtime, input) =>
      runtime.coordinator.draftDialogue.recordDraftDialogueTurn(...input));
    this.host.register(draftDialogueCapabilities.resumeDraftDialogue, (runtime, input) =>
      runtime.coordinator.draftDialogue.resumeDraftDialogue(...input));
    this.host.register(goalTreeCapabilities.submitGoalTreeProposal, (runtime, input) =>
      runtime.coordinator.goalTreeSubmission.submitGoalTreeProposal(...input));
    this.host.register(goalTreeCapabilities.listGoalTreeProposals, (runtime, input) =>
      runtime.coordinator.goalTree.listGoalTreeProposals(...input));
    this.host.register(goalTreeCapabilities.checkGoalTreeProposal, (runtime, input) =>
      runtime.coordinator.goalTreeCheck.checkGoalTreeProposal(...input));
    this.host.register(goalTreeCapabilities.decideGoalTreeProposal, (runtime, input) =>
      runtime.coordinator.goalTreeDecision.decideGoalTreeProposal(...input));
    this.host.register(legacyProposalsCapabilities.submitContractProposal, (runtime, input) =>
      runtime.coordinator.legacyProposalSubmission.submitContractProposal(...input));
    this.host.register(legacyProposalsCapabilities.decideContractProposal, (runtime, input) =>
      runtime.coordinator.legacyContractDecision.decideContractProposal(...input));
    this.host.register(legacyProposalsCapabilities.submitCandidate, (runtime, input) =>
      runtime.coordinator.legacyProposalSubmission.submitCandidate(...input));
    this.host.register(legacyProposalsCapabilities.submitDependencyProposal, (runtime, input) =>
      runtime.coordinator.legacyProposalSubmission.submitDependencyProposal(...input));
    this.host.register(legacyProposalsCapabilities.decideCandidate, (runtime, input) =>
      runtime.coordinator.legacyCandidateDecision.decideCandidate(...input));
    this.host.register(legacyProposalsCapabilities.confirmRewire, (runtime, input) =>
      runtime.coordinator.legacyRewireDecision.confirmRewire(...input));
    this.host.register(readGoalContractCapability, (runtime, input) =>
      runtime.coordinator.goalQueries.readGoalContract(input.board_id, input.goal_id));
    this.host.register(readProjectGuidanceCapability, (runtime, input) =>
      runtime.coordinator.goalQueries.readProjectGuidance(input.board_id));
    this.host.register(setActiveGoalCapability, (runtime, input) =>
      runtime.coordinator.setActiveGoal(input.board_id, input.goal, input.write));
    this.host.register(initializeBoardCapability, (runtime, input) =>
      runtime.coordinator.initializeBoard(input));
    this.host.register(snapshotBoardCapability, (runtime, input) =>
      runtime.store.snapshot(input.board_id));
    this.host.register(importV3Capability, (runtime, { legacy, ...input }) =>
      importV3Board(runtime.store, runtime.coordinator, legacy, input));
    this.host.register(projectResumeFactsCapability, (runtime, input) => {
      const snapshot = runtime.store.snapshot(input.board_id);
      return {
        goals: snapshot.goals,
        projections: runtime.coordinator.executionValidation.query.getGoalActionProjections({
          board_id: input.board_id,
          snapshot,
        }),
      };
    });
    this.host.register(trashedGoalsCapability, (runtime, input) => ({
      goals: runtime.coordinator.goalQueries.listTrashedGoals(input.board_id),
      observed_event_cursor: runtime.store.eventCursor(input.board_id),
    }));
    this.host.register(createGoalCapability, (runtime, input) =>
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

  client(reference: LocalHostProjectReference): LocalHostProjectClient {
    return this.host.client(reference);
  }

  withProject<Result>(
    reference: LocalHostProjectReference,
    operation: (runtime: GoalBoardProjectRuntime) => Result | Promise<Result>,
  ): Promise<Result> {
    return this.host.withRuntime(reference, operation);
  }

  closeProject(referenceOrStorageKey: LocalHostProjectReference | string): Promise<boolean> {
    return this.host.closeProject(referenceOrStorageKey);
  }

  close(): Promise<void> {
    return this.host.close();
  }

  status(): LocalHostStatus {
    return this.host.status();
  }
}

export function createGoalBoardLocalHost(options: GoalBoardLocalHostOptions = {}): GoalBoardLocalHost {
  return new GoalBoardLocalHost(options);
}
