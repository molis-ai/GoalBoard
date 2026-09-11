import type { GoalBoardRuntimeConnection, GoalBoardRuntimeContextHost } from "@adeptify/goalboard-contracts/platform/app-host";
import { GoalBoardV1Error, projectResumeFactsCapability, readProjectGuidanceCapability } from "@adeptify/goalboard-plugin-goals";
import { createMcpRuntimeContextHandlers, createMcpContextPresenter, dispatchMcpProjectTool, handleMcpMessage,
  mcpRuntimeSessionActivity, MCP_TOOLS as TOOLS, RUNTIME_MCP_TOOLS as RUNTIME_TOOLS, MCP_SERVER_INFO as SERVER_INFO,
  type McpToolCallContext, type McpPresentationErrorFactory } from "@adeptify/goalboard-app-mcp";
import { readPersonalPlanningMethodPacks } from "./personal-planning-methods.js";
import { runtimeGoalTreeDecisionAuthority } from "./runtime-decision.js";
import { createGoalBoardLocalHost, goalBoardHostProjectReference, type GoalBoardLocalHost } from "./project-host.js";
import { GoalBoardProjectCatalogError } from "./project-catalog.js";
import { reconcileLegacySessionCatalog } from "./session-migration.js";
import { createRuntimePanelSessionLinker } from "./runtime-panel-session.js";
import { prepareLocalProjectStorage } from "./project-storage.js";
import { RuntimeSessionHost } from "./runtime-session.js";
import { RuntimeProjectConnection } from "./runtime-project-connection.js";
import { runtimeContextHostFromEnvironment } from "./runtime-context.js";
import { assertMcpToolAllowed, requireMcpRuntimeContextHost } from "./mcp-authority.js";
import { injectRuntimeIdentity } from "./mcp-event-identity.js";
import type { LocalWebCatalogRunner } from "./web-project-settings.js";

export type GoalBoardMcpAudience = "runtime" | "management";
export type GoalBoardMcpToolCallContext = McpToolCallContext;
const createPresentationError: McpPresentationErrorFactory = (code, message, details) => new GoalBoardV1Error(code, message, details);
const EMPTY_TOOL_CALL_CONTEXT: GoalBoardMcpToolCallContext = { runtimeSessionId: null, runtimeSessionIdSource: null };

export class LocalMcpServer {
  audience: GoalBoardMcpAudience;
  private readonly connectionState: RuntimeProjectConnection;
  get runtimeConnection(): GoalBoardRuntimeConnection | null { return this.connectionState.connection; }
  set runtimeConnection(connection: GoalBoardRuntimeConnection | null) { this.connectionState.connection = connection; }
  runtimeContextHost: GoalBoardRuntimeContextHost | null;
  private readonly contextTools: ReturnType<typeof createMcpRuntimeContextHandlers>;
  private readonly sessionFoundationReady: Promise<void>;
  private readonly runtimeSessions: RuntimeSessionHost;
  private readonly linkPanelSession: ReturnType<typeof createRuntimePanelSessionLinker>;
  private readonly localHost: GoalBoardLocalHost;
  private readonly ownsLocalHost: boolean;

