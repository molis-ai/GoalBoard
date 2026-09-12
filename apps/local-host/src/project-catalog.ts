import { ManagedProjectFiles } from "./managed-project-files.js";
import { ManagedProjectDeletion } from "./managed-project-deletion.js";
import { DemoProjectLifecycle } from "./demo-project-lifecycle.js";
import { exists } from "./project-file-paths.js";
import { type CreateGoalBoardProjectInput } from "./project-catalog-contract.js";
import { type ManageGoalBoardDemoProjectInput } from "./project-catalog-contract.js";
import { type GoalBoardDemoProjectResult } from "./project-catalog-contract.js";
export { CreateGoalBoardProjectInput } from "./project-catalog-contract.js";
export { ManageGoalBoardDemoProjectInput } from "./project-catalog-contract.js";
export { GoalBoardDemoProjectResult } from "./project-catalog-contract.js";
import { initializeCatalog } from "./catalog-migrations.js";
import { assertOwnedCatalog } from "./catalog-migrations.js";
import { migrateCatalog } from "./catalog-migrations.js";
import { GoalBoardProjectCatalogError } from "./project-catalog-contract.js";
export { GoalBoardProjectCatalogError } from "./project-catalog-contract.js";
export { catalogSchemaCompatibilityError } from "./project-catalog-contract.js";
export { type GoalBoardProjectCatalogErrorDetails } from "./project-catalog-contract.js";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalSqliteStorage, type SqliteDatabase } from "@adeptify/goalboard-storage";
import { createContextLedger } from "@adeptify/goalboard-module-context-ledger";
import type { ContextLedgerApi } from "@adeptify/goalboard-contracts/modules/context-ledger";
import { PersonalPlanningMethods } from "@adeptify/goalboard-module-goals";
import {
  type DesktopPanelCatalogApi,
  type DesktopPanelContextPort,
  type DesktopPanelErrorCode,
  type AliasDesktopPanelSessionInput,
  type DesktopPanelRecord,
  type OpenDesktopPanelInput,
} from "@adeptify/goalboard-contracts/platform/app-host";
import type {
  AddProjectPluginInput,
  BuiltinProjectPluginId,
  AddWorkspaceProjectInput,
  ChangeWorkspaceProjectInput,
  DeleteProjectInput,
  MigrateProjectInput,
  ProjectDeletionRecord,
  ProjectDeletionResult,
  ProjectMigrationStep,
  ProjectRecord,
  ProjectSelection,
  ProjectWorkspaceDirectoryRecord,
  ProjectWorkspaceMembership,
  RepairWorkspaceProjectInput,
} from "@adeptify/goalboard-contracts/modules/projects";
import {
  normalizeProjectWorkspace,
  ProjectsModule,
} from "@adeptify/goalboard-module-projects";
import type {
  RuntimeContextBindingEventRecord,
  RuntimeContextBindingRecord,
} from "@adeptify/goalboard-contracts/modules/private-work-context";
import {
  RuntimeContextBindingRepository, RuntimeProjectResolution, RuntimeProjectBindingCommands, createRuntimeProjectSetup, createRuntimeProjectBindingValidation,
} from "@adeptify/goalboard-module-private-work-context";
import { DEMO_BOARD_ID, seedDemoBoard } from "./demo-seed.js";




export type GoalBoardProjectRecord = ProjectRecord;

export interface GoalBoardProjectCatalogOptions {
  /** Defaults to ~/.goalboard. */
  homeDirectory?: string;
}

/**
 * An identity supplied by the Runtime host for the work entry the user is
 * currently using. `stable_work_context_id` is deliberately opaque: GoalBoard
 * never derives it from a repository, directory, or conversation. Reusing an
 * ID resumes the same host Session/work entry; a fresh Session must receive a
 * fresh ID from its host.
 */
export type RuntimeWorkContext = import("@adeptify/goalboard-contracts/modules/private-work-context").RuntimeWorkContext;

export type NormalizedRuntimeWorkContext = import("@adeptify/goalboard-contracts/modules/private-work-context").NormalizedRuntimeWorkContext;

