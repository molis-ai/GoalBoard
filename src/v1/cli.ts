import { importV3Capability, initializeBoardCapability, snapshotBoardCapability, createGoalCapability, createGoalsEntryClient, createExecutionEntryClient, createGoalEntryCompositionClient, createGoalProposalClients, readGoalContractCapability, setActiveGoalCapability } from "@adeptify/goalboard-plugin-goals";
import { prepareLocalProjectStorage } from "@adeptify/goalboard-app-local-host";
import {
  createGoalBoardLocalHost,
  goalBoardHostProjectReference,
  type GoalBoardLocalHost,
} from "../local-host/composition.js";
import type { CreateGoalInput } from "@adeptify/goalboard-contracts/modules/goals";
import type { LegacyV3ImportInput } from "@adeptify/goalboard-plugin-goals";
import {
  createCliGoalCommandHandlers,
  createCliExecutionCommandHandlers,
  createCliAvailabilityQueryHandlers,
  createCliDraftDialogueHandlers,
  createCliGoalTreeHandlers,
  createCliLegacyProposalHandlers,
  DEFAULT_CLI_DATABASE,
  cliFlagValue as value,
  readCliJsonPayload as payload,
  printCliJson as print,
  cliGoalUrl,
  printV1Help,
} from "@adeptify/goalboard-app-cli";

export { printV1Help } from "@adeptify/goalboard-app-cli";

export interface V1CliOptions {
  localHost?: GoalBoardLocalHost;
}

export async function runV1Cli(args: string[], options: V1CliOptions = {}): Promise<number> {
  const operation = args[0];
  if (!operation || operation === "--help" || operation === "-h") {
    printV1Help();
    return 0;
  }
  const storage = prepareLocalProjectStorage(
    value(args, "--db") ?? DEFAULT_CLI_DATABASE,
    operation === "init" || operation === "import-v3" ? "create" : "existing",
  );
  const { databasePath } = storage;
  if (storage.status === "missing") {
    throw new Error(`GoalBoard 数据库不存在: ${databasePath}`);
  }
  const input = payload(args);
  const localHost = options.localHost ?? createGoalBoardLocalHost();
  const ownsLocalHost = !options.localHost;
  const reference = goalBoardHostProjectReference({
    databasePath,
    boardId: String(input.board_id ?? value(args, "--board-id") ?? `database:${databasePath}`),
  });
  const client = localHost.client(reference);
  try {
    return await client.withScope(async () => {
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
  } finally {
    if (ownsLocalHost) await localHost.close();
  }
}
