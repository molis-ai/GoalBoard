import type { GoalAcceptanceCriterion } from "./goals.js";
import type {
  ApplyGoalConcernInput,
  CiteGoalDecisionInput,
  ContinueGoalEventWorkInput,
  ContinueGoalEventWorkResult,
  GoalEventAgreementResult,
  GoalEventClosureResult,
  GoalEventConcernResult,
  GoalEventDecisionRequestResult,
  GoalEventDecisionResult,
  GoalEventMutationResult,
  GoalEventProgressResult,
  GoalEventResumeResult,
  GoalEventSystemPayload,
  GoalEventUserConclusion,
  GoalEventWorkStateView,
  RecordGoalProgressSummaryInput,
  RecordGoalUserDecisionInput,
  RequestGoalDecisionInput,
  ResumeGoalEventWorkInput,
  RecordGoalNoteInput,
  ReopenCompletedEventWorkInput,
  SetGoalEventAgreementInput,
  SubmitGoalEventClosureInput,
  GoalEventTrustedDecisionRecord,
} from "./goal-event-state.js";

export * from "./goal-event-state.js";

export const goalEventSemanticFamilies = [
  "progress",
  "delivery",
  "verification",
  "concern",
  "observation",
  "decision",
  "closure",
  "custom",
] as const;
export type GoalEventSemanticFamily = (typeof goalEventSemanticFamilies)[number];

export const goalEventFieldFormats = ["text", "longtext"] as const;
export type GoalEventFieldFormat = (typeof goalEventFieldFormats)[number];

export const goalEventJudgmentVerdicts = ["supports", "contradicts", "unknown"] as const;
export type GoalEventJudgmentVerdict = (typeof goalEventJudgmentVerdicts)[number];

export const goalEventTypeSourceKinds = ["local", "planning", "runtime"] as const;
export type GoalEventTypeSourceKind = (typeof goalEventTypeSourceKinds)[number];

export interface GoalEventPlanningMethodRef {
  method_id: string;
  version: number;
  source: "built_in" | "personal" | "project";
  name?: string;
}

export interface GoalEventTypeSource {
  kind: GoalEventTypeSourceKind;
  method_id?: string;
  method_version?: number;
  label?: string;
  contributing_methods?: GoalEventPlanningMethodRef[];
}

export interface GoalEventFieldSource {
  kind: "local" | "planning";
  method_id?: string;
  label?: string;
}

export interface GoalEventFieldDefinition {
  field_id: string;
  name: string;
  purpose: string;
  format: GoalEventFieldFormat;
  required: boolean;
  source?: GoalEventFieldSource;
}

export interface GoalEventTypeDefinition {
  type_id: string;
  version: number;
  name: string;
  purpose: string;
  semantic_family?: GoalEventSemanticFamily;
  source: GoalEventTypeSource;
  fields: GoalEventFieldDefinition[];
}

export interface GoalEventAdoptedPlanningRef {
  method_id: string;
  version: number;
  source: "built_in" | "personal" | "project";
}

export interface GoalEventRequirementBinding {
  type_id: string;
  requirement_id: string;
}

export interface GoalEventRequirementSource {
  kind: "planning";
  template_requirement_id: string;
  methods: GoalEventPlanningMethodRef[];
}

export interface GoalEventExtraRequirement {
  requirement_id: string;
  statement: string;
  bound_type_id?: string;
  created_in_config_version: number;
  actor_id: string;
  source?: GoalEventRequirementSource;
}

export interface GoalEventTypeDefinitionInput {
  type_id: string;
  version: number;
  name: string;
  purpose: string;
  semantic_family?: GoalEventSemanticFamily;
  source?: GoalEventTypeSource;
  fields: GoalEventFieldDefinition[];
}

export interface GoalEventExtraRequirementInput {
  requirement_id: string;
  statement: string;
  bound_type_id?: string;
  source?: GoalEventRequirementSource;
}