export type RuntimeWorkspaceContext = import("@adeptify/goalboard-contracts/modules/private-work-context").RuntimeWorkspaceContext;

export type NormalizedRuntimeWorkspaceContext = import("@adeptify/goalboard-contracts/modules/private-work-context").NormalizedRuntimeWorkspaceContext;

export type GoalBoardProjectBindingScope = import("@adeptify/goalboard-contracts/modules/private-work-context").GoalBoardProjectBindingScope;

export type GoalBoardWorkspaceMembership = ProjectWorkspaceMembership;
export type GoalBoardWorkspaceDirectoryRecord = ProjectWorkspaceDirectoryRecord;
export type { AddWorkspaceProjectInput, RepairWorkspaceProjectInput, ChangeWorkspaceProjectInput };
export type GoalBoardProjectSelection = ProjectSelection;

/**
 * A non-authoritative, host-owned clue that can rank existing projects for a
 * fresh Session. It is never an identity and is never accepted from a Runtime
 * MCP tool argument.
 */
export type RuntimeProjectSuggestionClueKind = import("@adeptify/goalboard-contracts/modules/private-work-context").RuntimeProjectSuggestionClueKind;

export type RuntimeProjectSuggestionClue = import("@adeptify/goalboard-contracts/modules/private-work-context").RuntimeProjectSuggestionClue;

export type GoalBoardProjectSuggestion = import("@adeptify/goalboard-contracts/modules/private-work-context").GoalBoardProjectSuggestion;

export type GoalBoardRuntimeContextBinding = RuntimeContextBindingRecord;

export type GoalBoardDesktopPanelRecord = DesktopPanelRecord;
export type OpenGoalBoardDesktopPanelInput = OpenDesktopPanelInput;
export type AliasGoalBoardDesktopPanelSessionInput = AliasDesktopPanelSessionInput;

export type GoalBoardRuntimeContextBindingEvent = RuntimeContextBindingEventRecord;

export type GoalBoardProjectConnection = import("@adeptify/goalboard-contracts/modules/private-work-context").GoalBoardProjectConnection;

export type GoalBoardRuntimeContextResolution = import("@adeptify/goalboard-contracts/modules/private-work-context").GoalBoardRuntimeContextResolution;

export type BindRuntimeWorkContextInput = import("@adeptify/goalboard-contracts/modules/private-work-context").BindRuntimeWorkContextInput;

export type UnbindRuntimeWorkContextInput = import("@adeptify/goalboard-contracts/modules/private-work-context").UnbindRuntimeWorkContextInput;

export type GoalBoardRuntimeContextUnbindResult = import("@adeptify/goalboard-contracts/modules/private-work-context").GoalBoardRuntimeContextUnbindResult;

export type RejectRuntimeContextSuggestionInput = import("@adeptify/goalboard-contracts/modules/private-work-context").RejectRuntimeContextSuggestionInput;

export type GoalBoardRuntimeContextSuggestionRejectionResult = import("@adeptify/goalboard-contracts/modules/private-work-context").GoalBoardRuntimeContextSuggestionRejectionResult;

export type DeleteGoalBoardProjectInput = DeleteProjectInput;
export type GoalBoardProjectDeletionRecord = ProjectDeletionRecord;
export type GoalBoardProjectDeletionResult = ProjectDeletionResult;

/**
 * Creates a new GoalBoard project and binds it to the host-declared work
 * entry in one recoverable operation. Call this only after the user has
 * explicitly asked for a new project in the current Runtime conversation.
 */
export type CreateAndBindRuntimeContextInput = import("@adeptify/goalboard-contracts/modules/private-work-context").CreateAndBindRuntimeContextInput;

export type GoalBoardProjectMigrationStep = ProjectMigrationStep;
export type MigrateGoalBoardProjectInput = MigrateProjectInput;

export interface LocalCatalogPlatform {
  createPanelSchema(db: SqliteDatabase): void;
  createPanels(db: SqliteDatabase, ports: {
    context: DesktopPanelContextPort;
    errorFactory(code: DesktopPanelErrorCode, message: string): Error;
  }): DesktopPanelCatalogApi;
}

