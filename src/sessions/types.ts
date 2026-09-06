/**
 * Runtime-facing compatibility types.
 *
 * Session facts and commands are owned by the Private Work Context Contract;
 * this file only retains Runtime adapter and UI result shapes until WK2/WK3.
 */
export {
  WORK_SESSION_EVENT_KINDS as SESSION_TIMELINE_KINDS,
  WORK_SESSION_EVENT_SOURCES as SESSION_EVENT_SOURCES,
  WORK_SESSION_HANDOFF_STATES as SESSION_HANDOFF_STATES,
} from "@adeptify/goalboard-contracts/modules/private-work-context";

export type {
  AppendWorkSessionEventInput as AppendGoalBoardSessionEventInput,
  CreateWorkSessionInput as CreateGoalBoardSessionInput,
  CreateWorkSessionHandoffDraftInput as CreateSessionHandoffDraftInput,
  DiscoverWorkSessionInput as DiscoverRuntimeSessionInput,
  ExplicitlyLinkWorkSessionInput as ExplicitlyLinkRuntimeSessionInput,
  LegacyRuntimeContextBindingInput as LegacySessionBindingInput,
  LegacyWorkSessionMigrationInput as LegacySessionMigrationInput,
  LegacyWorkSessionMigrationReport as LegacySessionMigrationReport,
  LegacyWorkSessionPanelInput as LegacySessionPanelInput,
  LinkNativeWorkSessionInput as LinkNativeRuntimeSessionInput,
  ReassignWorkSessionWorkspaceInput as ReassignWorkspaceSessionsInput,
  SetWorkSessionStatusInput as SetGoalBoardSessionStatusInput,
  UpdateWorkSessionAssociationsInput as UpdateSessionAssociationsInput,
  UpdateWorkSessionHandoffDraftInput as UpdateSessionHandoffDraftInput,
  WorkSessionEventKind as SessionTimelineKind,
  WorkSessionEventRecord as GoalBoardSessionEventRecord,
  WorkSessionEventSource as SessionEventSource,
  WorkSessionGoalLink as GoalBoardSessionGoalLink,
  WorkSessionHandoffDeliveryMode as SessionHandoffDeliveryMode,
  WorkSessionHandoffRecord as GoalBoardSessionHandoffRecord,
  WorkSessionHandoffState as SessionHandoffState,
  WorkSessionListFilter as SessionListFilter,
  WorkSessionProvenance as GoalBoardSessionProvenance,
  WorkSessionRecord as GoalBoardSessionRecord,
  WorkSessionStatus as GoalBoardSessionStatus,
} from "@adeptify/goalboard-contracts/modules/private-work-context";

export { GoalBoardSessionError } from "@adeptify/goalboard-module-private-work-context";

export { RUNTIME_SESSION_CAPABILITIES } from "@adeptify/goalboard-contracts/services/runtime-host";
export type {
  RuntimeHostApi,
  RuntimeProviderDescriptor,
  RuntimeSessionAdapter,
  RuntimeSessionAdapterResult,
  RuntimeSessionCapabilities,
  RuntimeSessionCapability,
  RuntimeSessionCapabilityMode,
  RuntimeSessionTransport,
} from "@adeptify/goalboard-contracts/services/runtime-host";

export type { SessionTimelineEvent, SessionContentMode, SessionContentResult, SessionResumeResult } from "@adeptify/goalboard-plugin-work";
