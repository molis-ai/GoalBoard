import type {
  ApplyGoalConcernInput,
  CiteGoalDecisionInput,
  ConfigureGoalEventsApplicationInput,
  ConfigureGoalEventsResult,
  ContinueGoalEventWorkInput,
  ContinueGoalEventWorkResult,
  CreateGoalIntentInput,
  CreateGoalIntentResult,
  GoalEventAgreementResult,
  GoalEventClosureResult,
  GoalEventConcernResult,
  GoalEventDecisionRequestResult,
  GoalEventDecisionResult,
  GoalEventFactsApi,
  GoalEventHistoryPage,
  GoalEventHistoryQuery,
  GoalEventListPage,
  GoalEventListQuery,
  GoalEventProgressResult,
  GoalEventReportSummary,
  GoalEventResumeResult,
  GoalEventStateView,
  GoalEventTimelinePage,
  GoalEventTrustedAuthority,
  GoalEventTrustedDecisionRecord,
  GoalEventWorkGap,
  GoalRecord,
  GoalsCommandApi,
  GoalsPlanningApi,
  GoalsQueryApi,
  GoalWorkEventRecord,
  RecordGoalProgressSummaryInput,
  RecordGoalUserDecisionInput,
  ReportGoalEventsInput,
  ReportGoalEventsResult,
  RequestGoalDecisionInput,
  RecordGoalNoteInput,
  ReopenCompletedEventWorkInput,
  ResumeGoalEventWorkInput,
  SetGoalEventAgreementInput,
  SubmitGoalEventClosureInput,
} from "@adeptify/goalboard-contracts/modules/goals";
import { GoalBoardV1Error } from "./errors.js";

const STATE_REPORT_LIMIT = 5;

export interface GoalEventApplicationPorts {
  query: Pick<GoalsQueryApi, "getGoal">;
  commands: Pick<GoalsCommandApi, "createGoal">;
  events: GoalEventFactsApi;
  planning: Pick<GoalsPlanningApi, "resolveEventAdoption">;
  recordTrustedDecision?: (input: RecordGoalUserDecisionInput) => GoalEventTrustedDecisionRecord;
}

/** Compose intent, planning adoption, event facts and typed state effects without a second state machine. */
export class GoalEventApplication {
  constructor(private readonly ports: GoalEventApplicationPorts) {}

  createIntent(input: CreateGoalIntentInput): CreateGoalIntentResult {
    const title = input.title?.trim();
    if (!title) throw new GoalBoardV1Error("goal.title_required", "意图创建只需要能辨认的标题");
    const outcome = input.outcome?.trim() ?? "";
    return this.ports.events.runImmediate(() => {
      const result = this.ports.commands.createGoal(input.board_id, {
        goal_id: input.goal_id?.trim() || undefined,
        title,
        outcome,
        why: "",
        business_logic: "",
        definition_state: "draft",
        decomposition_state: "abstract",
        acceptance_criteria: [],
      }, {
        actor_id: input.actor_id,
        actor_kind: input.actor_kind,
        idempotency_key: input.idempotency_key,
        reason: "保存原始意图",
      });
      this.ports.events.adoptOwner({
        board_id: result.goal.board_id,
        goal_id: result.goal.goal_id,
        actor_id: input.actor_id,
        source: "intent",
        outcome,
      });
      return {
        goal: {
          goal_id: result.goal.goal_id,
          board_id: result.goal.board_id,
          title: result.goal.title,
          outcome: result.goal.outcome,
          definition_state: "draft" as const,
          decomposition_state: "abstract" as const,
          fulfillment_state: "unmet" as const,
        },
        replayed: result.replayed,
        observed_event_cursor: result.observed_event_cursor,
        recorded: true as const,
        completion_effect: false as const,
      };
    });
  }

  readState(boardId: string, goalId: string): GoalEventStateView {
    const goal = this.requireGoal(boardId, goalId);
    const config = this.ports.events.readConfig(boardId, goalId);
    const requirements = this.ports.events.readCurrentRequirements(boardId, goalId);
    const work = this.ports.events.readWorkState(boardId, goalId);
    const latest = this.ports.events.listLatestReports(boardId, goalId, { limit: STATE_REPORT_LIMIT });
    const latestReports = latest.reports.map(reportSummary);
    const gaps: GoalEventWorkGap[] = requirements
      .filter((requirement) => !requirement.currently_satisfied)
      .map((requirement) => ({
        requirement_id: requirement.requirement_id,
        statement: requirement.statement,
        current_verdict: requirement.current_report?.verdict ?? null,
        human_decision_required: requirement.human_decision_required,
      }));
    const eventWork = work.owner != null;
    return {
      board_id: boardId,
      goal_id: goal.goal_id,
      intent: {
        title: goal.title,
        outcome: goal.outcome,
        definition_state: goal.definition_state,
        created_as_draft: goal.definition_state === "draft",
      },
      current_agreement: {
        definition_state: goal.definition_state,
        decomposition_state: goal.decomposition_state,
        fulfillment_state: goal.fulfillment_state,
        outcome: work.agreement.outcome || goal.outcome,
      },
      config,
      requirements,
      latest_reports: latestReports,
      gaps,
      observed_event_cursor: latest.observed_event_cursor,
      goal_event_cursor: this.ports.events.listLatestTimeline(boardId, goalId, { limit: 1 }).items[0]?.journal_seq ?? 0,
      event_list_next_cursor: null,
      protocol: eventWork
        ? {
            kind: "event_work",
            note: "当前 Goal 走事件工作协议：读取状态、在已有授权内工作、上报事实。创建和上报都不是正式完成。",
            claim_or_run_required: false,
          }
        : {
            kind: "legacy_claim_run",
            note: "这个 Goal 仍使用领取角色、Run、Evidence 与 Review 的旧协议。迁移完成前不要把普通事件上报当成完成。",
            claim_or_run_required: true,
          },
      owner: work.owner,
      work_status: work.work_status,
      agreement: work.agreement,
      progress_summary: work.progress_summary,
      concerns: work.concerns,
      pending_decisions: work.pending_decisions,
      applied_decisions: work.applied_decisions,
      current_decisions: work.current_decisions,
      closure: work.closure,
      recorded_not_completed: work.work_status !== "completed",
      completion_effect: work.work_status === "completed" && goal.fulfillment_state === "satisfied",
    };
  }