/** Local catalog resource lifetime and explicit composition of Project, Session and platform owners. */
export class GoalBoardProjectCatalog {
  readonly homeDirectory: string;
  readonly projectsDirectory: string;
  readonly databasePath: string;
  private readonly projectFiles: ManagedProjectFiles;
  private readonly projectDeletion: ManagedProjectDeletion;
  private readonly demoProjects: DemoProjectLifecycle;
  private readonly projects: ProjectsModule;
  private readonly workContexts: RuntimeContextBindingRepository;
  private readonly contextBindings: RuntimeProjectBindingCommands;
  private readonly contextResolution: RuntimeProjectResolution;
  readonly desktopPanels: DesktopPanelCatalogApi;
  readonly personalPlanningMethods: PersonalPlanningMethods;

  private constructor(
    private readonly storage: LocalSqliteStorage,
    homeDirectory: string,
    ledger: ContextLedgerApi,
    platform: LocalCatalogPlatform,
  ) {
    const db = storage.db;
    this.personalPlanningMethods = new PersonalPlanningMethods(db);
    this.homeDirectory = homeDirectory;
    this.projectsDirectory = path.join(homeDirectory, "projects");
    this.databasePath = path.join(this.projectsDirectory, "catalog.db");
    this.projects = new ProjectsModule({
      db,
      errorFactory: (code, message) =>
        new GoalBoardProjectCatalogError(code as GoalBoardProjectCatalogError["code"], message),
    });
    this.workContexts = new RuntimeContextBindingRepository(db, {
      ledger, assertProject: (projectId) => { this.projects.query.getProject(projectId); },
    });
    this.contextResolution = new RuntimeProjectResolution(this.projects.query, this.workContexts);
    this.contextBindings = new RuntimeProjectBindingCommands(
      this.workContexts, this.contextResolution, this.projects, contextBindingValidation,
      (code, message) => new GoalBoardProjectCatalogError(code, message),
      operation => db.transaction(operation)(),
    );
    this.projectFiles = new ManagedProjectFiles(this.projects, this.projectsDirectory, this.databasePath, contextBindingValidation);
    this.projectDeletion = new ManagedProjectDeletion(this.projects, this.projectsDirectory, {
      removeBindings: (projectId, actorId, at) => this.workContexts.removeProjectFacts(projectId, actorId, at),
      removePanels: projectId => this.desktopPanels.deleteForProject(projectId),
    }, contextBindingValidation);
    this.demoProjects = new DemoProjectLifecycle(this.projects, this.projectsDirectory, { boardId: DEMO_BOARD_ID, seed: seedDemoBoard }, this.projectDeletion, contextBindingValidation);
    this.desktopPanels = platform.createPanels(db, {
      errorFactory: (code, message) => new GoalBoardProjectCatalogError(code, message),
      context: {
        assertProject: (projectId) => { this.getProject(projectId); },
        bind: (input) => {
          const workspace = input.cwd
            ? normalizeRuntimeWorkspaceContext({ canonical_path: input.cwd, realpath_verified: false })
            : undefined;
          this.contextBindings.bindRuntimeContextInTransaction({
            normalized: {
              runtime_id: input.runtime_id,
              stable_work_context_id: input.stable_work_context_id,
              ...(workspace ? { workspace } : {}),
            },
            projectId: input.project_id,
            actorId: input.actor_id,
            rebindConfirmed: true,
            bindingScope: "session",
          });
        },
        appendProjectEvent: (projectId, type, actorId, payload) => {
          this.appendEvent(projectId, type, actorId, payload);
        },
      },
    });
  }