export interface ConfigureGoalEventsInput {
  board_id: string;
  goal_id: string;
  actor_id: string;
  actor_kind?: "user" | "runtime";
  expected_version: number;
  idempotency_key: string;
  types?: GoalEventTypeDefinitionInput[];
  adopted_planning?: GoalEventAdoptedPlanningRef[];
  requirement_bindings?: GoalEventRequirementBinding[];
  new_requirements?: GoalEventExtraRequirementInput[];
}

export interface GoalEventConfigView {
  board_id: string;
  goal_id: string;
  version: number;
  types: GoalEventTypeDefinition[];
  adopted_planning: GoalEventAdoptedPlanningRef[];
  extra_requirements: GoalEventExtraRequirement[];
  requirement_bindings: GoalEventRequirementBinding[];
  updated_at: string | null;
  updated_by: string | null;
}

export interface ConfigureGoalEventsResult {
  config: GoalEventConfigView;
  event_id: string;
  observed_event_cursor: number;
  replayed: boolean;
}

export interface GoalEventJudgmentInput {
  requirement_id: string;
  verdict: GoalEventJudgmentVerdict;
}

export interface ReportGoalWorkEventInput {
  type_id: string;
  type_version: number;
  title: string;
  fields: Record<string, string>;
  judgments?: GoalEventJudgmentInput[];
}

export interface ReportGoalEventsInput {
  board_id: string;
  goal_id: string;
  actor_id: string;
  actor_kind?: "user" | "runtime";
  idempotency_key: string;
  events: ReportGoalWorkEventInput[];
}

export interface GoalWorkEventJudgment {
  requirement_id: string;
  verdict: GoalEventJudgmentVerdict;
}

export interface GoalEventConfigurationPayload {
  config_version: number;
  types: GoalEventTypeDefinition[];
  extra_requirements: GoalEventExtraRequirement[];
  requirement_bindings: GoalEventRequirementBinding[];
  adopted_planning: GoalEventAdoptedPlanningRef[];
}

export interface GoalWorkEventBase {
  event_id: string;
  board_id: string;
  goal_id: string;
  title: string;
  actor_id: string;
  actor_kind: "user" | "runtime" | null;
  received_at: string;
  journal_seq: number;
  config_version: number | null;
}

export interface GoalConfigurationWorkEventRecord extends GoalWorkEventBase {
  kind: "configuration";
  type: null;
  payload: GoalEventConfigurationPayload;
  judgments: GoalWorkEventJudgment[];
}

export interface GoalReportWorkEventRecord extends GoalWorkEventBase {
  kind: "report";
  type: GoalEventTypeDefinition | null;
  payload: Record<string, string>;
  judgments: GoalWorkEventJudgment[];
}

export interface GoalSystemWorkEventRecord extends GoalWorkEventBase {
  kind: "system";
  type: null;
  payload: GoalEventSystemPayload;
  judgments: GoalWorkEventJudgment[];
}

export type GoalWorkEventRecord =
  | GoalConfigurationWorkEventRecord
  | GoalReportWorkEventRecord
  | GoalSystemWorkEventRecord;

export interface ReportGoalEventsResult {
  events: GoalReportWorkEventRecord[];
  observed_event_cursor: number;
  replayed: boolean;
}

export interface GoalEventAdoptedPlanningRequest {
  method_id: string;
  version?: number;
  source?: "built_in" | "personal" | "project";
}

export interface PlanningMethodDefaultRequirement {
  requirement_id: string;
  statement: string;
  bound_type_id?: string;
  applies_when?: string;
  sources?: GoalEventPlanningMethodRef[];
}

export interface ConfigureGoalEventsApplicationInput {
  board_id: string;
  goal_id: string;
  actor_id: string;
  actor_kind?: "user" | "runtime";
  expected_version: number;
  idempotency_key: string;
  types?: GoalEventTypeDefinitionInput[];
  adopted_planning?: GoalEventAdoptedPlanningRequest[];
  adopt_default_requirement_ids?: string[];
  requirement_bindings?: GoalEventRequirementBinding[];
  new_requirements?: GoalEventExtraRequirementInput[];
}

