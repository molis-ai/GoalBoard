import { prepareLocalProjectStorage } from "./project-storage.js";
import { createGoalBoardLocalHost, goalBoardHostProjectReference, type GoalBoardLocalHost } from "./project-host.js";
import { dispatchCliProjectCommand, DEFAULT_CLI_DATABASE, cliFlagValue as value,
  readCliJsonPayload as payload, printV1Help } from "@adeptify/goalboard-app-cli";

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
    return await dispatchCliProjectCommand(client, args, input);
  } finally {
    if (ownsLocalHost) await localHost.close();
  }
}