  static async open(options: GoalBoardProjectCatalogOptions, platform: LocalCatalogPlatform): Promise<GoalBoardProjectCatalog> {
    const homeDirectory = path.resolve(options.homeDirectory ?? path.join(os.homedir(), ".goalboard"));
    const projectsDirectory = path.join(homeDirectory, "projects");
    await fs.mkdir(projectsDirectory, { recursive: true });
    const databasePath = path.join(projectsDirectory, "catalog.db");
    const existed = await exists(databasePath);
    const storage = new LocalSqliteStorage(databasePath);
    const db = storage.db;
    try {
      return db.transaction(() => {
        if (existed) assertOwnedCatalog(storage, databasePath);
        const ledger = createContextLedger(db, {
          authorize: (access) => access.scope.kind === "personal" && access.scope.id === "private-work-context",
        });
        if (existed) migrateCatalog(storage, databasePath, ledger, platform.createPanelSchema);
        else initializeCatalog(storage, platform.createPanelSchema);
        return new GoalBoardProjectCatalog(storage, homeDirectory, ledger, platform);
      }).immediate();
    } catch (error) {
      storage.close();
      throw error;
    }
  }

  close(): void {
    this.storage.close();
  }

  listProjects(): GoalBoardProjectRecord[] {
    return this.projects.query.listProjects();
  }

  listProjectPlugins(projectId: string): BuiltinProjectPluginId[] {
    return this.projects.query.listProjectPlugins(projectId);
  }

  addProjectPlugin(input: AddProjectPluginInput): BuiltinProjectPluginId[] {
    return this.projects.commands.addProjectPlugin(input);
  }

  getProject(projectId: string): GoalBoardProjectRecord {
    return this.projects.query.getProject(projectId);
  }
  resolveRuntimeContext(context: RuntimeWorkContext, suggestionClues: readonly RuntimeProjectSuggestionClue[] = []): GoalBoardRuntimeContextResolution {
    return this.contextResolution.resolveRuntimeContext(normalizeRuntimeWorkContext(context), suggestionClues);
  }
  rejectRuntimeContextSuggestion(
    input: RejectRuntimeContextSuggestionInput,
  ): GoalBoardRuntimeContextSuggestionRejectionResult { return this.contextBindings.rejectRuntimeContextSuggestion(input); }
  bindRuntimeContext(input: BindRuntimeWorkContextInput): GoalBoardRuntimeContextResolution { return this.contextBindings.bindRuntimeContext(input); }
  unbindRuntimeContext(input: UnbindRuntimeWorkContextInput): GoalBoardRuntimeContextUnbindResult { return this.contextBindings.unbindRuntimeContext(input); }
  async createProjectAndBindRuntimeContext(input: CreateAndBindRuntimeContextInput): Promise<GoalBoardRuntimeContextResolution> {
    return createRuntimeProjectSetup({
      bindings: this.contextBindings, validation: contextBindingValidation,
      error: (code, message) => new GoalBoardProjectCatalogError(code, message),
      getProject: projectId => this.getProject(projectId),
      registerProject: (record, eventType, actorId) => this.insertProjectInTransaction(record, eventType, actorId),
      insertSetupRequest: input => this.workContexts.insertSetupRequest(input),
      transaction: operation => this.storage.db.transaction(operation)(),
      provisionCreatedProject: (input, commit) => this.projectFiles.provisionCreatedProject(input, commit),
    })(input);
  }
  listRuntimeContextBindingEvents(
    context?: RuntimeWorkContext,
  ): GoalBoardRuntimeContextBindingEvent[] { return this.contextBindings.listRuntimeContextBindingEvents(context); }
  listRuntimeContextBindings(): GoalBoardRuntimeContextBinding[] { return this.contextBindings.listRuntimeContextBindings(); }

  openDesktopPanel(input: OpenGoalBoardDesktopPanelInput): GoalBoardDesktopPanelRecord {
    return this.desktopPanels.open(input);
  }

  listDesktopPanels(projectId: string, goalId?: string): GoalBoardDesktopPanelRecord[] {
    return this.desktopPanels.list(projectId, goalId);
  }

  getDesktopPanel(panelId: string): GoalBoardDesktopPanelRecord {
    return this.desktopPanels.get(panelId);
  }

  markDesktopPanelExited(panelId: string): GoalBoardDesktopPanelRecord {
    return this.desktopPanels.markExited(panelId);
  }

  markDesktopPanelOpen(panelId: string): GoalBoardDesktopPanelRecord {
    return this.desktopPanels.markOpen(panelId);
  }

