import type { GoalsApplicationApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { HostMethodCapability, LocalHostProjectClient, AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { ActionTransitionReceipt } from "./execution-validation-contract.js";

/** Only the existing CLI/MCP command surface; no additional Module commands are exposed. */
export interface GoalsEntryApi<TTransition = ActionTransitionReceipt> {
  commands: Pick<GoalsApplicationApi<TTransition>["commands"], "addRelation" | "setPolicy" | "addRisk" | "setRiskState" | "addProjectGuidance" | "updateProjectGuidance">;
  impacts: Pick<GoalsApplicationApi<TTransition>["impacts"], "add">;
  lifecycle: Pick<GoalsApplicationApi<TTransition>["lifecycle"], "revalidate" | "evaluateCompletion">;
  planning: Pick<GoalsApplicationApi<TTransition>["planning"], "saveProjectMethod" | "analyzeChange" | "validateBoardGraph">;
}

export type AsyncGoalsEntryApi<TTransition = ActionTransitionReceipt> = {
  [Group in keyof GoalsEntryApi<TTransition>]: AsyncApplicationMethods<GoalsEntryApi<TTransition>[Group]>;
};

export const goalsEntryCapabilities = {
  commands: {
    addRelation: {
      capability_id: "io.goalboard.goals.commands.add-relation", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["commands"]["addRelation"]>,
    setPolicy: {
      capability_id: "io.goalboard.goals.commands.set-policy", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["commands"]["setPolicy"]>,
    addRisk: {
      capability_id: "io.goalboard.goals.commands.add-risk", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["commands"]["addRisk"]>,
    setRiskState: {
      capability_id: "io.goalboard.goals.commands.set-risk-state", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["commands"]["setRiskState"]>,
    addProjectGuidance: {
      capability_id: "io.goalboard.goals.commands.add-project-guidance", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["commands"]["addProjectGuidance"]>,
    updateProjectGuidance: {
      capability_id: "io.goalboard.goals.commands.update-project-guidance", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["commands"]["updateProjectGuidance"]>,
  },
  impacts: {
    add: {
      capability_id: "io.goalboard.goals.impacts.add", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["impacts"]["add"]>,
  },
  lifecycle: {
    revalidate: {
      capability_id: "io.goalboard.goals.lifecycle.revalidate", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["lifecycle"]["revalidate"]>,
    evaluateCompletion: {
      capability_id: "io.goalboard.goals.lifecycle.evaluate-completion", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["lifecycle"]["evaluateCompletion"]>,
  },
  planning: {
    saveProjectMethod: {
      capability_id: "io.goalboard.goals.planning.save-project-method", version: 1, operation: "command",
    } as HostMethodCapability<GoalsEntryApi["planning"]["saveProjectMethod"]>,
    analyzeChange: {
      capability_id: "io.goalboard.goals.planning.analyze-change", version: 1, operation: "query",
    } as HostMethodCapability<GoalsEntryApi["planning"]["analyzeChange"]>,
    validateBoardGraph: {
      capability_id: "io.goalboard.goals.planning.validate-board-graph", version: 1, operation: "query",
    } as HostMethodCapability<GoalsEntryApi["planning"]["validateBoardGraph"]>,
  },
};

export function createGoalsEntryClient(client: LocalHostProjectClient): AsyncGoalsEntryApi {
  return {
    commands: {
      addRelation: (...input) => client.invoke(goalsEntryCapabilities.commands.addRelation, input),
      setPolicy: (...input) => client.invoke(goalsEntryCapabilities.commands.setPolicy, input),
      addRisk: (...input) => client.invoke(goalsEntryCapabilities.commands.addRisk, input),
      setRiskState: (...input) => client.invoke(goalsEntryCapabilities.commands.setRiskState, input),
      addProjectGuidance: (...input) => client.invoke(goalsEntryCapabilities.commands.addProjectGuidance, input),
      updateProjectGuidance: (...input) => client.invoke(goalsEntryCapabilities.commands.updateProjectGuidance, input),
    },
    impacts: {
      add: (...input) => client.invoke(goalsEntryCapabilities.impacts.add, input),
    },
    lifecycle: {
      revalidate: (...input) => client.invoke(goalsEntryCapabilities.lifecycle.revalidate, input),
      evaluateCompletion: (...input) => client.invoke(goalsEntryCapabilities.lifecycle.evaluateCompletion, input),
    },
    planning: {
      saveProjectMethod: (...input) => client.invoke(goalsEntryCapabilities.planning.saveProjectMethod, input),
      analyzeChange: (...input) => client.invoke(goalsEntryCapabilities.planning.analyzeChange, input),
      validateBoardGraph: (...input) => client.invoke(goalsEntryCapabilities.planning.validateBoardGraph, input),
    },
  };
}
