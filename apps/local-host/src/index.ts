export { installGoalBoardHome } from "./installer/home.js";
export { GoalBoardHomeInstallError } from "./installer/home-contract.js";
export type { GoalBoardHomeInstallOptions, GoalBoardHomeInstallResult, GoalBoardHomeInstallStatus, GoalBoardHomeInstallStep } from "./installer/home-contract.js";
export { computeBuildSourceDigest, writeGoalBoardBuildManifest, digestPaths } from "./installer/fingerprint.js";
export type { GoalBoardBuildManifest } from "./installer/fingerprint.js";
export { RuntimeIntegrationService } from "./installer/runtime-integration.js";
export { RuntimeIntegrationError, SUPPORTED_RUNTIME_IDS, isSupportedRuntimeId } from "./installer/runtime-integration-contract.js";
export type { SupportedRuntimeId, RuntimeIntegrationAction, RuntimeConnectionState, RuntimeIntegrationDetection, RuntimeIntegrationChange, RuntimeIntegrationPlan, RuntimeIntegrationConfirmation, RuntimeIntegrationResultStatus, RuntimeIntegrationResult, RuntimeIntegrationValidationContext, RuntimeIntegrationServiceOptions } from "./installer/runtime-integration-contract.js";
export { runtimeGoalTreeDecisionAuthority } from "./runtime-decision.js";
export { openWorkSessionRegistry } from "./session-registry.js";
export { RuntimeSessionHost } from "./runtime-session.js";
export { RuntimeProjectConnection } from "./runtime-project-connection.js";
export { createRuntimePanelSessionLinker } from "./runtime-panel-session.js";
export { runtimeContextHostFromEnvironment, runtimeSessionHostSignalsFromEnvironment, sessionSignalsForHost } from "./runtime-context.js";
export type { GoalBoardRuntimeContextHost } from "./runtime-context.js";
export { prepareLocalProjectStorage } from "./project-storage.js";
export { PluginHostExecutor } from "./plugin-executor.js";
export type { PluginHostExecutorOptions } from "./plugin-executor.js";
export { runPluginDevelopment } from "./plugin-development.js";
export type { LocalProjectStoragePreparation } from "./project-storage.js";

export const packageDescriptor = {
  packageName: "@adeptify/goalboard-app-local-host",
  packagePath: "apps/local-host",
  kind: "app",
  maturity: "partial",
  contract: "@adeptify/goalboard-contracts/platform/app-host",
  migrationGoals: ["goal-reorg-f2","goal-reorg-ap2"],
  ssot: "docs/SSOT-MATRIX.md",
  capabilities: ["local-host.client.v1", "local-host.single-writer.v1"],
} as const;

export type GoalBoardPackageDescriptor = typeof packageDescriptor;

export * from "./local-host.js";
export { GoalBoardWebServiceManager } from "./installer/web-service.js";
export { GoalBoardWebServiceError, type GoalBoardWebServiceAction, type GoalBoardWebServiceState, type GoalBoardWebServiceDetection, type GoalBoardWebServicePlan, type GoalBoardWebServiceResult, type GoalBoardWebServiceManagerOptions } from "./installer/web-service-contract.js";
export { GoalBoardUninstallService } from "./installer/uninstall.js";
export { GoalBoardUninstallError, type GoalBoardUninstallPlan, type GoalBoardUninstallResult, type GoalBoardUninstallServiceOptions, type GoalBoardUninstallChange, type UninstallProjectAccess } from "./installer/uninstall-contract.js";
export { resolveWebControlToken, WEB_CONTROL_TOKEN_RELATIVE_PATH } from "./web-control-token.js";
export { createGoalBoardRuntimePayload, type GoalBoardRuntimePayloadOptions } from "./installer/runtime-payload.js";
export { createGoalBoardNpmPackageDirectory } from "./installer/npm-package.js";
export { readPersonalPlanningMethodPacks } from "./personal-planning-methods.js";

export { migrateLocalProjectDatabase } from "./project-migrations.js";
export { migrateFeedTables, migrateInfoflowContractV2 } from "./feed-migrations.js";

export { LocalProjectDatabase } from "./project-database.js";

export * from "./goal-project-application.js";

export * from "./web-locale.js";

export { createLocalHostWorkbenchRenderer } from "./workbench-renderer.js";

export { CATALOG_SCHEMA_VERSION, CATALOG_OWNER, GoalBoardProjectCatalogError, catalogSchemaCompatibilityError, type GoalBoardProjectCatalogErrorDetails } from "./project-catalog-contract.js";
export { initializeProjectDatabase, readManagedBoard, validateManagedBoard, assertProjectHasNoActiveWork } from "./managed-project-database.js";

