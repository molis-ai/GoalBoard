import { importV3Capability, trashedGoalsCapability, initializeBoardCapability, snapshotBoardCapability, createGoalCapability, createGoalsEntryClient, createExecutionEntryClient, createGoalEntryCompositionClient, createGoalProposalClients, readGoalContractCapability, readProjectGuidanceCapability, setActiveGoalCapability } from "@adeptify/goalboard-plugin-goals";
import { createMcpGoalEventHandlers } from "./goal-event-commands.js";
import type { LocalHostProjectClient, RuntimeGoalTreeConfirmation } from "@adeptify/goalboard-contracts/platform/app-host";
import type { GoalTreeProposalDecisionAuthority } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { CreateGoalInput } from "@adeptify/goalboard-contracts/modules/goals";
import type { LegacyV3ImportInput } from "@adeptify/goalboard-plugin-goals";
import { createMcpGoalToolHandlers } from "./goal-commands.js";
import { createMcpGoalTrashHandlers } from "./goal-trash-commands.js";
import { runtimeGoalTreeDecisionInput, createMcpGoalTreeHandlers } from "./goal-tree-commands.js";
import { mcpGoalContractResponse } from "./goal-presentation.js";
import { createMcpExecutionToolHandlers } from "./execution-commands.js";
import { createMcpAvailabilityToolHandlers } from "./availability-queries.js";
import { createMcpDraftDialogueHandlers } from "./draft-dialogue-commands.js";
import { createMcpLegacyProposalHandlers } from "./legacy-proposal-commands.js";
import { planningMethodResponse, type McpPresentationErrorFactory } from "./query-presentation.js";
import { mcpBoardPayload } from "./payload.js";

export interface McpToolDispatchPorts {
  audience: "runtime" | "management";
  webBaseUrl: () => string;
  projectId: string | null | undefined;
  createError: McpPresentationErrorFactory;
  evidenceLocatorContext: Parameters<typeof createMcpExecutionToolHandlers>[1];
  decisionAuthority: (confirmation: RuntimeGoalTreeConfirmation) => GoalTreeProposalDecisionAuthority;
}