export interface CreateGoalIntentInput {
  board_id: string;
  title: string;
  outcome?: string;
  goal_id?: string;
  actor_id: string;
  actor_kind?: "user" | "runtime";
  idempotency_key: string;
}

export interface CreateGoalIntentResult {
  goal: {
    goal_id: string;
    board_id: string;
    title: string;
    outcome: string;
    definition_state: "draft";
    decomposition_state: "abstract";
    fulfillment_state: "unmet";
  };
  replayed: boolean;
  observed_event_cursor: number;
  recorded: true;
  completion_effect: false;
}

export interface GoalEventReportSummary {
  event_id: string;
  title: string;
  type_id: string | null;
  type_version: number | null;
  received_at: string;
  journal_seq: number;
  judgments: GoalWorkEventJudgment[];
}

export interface GoalEventWorkGap {
  requirement_id: string;
  statement: string;
  current_verdict: GoalEventJudgmentVerdict | null;
  human_decision_required: boolean;
}

export interface GoalEventProtocolBoundary {
  kind: "event_work" | "legacy_claim_run";
  note: string;
  claim_or_run_required: boolean;
}

export interface GoalEventStateView {
  board_id: string;
  goal_id: string;
  intent: {
    title: string;
    outcome: string;
    definition_state: "draft" | "accepted";
    created_as_draft: boolean;
  };
  current_agreement: {
    definition_state: "draft" | "accepted";
    decomposition_state: string;
    fulfillment_state: string;
    outcome: string;
  };
  config: GoalEventConfigView;
  requirements: GoalEventRequirementStatus[];
  latest_reports: GoalEventReportSummary[];
  gaps: GoalEventWorkGap[];
  observed_event_cursor: number;
  /** Max work-event journal_seq on this Goal; 0 when the Goal has no work events yet. */
  goal_event_cursor: number;
  event_list_next_cursor: number | null;
  protocol: GoalEventProtocolBoundary;
  owner: GoalEventWorkStateView["owner"];
  work_status: GoalEventWorkStateView["work_status"];
  agreement: GoalEventWorkStateView["agreement"];
  progress_summary: GoalEventWorkStateView["progress_summary"];
  concerns: GoalEventWorkStateView["concerns"];
  pending_decisions: GoalEventWorkStateView["pending_decisions"];
  applied_decisions: GoalEventWorkStateView["applied_decisions"];
  current_decisions: GoalEventWorkStateView["current_decisions"];
  closure: GoalEventWorkStateView["closure"];
  recorded_not_completed: boolean;
  completion_effect: boolean;
}

export interface ResolvedPlanningEventAdoption {
  adopted_planning: GoalEventAdoptedPlanningRef[];
  types: GoalEventTypeDefinitionInput[];
  default_requirements: PlanningMethodDefaultRequirement[];
}

export interface GoalEventListQuery {
  after_cursor?: number;
  limit?: number;
}

export interface GoalEventListPage {
  events: GoalWorkEventRecord[];
  next_cursor: number | null;
  observed_event_cursor: number;
}

export interface GoalEventHistoryQuery {
  before_cursor?: number;
  limit?: number;
}

export interface GoalEventHistoryPage {
  events: GoalWorkEventRecord[];
  next_cursor: number | null;
  observed_event_cursor: number;
}

export type GoalHistoryLane = "result" | "decision" | "problem" | "other";

export interface GoalEventTimelineItem {
  event_id: string;
  journal_seq: number;
  received_at: string;
  title: string;
  kind: "configuration" | "report" | "system";
  type_id: string | null;
  type_name: string | null;
  semantic_family: GoalEventSemanticFamily | null;
  system_operation?: string | null;
  lane?: GoalHistoryLane;
  actor_id: string;
  actor_kind: "user" | "runtime" | null;
}