export { ManagedProjectFiles } from "./managed-project-files.js";
export { ManagedProjectDeletion, type ProjectDeletionCleanupPorts } from "./managed-project-deletion.js";
export { DemoProjectLifecycle, type DemoProjectSeedPort } from "./demo-project-lifecycle.js";
export { exists } from "./project-file-paths.js";
export type { CreateGoalBoardProjectInput, ManageGoalBoardDemoProjectInput, GoalBoardDemoProjectResult } from "./project-catalog-contract.js";

export { initializeCatalog, assertOwnedCatalog, migrateCatalog, type CatalogDesktopSchema } from "./catalog-migrations.js";

export * from "./project-catalog.js";
export { seedDemoBoard, DEMO_BOARD_ID } from "./demo-seed.js";

export { hydrateFeedItemContent, hydrateFeedSnapshotContent } from "./feed-content.js";

export { createLocalFeedApplication } from "./feed-application.js";

export { createFeedSourceRuntime, type FeedSourceRuntime } from "./feed-source-runtime.js";
export { createIntelligenceCollectAdapter, type IntelligenceCollectRequest, type IntelligenceCollectResult, type IntelligenceCollectAdapter } from "./feed-intelligence-client.js";

export { createLocalFeedSourceService, listFeedSourceCatalog } from "./feed-source-service.js";
export type { FeedSourceService, RegisterFeedSourceInput, UpdateFeedSourceInput, ConfigureFeedSourceScheduleInput, FeedSourceSyncResult, FeedSourceCatalogView } from "@adeptify/goalboard-plugin-feed";

export * from "./connector-credentials.js";
export * from "./github-oauth.js";

export * from "./gmail-oauth.js";

export { createGithubConnector } from "./github-connector.js";
export { createGmailConnector } from "./gmail-connector.js";
export { OfficialIntegrationRegistry, type OfficialProviderFactory } from "./official-integrations.js";

export { createLocalFeedConnectorSync } from "./feed-connector-sync.js";

export { createLocalFeedConnectorService } from "./feed-connector-service.js";

export { createLocalFeedSourceScheduler } from "./feed-source-scheduler.js";

export { defaultRelayDatabasePath, detectRelayImport, importRelayData } from "./relay-import.js";

export { createLocalFeedGoalPromotion } from "./feed-goal-promotion.js";

export { handleFeedNativePluginHttp, type FeedNativePluginHttpOptions } from "./feed-native-plugin-http.js";

export { createLocalArtifactHttp, renderGoalArtifactContext } from "./artifact-native-plugin-http.js";

export * from "./onboarding.js";

export { createLocalHostCapsule } from "./capsule.js";

export { attachGoalBoardPtySocket, type GoalBoardPtySocketHandlers } from "./pty-socket.js";

export { buildGoalBoardWebView, cachedGoalBoardWebView, type GoalBoardWebViewCache, type WebViewOptions } from "./web-view.js";

export { sendLocalWebJson, readLocalWebBody, authorizeLocalWebRequest, type LocalMutationState } from "./web-http.js";
export { createLocalWebAssets } from "./web-assets.js";

export * from "./web-session.js";
export { reconcileLegacySessionCatalog } from "./session-migration.js";
export { handleLocalRuntimeSettingsHttp, serviceProcessId } from "./web-runtime-settings.js";
export * from "./web-project-settings.js";
export * from "./web-project-presentation.js";
export { importV3Board } from "./board-v3-import.js";
export * from "./project-host.js";
export { importV3Capability, projectResumeFactsCapability, trashedGoalsCapability, initializeBoardCapability, snapshotBoardCapability, createGoalCapability, createGoalIntentCapability } from "@adeptify/goalboard-plugin-goals";
export type { CreateGoalCapabilityInput, ImportV3CapabilityInput } from "@adeptify/goalboard-plugin-goals";
export { runLocalPluginDevelopment } from "./local-plugin-development.js";
export { createLocalOnboardingHttp } from "./web-onboarding.js";
export { createLocalPanelHttp } from "./web-panel.js";
export { createLocalWorkSessionHttp } from "./web-work-session.js";
export { handleLocalProjectReferenceHttp } from "./web-project-reference.js";
export { createLocalPlanningHttp } from "./web-planning.js";
export { createLocalGoalsReadHttp } from "./web-goals-read.js";
export { createLocalWebServerFactory } from "./web-server.js";
export type { WebServerOptions } from "./web-types.js";
export type { LocalWebPlatform } from "./web-composition.js";
export { createLocalUninstallService } from "./local-uninstall.js";
export { LocalMcpServer } from "./mcp-server.js";
export type { GoalBoardMcpAudience, GoalBoardMcpToolCallContext } from "./mcp-server.js";
export { runV1Cli } from "./cli-project.js";
export type { V1CliOptions } from "./cli-project.js";
export { runLocalCli } from "./cli-host.js";
export type { LocalCliOptions } from "./cli-host.js";