  configure(input: ConfigureGoalEventsApplicationInput): ConfigureGoalEventsResult {
    return this.ports.events.configureRequested(
      input,
      (boardId, requested) => this.ports.planning.resolveEventAdoption(boardId, requested),
    );
  }

  report(input: ReportGoalEventsInput): ReportGoalEventsResult {
    const result = this.ports.events.report(input);
    return {
      events: result.events,
      observed_event_cursor: result.observed_event_cursor,
      replayed: result.replayed,
    };
  }

  listEvents(boardId: string, goalId: string, query?: GoalEventListQuery): GoalEventListPage {
    return this.ports.events.listEvents(boardId, goalId, query);
  }

  listLatestEvents(boardId: string, goalId: string, query?: GoalEventHistoryQuery): GoalEventHistoryPage {
    return this.ports.events.listLatestEvents(boardId, goalId, query);
  }

  listLatestTimeline(boardId: string, goalId: string, query?: GoalEventHistoryQuery): GoalEventTimelinePage {
    return this.ports.events.listLatestTimeline(boardId, goalId, query);
  }

  readEvent(boardId: string, goalId: string, eventId: string): GoalWorkEventRecord {
    return this.ports.events.readEvent(boardId, goalId, eventId);
  }

  isEventStateOwner(boardId: string, goalId: string): boolean {
    return this.ports.events.isEventStateOwner(boardId, goalId);
  }

  recordProgress(input: RecordGoalProgressSummaryInput): GoalEventProgressResult {
    return this.ports.events.recordProgress(input);
  }

  applyConcern(input: ApplyGoalConcernInput): GoalEventConcernResult {
    return this.ports.events.applyConcern(input);
  }

  requestDecision(input: RequestGoalDecisionInput): GoalEventDecisionRequestResult {
    return this.ports.events.requestDecision(input);
  }

  citeDecision(input: CiteGoalDecisionInput): GoalEventDecisionResult {
    return this.ports.events.citeDecision(input);
  }

  recordTrustedDecision(input: RecordGoalUserDecisionInput): GoalEventDecisionResult {
    const persist = this.ports.recordTrustedDecision;
    if (!persist) {
      throw new GoalBoardV1Error(
        "event_decision.untrusted_actor",
        "用户决定必须经 Host 受保护入口与 Governance 来源校验，不能由 Runtime 自填",
      );
    }
    return this.ports.events.recordTrustedDecision(input, (normalized) => persist(normalized));
  }

  setAgreement(input: SetGoalEventAgreementInput): GoalEventAgreementResult {
    return this.ports.events.setAgreement(input);
  }

  submitClosure(input: SubmitGoalEventClosureInput): GoalEventClosureResult {
    return this.ports.events.submitClosure(input);
  }

  resumeWork(input: ResumeGoalEventWorkInput): GoalEventResumeResult {
    return this.ports.events.resumeWork(input);
  }

  continueWithEventWork(input: ContinueGoalEventWorkInput): ContinueGoalEventWorkResult {
    return this.ports.events.continueWithEventWork(input);
  }

  recordNote(input: RecordGoalNoteInput) {
    return this.ports.events.recordNote(input);
  }

  reopenCompletedEventWork(input: ReopenCompletedEventWorkInput) {
    return this.ports.events.reopenCompletedEventWork(input);
  }

  private requireGoal(boardId: string, goalId: string): GoalRecord {
    const goal = this.ports.query.getGoal(boardId, goalId);
    if (!goal) throw new GoalBoardV1Error("goal.not_found", `找不到这个 Goal: ${goalId}`);
    return goal;
  }
}

export function hostEventDecisionAuthority(
  source: GoalEventTrustedAuthority["authority_source"],
  boardId: string,
  actorId: string,
  idempotencyKey: string,
): GoalEventTrustedAuthority {
  return {
    actor_id: actorId,
    actor_kind: "user",
    authority_source: source,
    conversation_ref: `${source}:${boardId}`,
    message_ref: `${source}-event-decision:${idempotencyKey}`,
  };
}

function reportSummary(event: Extract<GoalWorkEventRecord, { kind: "report" }>): GoalEventReportSummary {
  return {
    event_id: event.event_id,
    title: event.title,
    type_id: event.type?.type_id ?? null,
    type_version: event.type?.version ?? null,
    received_at: event.received_at,
    journal_seq: event.journal_seq,
    judgments: event.judgments,
  };
}