export interface GoalEventTimelinePage {
  items: GoalEventTimelineItem[];
  next_cursor: number | null;
  observed_event_cursor: number;
}

export interface GoalEventRequirementReport {
  event_id: string;
  actor_id: string;
  actor_kind: "user" | "runtime" | null;
  verdict: GoalEventJudgmentVerdict;
  received_at: string;
  journal_seq: number;
  independent_verification: false;
  substitutes_human_decision: false;
}

export interface GoalEventRequirementStatus {
  requirement_id: string;
  goal_id: string;
  statement: string;
  origin: {
    kind: "acceptance_criterion" | "goal_event_requirement";
    decision_method?: GoalAcceptanceCriterion["decision_method"];
    pass_condition?: string;
    config_version?: number;
    planning?: GoalEventRequirementSource;
  };
  bound_type_ids: string[];
  human_decision_required: boolean;
  current_report: GoalEventRequirementReport | null;
  user_conclusion: GoalEventUserConclusion | null;
  currently_satisfied: boolean;
}

export interface GoalEventLatestReportsQuery {
  limit?: number;
}

export interface GoalEventLatestReports {
  reports: GoalReportWorkEventRecord[];
  observed_event_cursor: number;
}

export interface GoalEventFactsApi {
  configure(input: ConfigureGoalEventsInput): ConfigureGoalEventsResult;
  configureRequested(
    input: ConfigureGoalEventsApplicationInput,
    resolveAdoption: (boardId: string, requested: GoalEventAdoptedPlanningRequest[]) => ResolvedPlanningEventAdoption,
  ): ConfigureGoalEventsResult;
  report(input: ReportGoalEventsInput): ReportGoalEventsResult;
  readConfig(boardId: string, goalId: string): GoalEventConfigView;
  listEvents(boardId: string, goalId: string, query?: GoalEventListQuery): GoalEventListPage;
  listLatestEvents(boardId: string, goalId: string, query?: GoalEventHistoryQuery): GoalEventHistoryPage;
  listLatestTimeline(boardId: string, goalId: string, query?: GoalEventHistoryQuery): GoalEventTimelinePage;
  listLatestReports(boardId: string, goalId: string, query?: GoalEventLatestReportsQuery): GoalEventLatestReports;
  readEvent(boardId: string, goalId: string, eventId: string): GoalWorkEventRecord;
  readCurrentRequirements(boardId: string, goalId: string): GoalEventRequirementStatus[];
  isEventStateOwner(boardId: string, goalId: string): boolean;
  readWorkState(boardId: string, goalId: string): GoalEventWorkStateView;
  runImmediate<T>(operation: () => T): T;
  adoptOwner(input: {
    board_id: string;
    goal_id: string;
    actor_id: string;
    source: "intent" | "configuration" | "continue";
    outcome?: string;
  }): void;
  continueWithEventWork(input: ContinueGoalEventWorkInput): ContinueGoalEventWorkResult;
  recordNote(input: RecordGoalNoteInput): GoalEventMutationResult;
  reopenCompletedEventWork(input: ReopenCompletedEventWorkInput): GoalEventResumeResult;
  recordProgress(input: RecordGoalProgressSummaryInput): GoalEventProgressResult;
  applyConcern(input: ApplyGoalConcernInput): GoalEventConcernResult;
  requestDecision(input: RequestGoalDecisionInput): GoalEventDecisionRequestResult;
  citeDecision(input: CiteGoalDecisionInput): GoalEventDecisionResult;
  recordTrustedDecision(
    input: RecordGoalUserDecisionInput,
    persistGovernance: (normalized: RecordGoalUserDecisionInput) => GoalEventTrustedDecisionRecord,
  ): GoalEventDecisionResult;
  setAgreement(input: SetGoalEventAgreementInput): GoalEventAgreementResult;
  submitClosure(input: SubmitGoalEventClosureInput): GoalEventClosureResult;
  resumeWork(input: ResumeGoalEventWorkInput): GoalEventResumeResult;
}
