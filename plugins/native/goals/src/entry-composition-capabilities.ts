import type { GoalsApplicationApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { HostMethodCapability, LocalHostProjectClient, AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { GoalAvailabilityQueryApi } from "./availability-contract.js";
import type { GoalActionProjection, GoalWorkStateView } from "./execution-validation-contract.js";

/** Each combined method preserves the existing uninterrupted owner calls for one response. */
export interface GoalEntryCompositionApi extends GoalAvailabilityQueryApi {
  queryAvailableWithProjections(input: Parameters<GoalAvailabilityQueryApi["queryAvailable"]>[0]): {
    available: ReturnType<GoalAvailabilityQueryApi["queryAvailable"]>;
    action_projections: GoalActionProjection[];
  };
  setTrashedWithWorkState(...input: Parameters<GoalsApplicationApi["lifecycle"]["setTrashed"]>): {
    result: ReturnType<GoalsApplicationApi["lifecycle"]["setTrashed"]>;
    work_state: GoalWorkStateView;
  };
  readPlanningComposition(boardId: string): {
    methods: ReturnType<GoalsApplicationApi["planning"]["effectiveMethods"]>;
    composition: ReturnType<GoalsApplicationApi["planning"]["projectComposition"]>;
  };
}

export const goalEntryCompositionCapabilities = {
  queryReady: {
    capability_id: "io.goalboard.goals.ready", version: 1, operation: "query",
  } as HostMethodCapability<GoalEntryCompositionApi["queryReady"]>,
  queryAvailable: {
    capability_id: "io.goalboard.goals.available", version: 1, operation: "query",
  } as HostMethodCapability<GoalEntryCompositionApi["queryAvailable"]>,
  explainGoal: {
    capability_id: "io.goalboard.goals.explain", version: 1, operation: "query",
  } as HostMethodCapability<GoalEntryCompositionApi["explainGoal"]>,
  queryAvailableWithProjections: {
    capability_id: "io.goalboard.goals.available-with-projections", version: 1, operation: "query",
  } as HostMethodCapability<GoalEntryCompositionApi["queryAvailableWithProjections"]>,
  setTrashedWithWorkState: {
    capability_id: "io.goalboard.goals.trash-with-work-state", version: 1, operation: "command",
  } as HostMethodCapability<GoalEntryCompositionApi["setTrashedWithWorkState"]>,
  readPlanningComposition: {
    capability_id: "io.goalboard.goals.planning-composition", version: 1, operation: "query",
  } as HostMethodCapability<GoalEntryCompositionApi["readPlanningComposition"]>,
};

export function createGoalEntryCompositionClient(client: LocalHostProjectClient): AsyncApplicationMethods<GoalEntryCompositionApi> {
  return {
    queryReady: (...input) => client.invoke(goalEntryCompositionCapabilities.queryReady, input),
    queryAvailable: (...input) => client.invoke(goalEntryCompositionCapabilities.queryAvailable, input),
    explainGoal: (...input) => client.invoke(goalEntryCompositionCapabilities.explainGoal, input),
    queryAvailableWithProjections: (...input) => client.invoke(goalEntryCompositionCapabilities.queryAvailableWithProjections, input),
    setTrashedWithWorkState: (...input) => client.invoke(goalEntryCompositionCapabilities.setTrashedWithWorkState, input),
    readPlanningComposition: (...input) => client.invoke(goalEntryCompositionCapabilities.readPlanningComposition, input),
  };
}