  constructor(
    withGoalBoardProjectCatalog: LocalWebCatalogRunner,
    audience?: GoalBoardMcpAudience | null,
    runtimeConnection?: GoalBoardRuntimeConnection | null,
    runtimeContextHost?: GoalBoardRuntimeContextHost | null,
    localHost?: GoalBoardLocalHost,
  ) {
    this.audience =
      audience ?? (process.env.GOALBOARD_MCP_AUDIENCE === "management" ? "management" : "runtime");
    // Explicit constructor injection is reserved for tests and embedding. A
    // production Runtime never inherits a static project DB from environment.
    this.connectionState = new RuntimeProjectConnection(runtimeConnection ?? null);
    this.contextTools = createMcpRuntimeContextHandlers({
      catalogs: { withCatalog: (homeDirectory, operation) => withGoalBoardProjectCatalog({ homeDirectory }, operation) },
      connection: this.connectionState,
      requireHost: (context) => this.requireRuntimeContextHost(context),
      presentResolution: createMcpContextPresenter({
        connection: this.connectionState,
        createError: createPresentationError,
        readGuidance: (connection) => this.localHost.client(goalBoardHostProjectReference({
          databasePath: connection.database_path, boardId: connection.board_id, projectId: connection.project_id,
        })).invoke(readProjectGuidanceCapability, { board_id: connection.board_id }),
        readResumeFacts: (connection, focusGoalIds) => this.localHost.client(goalBoardHostProjectReference({
          databasePath: connection.database_path, boardId: connection.board_id, projectId: connection.project_id,
        })).invoke(projectResumeFactsCapability, { board_id: connection.board_id, focus_goal_ids: [...focusGoalIds] }),
        readSession: (host, reconcileLegacy) => this.runtimeSessions.read(host, reconcileLegacy),
      }),
    });
    this.runtimeContextHost =
      runtimeContextHost ?? (this.runtimeConnection ? null : runtimeContextHostFromEnvironment());
    this.ownsLocalHost = !localHost;
    this.localHost = localHost ?? createGoalBoardLocalHost({
      planningMethods: () => this.runtimeContextHost?.homeDirectory
        ? readPersonalPlanningMethodPacks(this.runtimeContextHost.homeDirectory)
        : [],
    });
    this.linkPanelSession = createRuntimePanelSessionLinker({
      withCatalog: (homeDirectory, operation) => withGoalBoardProjectCatalog({ homeDirectory }, (catalog) => operation({
        aliasPanelSession: (input) => catalog.desktopPanels.aliasSession(input),
        reconcileSessions: (registry) => { reconcileLegacySessionCatalog(catalog, registry); },
      })),
      isMissingPanel: (error) => error instanceof GoalBoardProjectCatalogError && error.code === "catalog.panel_not_found",
    });
    this.runtimeSessions = new RuntimeSessionHost(async (homeDirectory, registry) => {
      await withGoalBoardProjectCatalog({ homeDirectory }, (catalog) => {
        reconcileLegacySessionCatalog(catalog, registry);
      });
    });
    // An explicitly injected Board connection is already fully scoped. Tests
    // and embedders that omit homeDirectory must not accidentally migrate the
    // user's global catalog just because they also provide audit metadata.
    this.sessionFoundationReady = this.runtimeContextHost?.homeDirectory
      ? this.runtimeSessions.reconcile(this.runtimeContextHost.homeDirectory).catch((error: unknown) => {
          this.runtimeSessions.recordFailure(error);
        })
      : Promise.resolve();
  }

  async callTool(
    name: string,
    arguments_: Record<string, unknown>,
    callContext: GoalBoardMcpToolCallContext = EMPTY_TOOL_CALL_CONTEXT,
  ): Promise<string> {
    await this.sessionFoundationReady;
    assertMcpToolAllowed({ audience: this.audience, connectionState: this.connectionState,
      runtimeConnection: this.runtimeConnection, runtimeContextHost: this.runtimeContextHost }, name, arguments_, callContext);
    await this.linkPanelSession(this.runtimeContextHost, callContext.runtimeSessionId);
    if (name === "goalboard_v1_context_resolve") return this.contextTools[name](arguments_, callContext);
    if (name === "goalboard_v1_context_list_projects") return this.contextTools[name](arguments_, callContext);
    if (name === "goalboard_v1_context_reject_suggestion") return this.contextTools[name](arguments_, callContext);
    if (name === "goalboard_v1_context_bind") return this.contextTools[name](arguments_, callContext);
    if (name === "goalboard_v1_context_unbind") return this.contextTools[name](arguments_, callContext);
    if (name === "goalboard_v1_context_create_and_bind") return this.contextTools[name](arguments_, callContext);
    if (name === "goalboard_v1_project_delete") return this.contextTools[name](arguments_, callContext);
    const response = await this.callV1Tool(
      name,
      arguments_,
      this.audience === "runtime" ? this.runtimeConnection : null,
      callContext,
    );
    await this.recordRuntimeSessionActivity(name, arguments_, response, callContext);
    return response;
  }

