#!/usr/bin/env node
import { readPersonalPlanningMethodPacks } from "@adeptify/goalboard-app-local-host";
import { runtimeGoalTreeDecisionAuthority } from "@adeptify/goalboard-app-local-host";
/** GoalBoard V1 MCP Server：stdio JSON-RPC。 */
import readline from "node:readline";
import type { GoalBoardRuntimeConnection } from "@adeptify/goalboard-contracts/platform/app-host";
import { importV3Capability, projectResumeFactsCapability, trashedGoalsCapability, initializeBoardCapability, snapshotBoardCapability, createGoalCapability, createGoalsEntryClient, createExecutionEntryClient, createGoalEntryCompositionClient, createGoalProposalClients, readGoalContractCapability, readProjectGuidanceCapability, setActiveGoalCapability } from "@adeptify/goalboard-plugin-goals";
import type { CreateGoalInput } from "@adeptify/goalboard-contracts/modules/goals";
import {
  createGoalBoardLocalHost,
  goalBoardHostProjectReference,
  type GoalBoardLocalHost,
} from "../local-host/composition.js";
import {
  GoalBoardProjectCatalogError,
  normalizeRuntimeWorkContext,
} from "../projects/catalog.js";
import { withGoalBoardProjectCatalog } from "../projects/catalog-session.js";
import {
  reconcileLegacySessionCatalog,
} from "../sessions/compatibility.js";
import {
  GoalBoardV1Error,
} from "../v1/errors.js";
import type { LegacyV3ImportInput } from "@adeptify/goalboard-plugin-goals";
import {
  createMcpGoalToolHandlers,
  createMcpGoalTrashHandlers,
  runtimeGoalTreeDecisionInput,
  mcpGoalContractResponse,
  createMcpContextPresenter,
  createMcpRuntimeContextHandlers,
  createMcpExecutionToolHandlers,
  createMcpAvailabilityToolHandlers,
  createMcpDraftDialogueHandlers,
  createMcpGoalTreeHandlers,
  createMcpLegacyProposalHandlers,
  planningMethodResponse,
  type McpPresentationErrorFactory,
  mcpBoardPayload,
  handleMcpMessage,
  mcpRuntimeSessionActivity,
  MCP_TOOLS as TOOLS,
  RUNTIME_MCP_TOOLS as RUNTIME_TOOLS,
  MCP_SERVER_INFO as SERVER_INFO,
  isRuntimeMcpTool,
  isRuntimeContextMcpTool,
  type McpToolCallContext,
} from "@adeptify/goalboard-app-mcp";

const createPresentationError: McpPresentationErrorFactory = (code, message, details) =>
  new GoalBoardV1Error(code, message, details);

export type GoalBoardMcpAudience = "runtime" | "management";

export type { GoalBoardRuntimeConnection } from "@adeptify/goalboard-contracts/platform/app-host";

export type GoalBoardMcpToolCallContext = McpToolCallContext;

/**
 * Host-only context for a Runtime MCP process. The model never supplies this
 * identity through a tool argument: it comes from the Runtime host and is used
 * only after the GoalBoard Skill explicitly asks to resolve it.
 */
export { runtimeContextHostFromEnvironment } from "@adeptify/goalboard-app-local-host";
export type { GoalBoardRuntimeContextHost } from "@adeptify/goalboard-app-local-host";

const EMPTY_TOOL_CALL_CONTEXT: GoalBoardMcpToolCallContext = {
  runtimeSessionId: null,
  runtimeSessionIdSource: null,
};

export class GoalBoardServer {
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
        readResumeFacts: (connection) => this.localHost.client(goalBoardHostProjectReference({
          databasePath: connection.database_path, boardId: connection.board_id, projectId: connection.project_id,
        })).invoke(projectResumeFactsCapability, { board_id: connection.board_id }),
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
    this.assertToolAllowed(name, arguments_, callContext);
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