/** Tool wire adaptation over an already scoped, authorized Host Client. */
export async function dispatchMcpProjectTool(
  client: LocalHostProjectClient,
  name: string,
  arguments_: Record<string, unknown>,
  ports: McpToolDispatchPorts,
): Promise<string> {
  return client.withScope(async () => {
    const { draftDialogue, goalTree, legacyProposals } = createGoalProposalClients(client);
    const goalsAdapter = createGoalsEntryClient(client);
    const executionCommandsClient = createExecutionEntryClient(client);
    const availability = createGoalEntryCompositionClient(client);
    const goalTools = createMcpGoalToolHandlers(goalsAdapter, ports.audience);
    const eventTools = createMcpGoalEventHandlers(client, ports.audience, ports.createError);
    const trashTools = createMcpGoalTrashHandlers(availability, ports.createError);
    const draftDialogueTools = createMcpDraftDialogueHandlers(draftDialogue, ports.createError);
    const goalTreeTools = createMcpGoalTreeHandlers(goalTree);
    const legacyProposalTools = createMcpLegacyProposalHandlers(legacyProposals);
    const availabilityTools = createMcpAvailabilityToolHandlers(availability, ports.createError);
    const executionTools = createMcpExecutionToolHandlers(executionCommandsClient, ports.evidenceLocatorContext);
    let result: unknown;
    let prettyPrint = true;
    switch (name) {
      case "goalboard_v1_initialize":
        result = await client.invoke(initializeBoardCapability, {
          board_id: String(arguments_.board_id),
          title: String(arguments_.title),
          actor_id: String(arguments_.actor_id),
          idempotency_key: String(arguments_.idempotency_key),
        });
        break;
      case "goalboard_v1_create_goal":
        result = await client.invoke(createGoalCapability, {
          board_id: String(arguments_.board_id),
          goal: arguments_.goal as CreateGoalInput,
          actor_id: String(arguments_.actor_id),
          idempotency_key: String(arguments_.idempotency_key),
          reason: arguments_.reason == null ? undefined : String(arguments_.reason),
        });
        break;
      case "goalboard_v1_snapshot":
        result = await client.invoke(snapshotBoardCapability, { board_id: String(arguments_.board_id) });
        break;
      case "goalboard_v1_project_guidance_get":
        result = await client.invoke(readProjectGuidanceCapability, { board_id: String(arguments_.board_id) });
        break;
      case "goalboard_v1_project_guidance_add":
      case "goalboard_v1_project_guidance_update":
      case "goalboard_v1_planning_method_save":
      case "goalboard_v1_planning_analyze_change":
      case "goalboard_v1_planning_graph_check":
      case "goalboard_v1_relation_add":
      case "goalboard_v1_impact_add":
      case "goalboard_v1_policy_set":
      case "goalboard_v1_risk_add":
      case "goalboard_v1_risk_state":
      case "goalboard_v1_revalidate":
      case "goalboard_v1_complete":
        result = await goalTools[name](arguments_);
        break;
      case "goalboard_v1_contract": {
        const contract = await client.invoke(readGoalContractCapability, {
          board_id: String(arguments_.board_id), goal_id: String(arguments_.goal_id),
        });
        const baseUrl = ports.webBaseUrl();
        result = mcpGoalContractResponse(
          contract, baseUrl,
          ports.audience === "runtime" ? ports.projectId : null,
          ports.createError,
        );
        break;
      }
      case "goalboard_v1_ready":
      case "goalboard_v1_available":
      case "goalboard_v1_explain":
        ({ result, prettyPrint } = await availabilityTools[name](arguments_));
        break;
      case "goalboard_v1_planning_methods": {
        const planning = await availability.readPlanningComposition(String(arguments_.board_id));
        result = planningMethodResponse(planning.methods, planning.composition, arguments_, ports.createError);
        break;
      }
      case "goalboard_v1_goal_intent_create":
      case "goalboard_v1_goal_state":
      case "goalboard_v1_event_configure":
      case "goalboard_v1_event_report":
      case "goalboard_v1_event_list":
      case "goalboard_v1_event_read":
      case "goalboard_v1_event_progress":
      case "goalboard_v1_event_concern":
      case "goalboard_v1_event_decision_request":
      case "goalboard_v1_event_cite_decision":
      case "goalboard_v1_event_agree":
      case "goalboard_v1_event_close":
      case "goalboard_v1_event_resume":
      case "goalboard_v1_event_decide":
        result = await eventTools[name](arguments_);
        break;
      case "goalboard_v1_claim":
      case "goalboard_v1_select_goal":
      case "goalboard_v1_release":
      case "goalboard_v1_claim_renew":
      case "goalboard_v1_revoke_claim":
      case "goalboard_v1_run_start":
      case "goalboard_v1_rework_request":
      case "goalboard_v1_run_report":
      case "goalboard_v1_evidence_correct":
      case "goalboard_v1_review_submit":
      case "goalboard_v1_evidence_submit":
        result = await executionTools[name](arguments_);
        break;
      case "goalboard_v1_draft_dialogue_start":
      case "goalboard_v1_draft_dialogue_turn":
      case "goalboard_v1_draft_dialogue_resume":
        result = await draftDialogueTools[name](arguments_);
        break;
      case "goalboard_v1_goal_tree_propose":
      case "goalboard_v1_goal_tree_read":
      case "goalboard_v1_goal_tree_check":
        result = await goalTreeTools[name](arguments_);
        break;
      case "goalboard_v1_goal_tree_decide": {
        result = await goalTreeTools.goalboard_v1_goal_tree_decide(
          ports.audience === "runtime"
            ? runtimeGoalTreeDecisionInput(arguments_, ports.decisionAuthority, ports.createError)
            : arguments_,
        );
        break;
      }
      case "goalboard_v1_active_goal": {
        const payload = mcpBoardPayload<{
          board_id: string;
          goal_id: string;
          reason: string;
          actor_id: string;
          idempotency_key: string;
        }>(arguments_);
        result = await client.invoke(setActiveGoalCapability, {
          board_id: payload.board_id, goal: payload, write: payload,
        });
        break;
      }
      case "goalboard_v1_goal_trash":
      case "goalboard_v1_goal_restore":
        result = await trashTools[name](arguments_);
        break;
      case "goalboard_v1_goal_trash_list": {
        const boardId = String(arguments_.board_id);
        result = await client.invoke(trashedGoalsCapability, { board_id: boardId });
        break;
      }
      case "goalboard_v1_contract_propose":
        result = await legacyProposalTools.goalboard_v1_contract_propose(arguments_);
        break;
      case "goalboard_v1_candidate_submit":
        result = await legacyProposalTools.goalboard_v1_candidate_submit(arguments_);
        break;
      case "goalboard_v1_dependency_propose":
        result = await legacyProposalTools.goalboard_v1_dependency_propose(arguments_);
        break;
      case "goalboard_v1_contract_decide":
        result = await legacyProposalTools.goalboard_v1_contract_decide(arguments_);
        break;
      case "goalboard_v1_candidate_decide":
        result = await legacyProposalTools.goalboard_v1_candidate_decide(arguments_);
        break;
      case "goalboard_v1_rewire_confirm":
        result = await legacyProposalTools.goalboard_v1_rewire_confirm(arguments_);
        break;
      case "goalboard_v1_import_v3": {
        const payload = arguments_.payload as {
          legacy: LegacyV3ImportInput;
          actor_id: string;
          idempotency_key: string;
        };
        result = await client.invoke(importV3Capability, {
          legacy: payload.legacy,
          target_board_id: String(arguments_.board_id),
          actor_id: payload.actor_id,
          idempotency_key: payload.idempotency_key,
        });
        break;
      }
      default:
        throw ports.createError("mcp.tool_unknown", `未知 V1 tool: ${name}`);
    }
    return JSON.stringify(result, null, prettyPrint ? 2 : undefined);
  });
}
