import { LocalMcpServer, type GoalBoardMcpAudience, type GoalBoardLocalHost } from "@adeptify/goalboard-app-local-host";
import type { GoalBoardRuntimeConnection, GoalBoardRuntimeContextHost } from "@adeptify/goalboard-contracts/platform/app-host";
import { withGoalBoardProjectCatalog } from "./project-catalog.js";

/** Supply the desktop Catalog adapter while the Host owns MCP resource lifecycle. */
export class GoalBoardServer extends LocalMcpServer {
  constructor(audience?: GoalBoardMcpAudience | null, connection?: GoalBoardRuntimeConnection | null,
    runtimeHost?: GoalBoardRuntimeContextHost | null, localHost?: GoalBoardLocalHost) {
    super(withGoalBoardProjectCatalog, audience, connection, runtimeHost, localHost);
  }
}