  private assertToolAllowed(
    name: string,
    arguments_: Record<string, unknown>,
    callContext: GoalBoardMcpToolCallContext,
  ): void {
    if (this.audience === "management") return;
    if (!isRuntimeMcpTool(name)) {
      throw new GoalBoardV1Error(
        "mcp.authority_denied",
        `MCP 权限拒绝：${name} 只允许用户或管理入口调用；Runtime 应提交 Candidate 或把决定交给用户`,
      );
    }
    if (name === "goalboard_v1_review_submit") {
      const payload = (arguments_.payload as Record<string, unknown> | undefined) ?? {};
      if (payload.actor_kind === "user") {
        throw new GoalBoardV1Error(
          "mcp.user_impersonation_denied",
          "MCP 权限拒绝：Runtime 不能声明 actor_kind=user 或代替用户提交 human approval Review",
        );
      }
    }
    if (arguments_.database_path != null || arguments_.web_base_url != null) {
      throw new GoalBoardV1Error(
        "mcp.connection_override_denied",
        "MCP 连接拒绝：Runtime 不能覆盖宿主固定的 SQLite 或 goal_url",
      );
    }
    if (isRuntimeContextMcpTool(name)) {
      this.requireRuntimeContextHost(callContext);
      return;
    }
    if (!this.connectionState.explicit) {
      const host = this.requireRuntimeContextHost(callContext);
      if (this.connectionState.observe(host.runtimeContext) === "refresh_required") {
        throw new GoalBoardV1Error(
          "mcp.context_refresh_required",
          "MCP 当前调用的 Session 身份与已解析的项目连接不连续。请只读调用 goalboard_v1_context_resolve；若返回 bound，请使用原 idempotency_key 原样重试失败调用。不要调用 context_bind，也不要再次询问用户；若未返回 bound，则按 context_resolve 的 next_action 处理。",
          {
            next_action: "context_resolve_then_retry",
            requires_bind: false,
            requires_user_confirmation: false,
            retry_same_idempotency_key: true,
            retry_when_context_status: "bound",
          },
        );
      }
    }
    if (!this.runtimeConnection) {
      throw new GoalBoardV1Error(
        "mcp.connection_incomplete",
        "MCP 尚未连接项目：请先由统一 GoalBoard Skill 调用 goalboard_v1_context_resolve，或由宿主提供固定连接",
      );
    }
    if (arguments_.board_id !== this.runtimeConnection.boardId) {
      throw new GoalBoardV1Error(
        "mcp.board_mismatch",
        `MCP 连接拒绝：Runtime 必须使用宿主固定的 board_id ${this.runtimeConnection.boardId}`,
      );
    }
  }

  private requireRuntimeContextHost(
    callContext: GoalBoardMcpToolCallContext = EMPTY_TOOL_CALL_CONTEXT,
  ): GoalBoardRuntimeContextHost {
    if (!this.runtimeContextHost) {
      throw new GoalBoardV1Error(
        "mcp.context_host_missing",
        "MCP 宿主没有提供 Runtime 标识；无法解析 Session 或项目目录关联",
      );
    }
    if (!callContext.runtimeSessionId) return this.runtimeContextHost;
    return {
      ...this.runtimeContextHost,
      nativeRuntimeSessionId: callContext.runtimeSessionId,
      runtimeContext: {
        ...this.runtimeContextHost.runtimeContext,
        stable_work_context_id: callContext.runtimeSessionId,
        host_declares_stable: true,
      },
    };
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
    return await client.withScope(async () => {
      const { draftDialogue, goalTree, legacyProposals } = createGoalProposalClients(client);
      const goalsAdapter = createGoalsEntryClient(client);
      const executionCommandsClient = createExecutionEntryClient(client);
      const availability = createGoalEntryCompositionClient(client);
      const goalTools = createMcpGoalToolHandlers(goalsAdapter, this.audience);
      const trashTools = createMcpGoalTrashHandlers(availability, createPresentationError);
      const draftDialogueTools = createMcpDraftDialogueHandlers(draftDialogue, createPresentationError);
      const goalTreeTools = createMcpGoalTreeHandlers(goalTree);
      const legacyProposalTools = createMcpLegacyProposalHandlers(legacyProposals);
      const availabilityTools = createMcpAvailabilityToolHandlers(availability, createPresentationError);
      const executionTools = createMcpExecutionToolHandlers(executionCommandsClient, () => {
        const workspace = this.runtimeContextHost
          ? normalizeRuntimeWorkContext(this.runtimeContextHost.runtimeContext).workspace
          : undefined;
        return { project_root: workspace?.canonical_path ?? null, workspace_id: workspace?.workspace_id ?? null };
      });
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
          const baseUrl = String(
            this.audience === "runtime"
              ? runtimeConnection!.webBaseUrl
              : arguments_.web_base_url ??
                  process.env.GOALBOARD_WEB_URL ??
                  "http://127.0.0.1:4173",
          );
          result = mcpGoalContractResponse(
            contract, baseUrl,
            this.audience === "runtime" ? runtimeConnection?.projectId : null,
            createPresentationError,
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
          result = planningMethodResponse(planning.methods, planning.composition, arguments_, createPresentationError);
          break;
        }
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
            this.audience === "runtime"
              ? runtimeGoalTreeDecisionInput(arguments_, (confirmation) => runtimeGoalTreeDecisionAuthority(
                  this.runtimeContextHost ? this.requireRuntimeContextHost(callContext) : null,
                  callContext,
                  confirmation,
                ), createPresentationError)
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
          throw new GoalBoardV1Error("mcp.tool_unknown", `未知 V1 tool: ${name}`);
      }
      return JSON.stringify(result, null, prettyPrint ? 2 : undefined);
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

async function runStdio(): Promise<void> {
  const server = new GoalBoardServer();
  try {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }
      const response = await server.handleMessage(message);
      if (response) process.stdout.write(JSON.stringify(response) + "\n");
    }
  } finally {
    await server.close();
  }
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("mcp/server.ts") ||
    process.argv[1].endsWith("mcp/server.js"));

if (isMain) {
  runStdio().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { TOOLS, RUNTIME_TOOLS, SERVER_INFO };
import { createRuntimePanelSessionLinker, prepareLocalProjectStorage, RuntimeSessionHost, RuntimeProjectConnection, runtimeContextHostFromEnvironment, type GoalBoardRuntimeContextHost } from "@adeptify/goalboard-app-local-host";