  closeDesktopPanel(panelId: string, actorId: string): void {
    this.desktopPanels.close(panelId, actorId);
  }

  aliasDesktopPanelSession(input: AliasGoalBoardDesktopPanelSessionInput): GoalBoardDesktopPanelRecord {
    return this.desktopPanels.aliasSession(input);
  }

  findDesktopPanelByWorkContext(
    runtimeId: string,
    workContextId: string,
  ): GoalBoardDesktopPanelRecord | null {
    return this.desktopPanels.findByWorkContext(runtimeId, workContextId);
  }

  preferredWorkspacePath(projectId: string): string | null {
    return this.projects.query.preferredWorkspacePath(projectId);
  }

  /** Safe Web/settings view: deliberately omits the canonical filesystem path. */
  listWorkspaceMemberships(): GoalBoardWorkspaceMembership[] {
    return this.projects.query.listWorkspaceMemberships();
  }

  /** Project-scoped management view. The canonical path never enters global settings. */
  listWorkspaceDirectory(projectId?: string): GoalBoardWorkspaceDirectoryRecord[] {
    return this.projects.query.listWorkspaceDirectory(projectId);
  }

  addWorkspaceProject(input: AddWorkspaceProjectInput): GoalBoardWorkspaceDirectoryRecord {
    return this.projects.commands.addWorkspaceProject(input);
  }

  repairWorkspaceProject(input: RepairWorkspaceProjectInput): GoalBoardWorkspaceDirectoryRecord {
    return this.projects.commands.repairWorkspaceProject(input);
  }

  setWorkspaceDefault(input: ChangeWorkspaceProjectInput): GoalBoardWorkspaceMembership[] {
    return this.projects.commands.setWorkspaceDefault(input);
  }

  removeWorkspaceMembership(input: ChangeWorkspaceProjectInput): GoalBoardWorkspaceMembership[] {
    return this.projects.commands.removeWorkspaceMembership(input);
  }
  async createProject(input: CreateGoalBoardProjectInput): Promise<GoalBoardProjectRecord> { return this.projectFiles.createProject(input); }
  async ensureDemoProject(input: ManageGoalBoardDemoProjectInput): Promise<GoalBoardDemoProjectResult> { return this.demoProjects.ensureDemoProject(input); }
  async resetDemoProject(input: ManageGoalBoardDemoProjectInput): Promise<GoalBoardDemoProjectResult> { return this.demoProjects.resetDemoProject(input); }
  async removeDemoProject(input: DeleteGoalBoardProjectInput): Promise<GoalBoardProjectDeletionResult> { return this.demoProjects.removeDemoProject(input); }

  listProjectDeletions(): GoalBoardProjectDeletionRecord[] {
    return this.projects.query.listProjectDeletions();
  }
  async deleteProject(input: DeleteGoalBoardProjectInput): Promise<GoalBoardProjectDeletionResult> { return this.projectDeletion.deleteProject(input); }

  renameProject(projectId: string, displayName: string, actorId: string): GoalBoardProjectRecord {
    return this.projects.commands.renameProject(projectId, displayName, actorId);
  }
  async migrateLegacyDatabase(input: MigrateGoalBoardProjectInput): Promise<GoalBoardProjectRecord> { return this.projectFiles.migrateLegacyDatabase(input); }

  private insertProjectInTransaction(record: GoalBoardProjectRecord, eventType: string, actorId: string): void {
    this.projects.lifecycle.register(record, eventType, actorId);
  }

  private appendEvent(projectId: string, type: string, actorId: string, payload: Record<string, unknown>): void {
    this.projects.lifecycle.appendEvent(projectId, type, actorId, payload);
  }
}

const contextBindingValidation = createRuntimeProjectBindingValidation({
  error: (code, message) => new GoalBoardProjectCatalogError(code, message),
  normalizeProjectWorkspace,
});
export const { normalizeRuntimeWorkContext } = contextBindingValidation;
const { normalizeRuntimeWorkspaceContext } = contextBindingValidation;