  private async recordRuntimeSessionActivity(
    name: string,
    arguments_: Record<string, unknown>,
    response: string,
    callContext: GoalBoardMcpToolCallContext,
  ): Promise<void> {
    const host = this.runtimeContextHost;
    if (this.audience !== "runtime" || !host?.homeDirectory || !this.runtimeConnection) return;
    const activity = mcpRuntimeSessionActivity(name, arguments_, response);
    if (!activity) return;
    const activeHost = this.requireRuntimeContextHost(callContext);
    await this.runtimeSessions.record(activity, activeHost, this.runtimeConnection.projectId);
  }

  private requireRuntimeContextHost(context: GoalBoardMcpToolCallContext = EMPTY_TOOL_CALL_CONTEXT): GoalBoardRuntimeContextHost {
    return requireMcpRuntimeContextHost(this, context);
  }

  private async callV1Tool(
    name: string,
    arguments_: Record<string, unknown>,
    runtimeConnection: GoalBoardRuntimeConnection | null,
    callContext: GoalBoardMcpToolCallContext,
  ): Promise<string> {
    const storage = prepareLocalProjectStorage(
      String(
        this.audience === "runtime"
          ? runtimeConnection!.databasePath
          : arguments_.database_path ?? process.env.GOALBOARD_DATABASE ?? ".goalboard/goalboard.db",
      ),
      name === "goalboard_v1_initialize" || name === "goalboard_v1_import_v3" ? "create" : "existing",
    );
    const { databasePath } = storage;
    if (storage.status === "missing") {
      throw new GoalBoardV1Error("store.not_found", `GoalBoard 数据库不存在: ${databasePath}`);
    }
    const boardId = String(
      this.audience === "runtime"
        ? runtimeConnection!.boardId
        : arguments_.board_id ?? `database:${databasePath}`,
    );
    const reference = goalBoardHostProjectReference({
      databasePath,
      boardId,
      projectId: this.audience === "runtime" ? runtimeConnection!.projectId : undefined,
    });
    const client = this.localHost.client(reference);
    const trustedArguments = this.audience === "runtime"
      ? injectRuntimeIdentity(name, arguments_, this.runtimeContextHost, callContext, runtimeConnection!)
      : arguments_;
    return dispatchMcpProjectTool(client, name, trustedArguments, {
      audience: this.audience,
      webBaseUrl: () => String(this.audience === "runtime" ? runtimeConnection!.webBaseUrl
        : arguments_.web_base_url ?? process.env.GOALBOARD_WEB_URL ?? "http://127.0.0.1:4173"),
      projectId: runtimeConnection?.projectId,
      createError: createPresentationError,
      decisionAuthority: (confirmation) => runtimeGoalTreeDecisionAuthority(
        this.runtimeContextHost ? this.requireRuntimeContextHost(callContext) : null, callContext, confirmation,
      ),
    });
  }

  async close(): Promise<void> {
    if (this.ownsLocalHost) await this.localHost.close();
  }

  async handleMessage(
    message: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    return handleMcpMessage(message, {
      serverInfo: SERVER_INFO,
      tools: this.audience === "management" ? TOOLS : RUNTIME_TOOLS,
      callTool: (name, arguments_, context) => this.callTool(name, arguments_, context),
      formatToolError: formatMcpToolError,
    });
  }
}

function formatMcpToolError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof GoalBoardV1Error && error.details) {
    return `错误: ${message}\n${JSON.stringify({ code: error.code, ...error.details })}`;
  }
  if (!(error instanceof GoalBoardProjectCatalogError)) return `错误: ${message}`;
  return `错误: ${message}\n${JSON.stringify({ code: error.code, ...error.details })}`;
}
