import { importV3Capability, initializeBoardCapability, snapshotBoardCapability, createGoalCapability, createGoalsEntryClient, createExecutionEntryClient, createGoalEntryCompositionClient, createGoalProposalClients, readGoalContractCapability, setActiveGoalCapability } from "@adeptify/goalboard-plugin-goals";
import type { LocalHostProjectClient } from "@adeptify/goalboard-contracts/platform/app-host";
import type { CreateGoalInput } from "@adeptify/goalboard-contracts/modules/goals";
import type { LegacyV3ImportInput } from "@adeptify/goalboard-plugin-goals";
import { createCliGoalCommandHandlers } from "./goal-commands.js";
import { createCliExecutionCommandHandlers } from "./execution-commands.js";
import { createCliAvailabilityQueryHandlers } from "./availability-queries.js";
import { createCliDraftDialogueHandlers } from "./draft-dialogue-commands.js";
import { createCliGoalTreeHandlers } from "./goal-tree-commands.js";
import { createCliLegacyProposalHandlers } from "./legacy-proposal-commands.js";
import { cliFlagValue as value, printCliJson as print, cliGoalUrl } from "./protocol.js";

/** CLI wire conversion over the Host's already selected project. */
export async function dispatchCliProjectCommand(
  client: LocalHostProjectClient, args: string[], input: Record<string, unknown>,
): Promise<number> {
  const operation = args[0];
  return client.withScope(async () => {
    const { draftDialogue, goalTree, legacyProposals } = createGoalProposalClients(client);
    const goalsAdapter = createGoalsEntryClient(client);
    const executionCommandsClient = createExecutionEntryClient(client);
    const availability = createGoalEntryCompositionClient(client);
    const goalCommands = createCliGoalCommandHandlers(goalsAdapter);
    const executionCommands = createCliExecutionCommandHandlers(executionCommandsClient);
    const draftDialogueCommands = createCliDraftDialogueHandlers(draftDialogue);
    const goalTreeCommands = createCliGoalTreeHandlers(goalTree);
    const legacyProposalCommands = createCliLegacyProposalHandlers(legacyProposals);
    const availabilityQueries = createCliAvailabilityQueryHandlers(availability);
    switch (operation) {
    case "init":
      print(
        await client.invoke(initializeBoardCapability, {
          board_id: String(input.board_id),
          title: String(input.title),
          actor_id: String(input.actor_id),
          idempotency_key: String(input.idempotency_key),
        }),
      );
      break;
    case "create-goal":
      print(
        await client.invoke(createGoalCapability, {
          board_id: String(input.board_id),
          goal: input.goal as CreateGoalInput,
          actor_id: String(input.actor_id),
          idempotency_key: String(input.idempotency_key),
          reason: input.reason == null ? undefined : String(input.reason),
        }),
      );
      break;
    case "draft-dialogue-start":
      print(await draftDialogueCommands[operation](input));
      break;
    case "draft-dialogue-turn":
      print(await draftDialogueCommands[operation](input));
      break;
    case "draft-dialogue-resume":
      print(await draftDialogueCommands[operation](input));
      break;
    case "goal-tree-propose":
      print(await goalTreeCommands[operation](input));
      break;
    case "goal-tree-read":
      print(await goalTreeCommands[operation](input));
      break;
    case "goal-tree-check":
      print(await goalTreeCommands[operation](input));
      break;
    case "goal-tree-decide":
      print(await goalTreeCommands[operation](input));
      break;
    case "relation-add":
    case "impact-add":
    case "policy-set":
    case "risk-add":
    case "risk-state":
    case "revalidate":
    case "complete":
      print(await goalCommands[operation](input));
      break;
    case "active-goal":
      print(
        await client.invoke(setActiveGoalCapability, {
          board_id: String(input.board_id),
          goal: { goal_id: String(input.goal_id), reason: String(input.reason) },
          write: { actor_id: String(input.actor_id), idempotency_key: String(input.idempotency_key) },
        }),
      );
      break;
    case "snapshot":
      print(await client.invoke(snapshotBoardCapability, { board_id: String(input.board_id) }));
      break;
    case "contract": {
      const contract = await client.invoke(readGoalContractCapability, { board_id: String(input.board_id), goal_id: String(input.goal_id) });
      const baseUrl =
        value(args, "--web-base-url") ??
        process.env.GOALBOARD_WEB_URL ??
        "http://127.0.0.1:4173";
      const goalUrl = cliGoalUrl(contract.goal_path, baseUrl);
      print({ ...contract, goal_url: goalUrl });
      break;
    }
    case "ready":
    case "available":
    case "explain":
      print(await availabilityQueries[operation](input));
      break;
    case "claim":
    case "select-goal":
    case "release":
    case "revoke":
    case "run-start":
    case "run-report":
    case "evidence-submit":
    case "review-submit":
      print(await executionCommands[operation](input));
      break;
    case "contract-propose":
      print(await legacyProposalCommands[operation](input));
      break;
    case "contract-decide":
      print(await legacyProposalCommands[operation](input));
      break;
    case "candidate-submit":
      print(await legacyProposalCommands[operation](input));
      break;
    case "dependency-propose":
      print(await legacyProposalCommands[operation](input));
      break;
    case "candidate-decide":
      print(await legacyProposalCommands[operation](input));
      break;
    case "rewire-confirm":
      print(await legacyProposalCommands[operation](input));
      break;
    case "import-v3":
      print(
        await client.invoke(importV3Capability, {
          legacy: input as unknown as LegacyV3ImportInput,
          target_board_id: String(value(args, "--board-id")),
          actor_id: String(value(args, "--actor")),
          idempotency_key: String(value(args, "--key")),
        }),
      );
      break;
    default:
      throw new Error(`未知 V1 operation: ${operation}`);
    }
    return 0;
  });
}
