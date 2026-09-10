import { randomUUID } from "node:crypto";
import type {
  ConfigureGoalEventsApplicationInput,
  ConfigureGoalEventsInput,
  ApplyGoalConcernInput,
  CiteGoalDecisionInput,
  ConfigureGoalEventsResult,
  ContinueGoalEventWorkInput,
  GoalEventAdoptedPlanningRequest,
  GoalEventConfigView,
  GoalEventFactsApi,
  GoalEventHistoryPage,
  GoalEventHistoryQuery,
  GoalEventLatestReports,
  GoalEventLatestReportsQuery,
  GoalEventListPage,
  GoalEventListQuery,
  GoalEventRequirementStatus,
  GoalEventTimelineItem,
  GoalEventTimelinePage,
  GoalEventTypeDefinitionInput,
  GoalEventTrustedDecisionRecord,
  GoalRecord,
  GoalReportWorkEventRecord,
  GoalWorkEventRecord,
  RecordGoalProgressSummaryInput,
  RecordGoalUserDecisionInput,
  ReportGoalEventsInput,
  ReportGoalEventsResult,
  RequestGoalDecisionInput,
  ResolvedPlanningEventAdoption,
  RecordGoalNoteInput,
  ReopenCompletedEventWorkInput,
  ResumeGoalEventWorkInput,
  SetGoalEventAgreementInput,
  SubmitGoalEventClosureInput,
} from "@adeptify/goalboard-contracts/modules/goals";
import { GoalsCommandContext, requestHash } from "./command-support.js";
import { GoalEventFactsRepository, type StoredWorkEvent } from "./event-facts-repository.js";
import { GoalEventFactsConfig, configurationPayload } from "./event-facts-config.js";
import { GoalEventState } from "./event-state.js";
import { GoalEventStateRepository } from "./event-state-repository.js";
import { normalizeAdoptedPlanning, ownStringRecord } from "./event-facts-validation.js";
import { instantiatePlanningRequirementId } from "./planning/event-adoption.js";
import { requirementCurrentlySatisfied } from "./event-state-authorization.js";
import { parseGoalEventSystemPayload } from "./event-system-payload.js";
import { completionRiskReasons } from "./lifecycle-reasons.js";
import { resolveGoalPolicy } from "./query.js";
import type { GoalEventCompletionContext } from "./event-state-completion.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const DEFAULT_LATEST_REPORTS = 5;
const MAX_LATEST_REPORTS = 20;

export class GoalEventFacts implements GoalEventFactsApi {
  private readonly records: GoalEventFactsRepository;
  private readonly configWrites: GoalEventFactsConfig;
  private readonly state: GoalEventState;

  constructor(private readonly context: GoalsCommandContext) {
    this.records = new GoalEventFactsRepository(context.repository.db);
    this.configWrites = new GoalEventFactsConfig(context, this.records, (code, message, details) => context.error(code, message, details));
    this.state = new GoalEventState(
      context,
      this.records,
      new GoalEventStateRepository(context.repository.db),
      {
        requireWritableGoal: (boardId, goalId) => this.requireWritableGoal(boardId, goalId),
        actorKind: (kind) => this.actorKind(kind),
        configVersion: (boardId, goalId) => this.records.getConfig(boardId, goalId)?.current_version ?? 0,
        readCurrentRequirements: (boardId, goalId) => this.readCurrentRequirements(boardId, goalId),
        addRequirements: (input, goal) => this.addAgreementRequirements(input, goal),
        readCompletionContext: (boardId, goalId) => this.readCompletionContext(boardId, goalId),
      },
    );
  }

  configure(input: ConfigureGoalEventsInput): ConfigureGoalEventsResult {
    const hash = requestHash({
      board_id: input.board_id,
      goal_id: input.goal_id,
      expected_version: input.expected_version,
      types: input.types ?? [],
      adopted_planning: input.adopted_planning ?? [],
      requirement_bindings: input.requirement_bindings ?? [],
      new_requirements: input.new_requirements ?? [],
    });
    return this.context.repository.immediate(() => this.configureInTransaction(input, hash));
  }

  configureRequested(
    input: ConfigureGoalEventsApplicationInput,
    resolveAdoption: (boardId: string, requested: GoalEventAdoptedPlanningRequest[]) => ResolvedPlanningEventAdoption,
  ): ConfigureGoalEventsResult {
    const originalHash = requestHash({
      board_id: input.board_id,
      goal_id: input.goal_id,
      expected_version: input.expected_version,
      types: input.types ?? [],
      adopted_planning: input.adopted_planning ?? null,
      adopt_default_requirement_ids: input.adopt_default_requirement_ids ?? [],
      requirement_bindings: input.requirement_bindings ?? [],
      new_requirements: input.new_requirements ?? [],
    });
    return this.context.repository.immediate(() => {
      const replay = this.context.replay<Omit<ConfigureGoalEventsResult, "replayed">>(
        input.board_id, input.actor_id, "configure_goal_events_request", input.idempotency_key, originalHash,
      );
      if (replay) return { ...replay, replayed: true };

      const requested = input.adopted_planning;
      const resolved = requested && requested.length > 0
        ? resolveAdoption(input.board_id, requested)
        : { adopted_planning: [] as ResolvedPlanningEventAdoption["adopted_planning"], types: [] as GoalEventTypeDefinitionInput[], default_requirements: [] };
      const selectedIds = new Set((input.adopt_default_requirement_ids ?? []).map((value) => value.trim()).filter(Boolean));
      if (selectedIds.size) {
        const available = new Map(resolved.default_requirements.map((requirement) => [requirement.requirement_id, requirement]));
        for (const requirementId of selectedIds) {
          if (!available.has(requirementId)) {
            throw this.context.error(
              "event_config.default_requirement_not_found",
              `采用的规划里没有默认要求 ${requirementId}`,
              { requirement_id: requirementId },
            );
          }
        }
      }
      const instantiated = resolved.default_requirements
        .filter((requirement) => selectedIds.has(requirement.requirement_id))
        .map((requirement) => ({
          requirement_id: instantiatePlanningRequirementId(input.goal_id, requirement.requirement_id),
          statement: requirement.statement,
          bound_type_id: requirement.bound_type_id,
          source: {
            kind: "planning" as const,
            template_requirement_id: requirement.requirement_id,
            methods: requirement.sources ?? [],
          },
        }));
      const innerInput: ConfigureGoalEventsInput = {
        board_id: input.board_id,
        goal_id: input.goal_id,
        actor_id: input.actor_id,
        actor_kind: input.actor_kind,
        expected_version: input.expected_version,
        idempotency_key: input.idempotency_key,
        types: [...resolved.types, ...(input.types ?? [])],
        requirement_bindings: input.requirement_bindings,
        new_requirements: [...instantiated, ...(input.new_requirements ?? [])],
        ...(requested === undefined ? {} : { adopted_planning: resolved.adopted_planning }),
      };
      const innerHash = requestHash({
        board_id: innerInput.board_id,
        goal_id: innerInput.goal_id,
        expected_version: innerInput.expected_version,
        types: innerInput.types ?? [],
        adopted_planning: innerInput.adopted_planning ?? [],
        requirement_bindings: innerInput.requirement_bindings ?? [],
        new_requirements: innerInput.new_requirements ?? [],
      });
      const result = this.configureInTransaction(innerInput, innerHash);
      this.context.remember(
        input.board_id,
        input.actor_id,
        "configure_goal_events_request",
        input.idempotency_key,
        originalHash,
        { config: result.config, event_id: result.event_id, observed_event_cursor: result.observed_event_cursor },
        this.context.now().toISOString(),
      );
      return result;
    });
  }

  private configureInTransaction(input: ConfigureGoalEventsInput, hash: string): ConfigureGoalEventsResult {
      const replay = this.context.replay<Omit<ConfigureGoalEventsResult, "replayed">>(
        input.board_id, input.actor_id, "configure_goal_events", input.idempotency_key, hash,
      );
      if (replay) return { ...replay, replayed: true };

      const goal = this.requireWritableGoal(input.board_id, input.goal_id);
      const current = this.records.getConfig(input.board_id, input.goal_id);
      const currentVersion = current?.current_version ?? 0;
      if (input.expected_version !== currentVersion) {
        throw this.context.error(
          "event_config.version_conflict",
          `配置版本已是 ${currentVersion}，不能用期望版本 ${input.expected_version} 覆盖`,
          { current_version: currentVersion, expected_version: input.expected_version },
        );
      }

      const actorKind = this.actorKind(input.actor_kind);
      const nextVersion = currentVersion + 1;
      const at = this.context.now().toISOString();
      const addedTypes = this.configWrites.applyTypes(goal, input, nextVersion, at);
      const addedRequirements = this.configWrites.applyRequirements(goal, input, addedTypes, nextVersion, at);
      const addedBindings = this.configWrites.applyBindings(goal, input, addedTypes, addedRequirements, nextVersion, at);
      const adoptedPlanning = normalizeAdoptedPlanning(
        this.error,
        input.adopted_planning,
        currentVersion === 0 ? [] : this.records.listAdoptedPlanning(goal.board_id, goal.goal_id, currentVersion),
      );
      if (
        addedTypes.length === 0
        && addedRequirements.length === 0
        && addedBindings.length === 0
        && JSON.stringify(adoptedPlanning) === JSON.stringify(currentVersion === 0 ? [] : this.records.listAdoptedPlanning(goal.board_id, goal.goal_id, currentVersion))
      ) {
        throw this.context.error("event_config.no_changes", "配置没有增加类型、类型版本、要求或规划来源");
      }

      const eventId = `gevt-${randomUUID()}`;
      this.records.upsertConfig({
        board_id: goal.board_id,
        goal_id: goal.goal_id,
        current_version: nextVersion,
        updated_at: at,
        updated_by: input.actor_id,
      });
      this.records.insertConfigVersion({
        boardId: goal.board_id,
        goalId: goal.goal_id,
        version: nextVersion,
        actorId: input.actor_id,
        adoptedPlanning,
        createdAt: at,
        configEventId: eventId,
      });
      const payload = {
        config_version: nextVersion,
        types: addedTypes,
        extra_requirements: addedRequirements,
        requirement_bindings: addedBindings,
        adopted_planning: adoptedPlanning,
      };
      const cursor = this.context.repository.appendEvent({
        eventId,
        boardId: goal.board_id,
        actorId: input.actor_id,
        type: "goal.event_config.updated",
        objectType: "goal_event_config",
        objectId: goal.goal_id,
        reason: "登记 Goal 局部事件配置",
        payload,
        at,
      });
      this.records.insertWorkEvent({
        event_id: eventId,
        board_id: goal.board_id,
        goal_id: goal.goal_id,
        kind: "configuration",
        type_id: null,
        type_version: null,
        title: addedTypes.length === 1 ? `新增记录方式：${addedTypes[0]!.name}` : "更新当前 Goal 的事件配置",
        payload,
        actor_id: input.actor_id,
        actor_kind: actorKind,
        received_at: at,
        journal_seq: cursor,
        config_version: nextVersion,
      });
      this.state.adoptOwner({
        board_id: goal.board_id,
        goal_id: goal.goal_id,
        actor_id: input.actor_id,
        source: "configuration",
        outcome: goal.outcome,
      });
      const outcome = { config: this.configView(goal.board_id, goal.goal_id), event_id: eventId, observed_event_cursor: cursor };
      this.context.remember(goal.board_id, input.actor_id, "configure_goal_events", input.idempotency_key, hash, outcome, at);
      return { ...outcome, replayed: false };
  }

  report(input: ReportGoalEventsInput): ReportGoalEventsResult {
    const hash = requestHash({
      board_id: input.board_id,
      goal_id: input.goal_id,
      events: input.events,
    });
    return this.context.repository.immediate(() => {
      const replay = this.context.replay<Omit<ReportGoalEventsResult, "replayed">>(
        input.board_id, input.actor_id, "report_goal_events", input.idempotency_key, hash,
      );
      if (replay) return { ...replay, replayed: true };

      const goal = this.requireWritableGoal(input.board_id, input.goal_id);
      if (!Array.isArray(input.events) || input.events.length === 0) {
        throw this.context.error("event_report.empty_batch", "至少需要一条工作事实");
      }
      const prepared = input.events.map((item, index) => this.configWrites.prepareReport(goal, item, index));
      const at = this.context.now().toISOString();
      const actorKind = this.actorKind(input.actor_kind);
      const stored: GoalReportWorkEventRecord[] = [];
      for (const item of prepared) {
        const eventId = `gevt-${randomUUID()}`;
        const cursor = this.context.repository.appendEvent({
          eventId,
          boardId: goal.board_id,
          actorId: input.actor_id,
          type: "goal.work_event.recorded",
          objectType: "goal_work_event",
          objectId: eventId,
          reason: item.title,
          payload: {
            type_id: item.type.type_id,
            type_version: item.type.version,
            fields: item.fields,
            judgments: item.judgments,
          },
          at,
        });
        const event: StoredWorkEvent = {
          event_id: eventId,
          board_id: goal.board_id,
          goal_id: goal.goal_id,
          kind: "report",
          type_id: item.type.type_id,
          type_version: item.type.version,
          title: item.title,
          payload: item.fields,
          actor_id: input.actor_id,
          actor_kind: actorKind,
          received_at: at,
          journal_seq: cursor,
          config_version: this.records.getConfig(goal.board_id, goal.goal_id)?.current_version ?? null,
        };
        this.records.insertWorkEvent(event);
        this.records.insertJudgments(eventId, item.judgments);
        stored.push(this.toReportEvent(event));
      }
      const contradicted = [...new Set(prepared.flatMap((item) =>
        item.judgments.filter((judgment) => judgment.verdict === "contradicts").map((judgment) => judgment.requirement_id),
      ))];
      this.state.reassessAfterReports(goal, input.actor_id, actorKind, contradicted);
      const outcome = {
        events: stored,
        observed_event_cursor: stored[stored.length - 1]!.journal_seq,
      };
      this.context.remember(goal.board_id, input.actor_id, "report_goal_events", input.idempotency_key, hash, outcome, at);
      return { ...outcome, replayed: false };
    });
  }

  readConfig(boardId: string, goalId: string): GoalEventConfigView {
    this.context.requireGoal(boardId, goalId);
    return this.configView(boardId, goalId);
  }

  listEvents(boardId: string, goalId: string, query: GoalEventListQuery = {}): GoalEventListPage {
    this.context.requireGoal(boardId, goalId);
    const afterCursor = query.after_cursor ?? 0;
    if (!Number.isInteger(afterCursor) || afterCursor < 0) {
      throw this.context.error("event_list.invalid_cursor", "分页游标必须是非负整数");
    }
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw this.context.error("event_list.invalid_limit", `每页最多 ${MAX_PAGE_SIZE} 条`);
    }
    const rows = this.records.listWorkEvents(boardId, goalId, afterCursor, limit);
    return {
      events: rows.map((row) => this.toWorkEvent(row)),
      next_cursor: rows.length === limit ? rows[rows.length - 1]!.journal_seq : null,
      observed_event_cursor: this.context.repository.eventCursor(boardId),
    };
  }

  listLatestEvents(boardId: string, goalId: string, query: GoalEventHistoryQuery = {}): GoalEventHistoryPage {
    const rows = this.latestWorkEventRows(boardId, goalId, query);
    return {
      events: rows.map((row) => this.toWorkEvent(row)),
      next_cursor: rows.length === (query.limit ?? DEFAULT_PAGE_SIZE) ? rows[rows.length - 1]!.journal_seq : null,
      observed_event_cursor: this.context.repository.eventCursor(boardId),
    };
  }

  listLatestTimeline(boardId: string, goalId: string, query: GoalEventHistoryQuery = {}): GoalEventTimelinePage {
    const rows = this.latestWorkEventRows(boardId, goalId, query);
    return {
      items: rows.map((row) => this.toTimelineItem(row)),
      next_cursor: rows.length === (query.limit ?? DEFAULT_PAGE_SIZE) ? rows[rows.length - 1]!.journal_seq : null,
      observed_event_cursor: this.context.repository.eventCursor(boardId),
    };
  }

  listLatestReports(boardId: string, goalId: string, query: GoalEventLatestReportsQuery = {}): GoalEventLatestReports {
    this.context.requireGoal(boardId, goalId);
    const limit = query.limit ?? DEFAULT_LATEST_REPORTS;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LATEST_REPORTS) {
      throw this.context.error("event_list.invalid_limit", `最新报告最多 ${MAX_LATEST_REPORTS} 条`);
    }
    return {
      reports: this.records.listLatestReportEvents(boardId, goalId, limit).map((row) => this.toReportEvent(row)),
      observed_event_cursor: this.context.repository.eventCursor(boardId),
    };
  }

  readEvent(boardId: string, goalId: string, eventId: string): GoalWorkEventRecord {
    this.context.requireGoal(boardId, goalId);
    const row = this.records.getWorkEvent(boardId, goalId, eventId);
    if (!row) throw this.context.error("event.not_found", `事件不存在: ${eventId}`);
    return this.toWorkEvent(row);
  }

  readCurrentRequirements(boardId: string, goalId: string): GoalEventRequirementStatus[] {
    const goal = this.context.requireGoal(boardId, goalId);
    const bindings = this.records.listBindings(boardId, goalId);
    const extra = this.records.listExtraRequirements(boardId, goalId);
    const latest = new Map<string, GoalEventRequirementStatus["current_report"]>();
    const conclusions = new GoalEventStateRepository(this.context.repository.db).latestConclusions(boardId, goalId);
    for (const row of this.records.listLatestJudgments(boardId, goalId)) {
      if (latest.has(row.requirement_id)) continue;
      latest.set(row.requirement_id, {
        event_id: row.event_id,
        actor_id: row.actor_id,
        actor_kind: row.actor_kind,
        verdict: row.verdict,
        received_at: row.received_at,
        journal_seq: row.journal_seq,
        independent_verification: false,
        substitutes_human_decision: false,
      });
    }
    const boundByRequirement = new Map<string, string[]>();
    for (const binding of bindings) {
      boundByRequirement.set(binding.requirement_id, [...(boundByRequirement.get(binding.requirement_id) ?? []), binding.type_id]);
    }
    for (const requirement of extra) {
      if (requirement.bound_type_id) {
        const current = boundByRequirement.get(requirement.requirement_id) ?? [];
        if (!current.includes(requirement.bound_type_id)) current.push(requirement.bound_type_id);
        boundByRequirement.set(requirement.requirement_id, current);
      }
    }
    const criteria = goal.acceptance_criteria.map((criterion) => ({
      requirement_id: criterion.criterion_id,
      goal_id: goal.goal_id,
      statement: criterion.statement,
      origin: {
        kind: "acceptance_criterion" as const,
        decision_method: criterion.decision_method,
        pass_condition: criterion.pass_condition,
      },
      bound_type_ids: boundByRequirement.get(criterion.criterion_id) ?? [],
      human_decision_required: criterion.decision_method === "human_decision",
      current_report: latest.get(criterion.criterion_id) ?? null,
      user_conclusion: conclusions.get(criterion.criterion_id) ?? null,
      currently_satisfied: false,
    }));
    const extras = extra.map((requirement) => ({
      requirement_id: requirement.requirement_id,
      goal_id: goal.goal_id,
      statement: requirement.statement,
      origin: {
        kind: "goal_event_requirement" as const,
        config_version: requirement.created_in_config_version,
        ...(requirement.source ? { planning: requirement.source } : {}),
      },
      bound_type_ids: boundByRequirement.get(requirement.requirement_id) ?? [],
      human_decision_required: false,
      current_report: latest.get(requirement.requirement_id) ?? null,
      user_conclusion: conclusions.get(requirement.requirement_id) ?? null,
      currently_satisfied: false,
    }));
    return [...criteria, ...extras].map((item) => ({
      ...item,
      currently_satisfied: requirementCurrentlySatisfied(item),
    }));
  }

  private readCompletionContext(boardId: string, goalId: string): GoalEventCompletionContext {
    const openDependencies = this.context.repository.db.prepare(`
      SELECT g.goal_id, g.title, g.fulfillment_state
      FROM goal_relations r
      JOIN goals g ON g.goal_id = r.to_goal_id
      WHERE r.board_id = ? AND r.from_goal_id = ?
        AND r.type = 'depends_on' AND r.state = 'active'
      ORDER BY g.goal_id
    `).all(boardId, goalId) as Array<{ goal_id: string; title: string; fulfillment_state: string }>;
    const policy = resolveGoalPolicy(this.context.repository.listActivePolicyBindings(boardId, goalId));
    const blockingRisks = completionRiskReasons(this.context, goalId)
      .filter((reason) => reason.facts?.blocking_mode === "completion")
      .map((reason) => ({ risk_id: reason.subject_id, description: reason.message }));
    return {
      open_dependencies: openDependencies
        .filter((row) => row.fulfillment_state !== "satisfied")
        .map((row) => ({ goal_id: row.goal_id, title: row.title })),
      human_approval_required: policy.human_approval === true,
      blocking_risks: blockingRisks,
    };
  }

  isEventStateOwner(boardId: string, goalId: string): boolean {
    this.context.requireGoal(boardId, goalId);
    return this.state.isEventStateOwner(boardId, goalId);
  }

  readWorkState(boardId: string, goalId: string) {
    return this.state.readWorkState(boardId, goalId);
  }

  runImmediate<T>(operation: () => T): T {
    return this.context.repository.immediate(operation);
  }

  adoptOwner(input: {
    board_id: string;
    goal_id: string;
    actor_id: string;
    source: "intent" | "configuration" | "continue";
    outcome?: string;
  }): void {
    this.state.adoptOwner(input);
  }

  continueWithEventWork(input: ContinueGoalEventWorkInput) {
    return this.state.continueWithEventWork(input);
  }

  recordProgress(input: RecordGoalProgressSummaryInput) {
    return this.state.recordProgress(input);
  }

  applyConcern(input: ApplyGoalConcernInput) {
    return this.state.applyConcern(input);
  }

  requestDecision(input: RequestGoalDecisionInput) {
    return this.state.requestDecision(input);
  }

  citeDecision(input: CiteGoalDecisionInput) {
    return this.state.citeDecision(input);
  }

  recordTrustedDecision(
    input: RecordGoalUserDecisionInput,
    persistGovernance: (normalized: RecordGoalUserDecisionInput) => GoalEventTrustedDecisionRecord,
  ) {
    return this.state.recordTrustedDecision(input, persistGovernance);
  }

  setAgreement(input: SetGoalEventAgreementInput) {
    return this.state.setAgreement(input);
  }

  submitClosure(input: SubmitGoalEventClosureInput) {
    return this.state.submitClosure(input);
  }

  resumeWork(input: ResumeGoalEventWorkInput) {
    return this.state.resumeWork(input);
  }

  recordNote(input: RecordGoalNoteInput) {
    return this.state.recordNote(input);
  }

  reopenCompletedEventWork(input: ReopenCompletedEventWorkInput) {
    return this.state.reopenCompletedEventWork(input);
  }

  private requireWritableGoal(boardId: string, goalId: string): GoalRecord {
    this.context.requireBoard(boardId);
    const goal = this.context.requireGoal(boardId, goalId);
    if (goal.trashed_at) {
      throw this.context.error("goal.trashed", "回收站中的 Goal 不能登记事件配置或上报工作事实");
    }
    return goal;
  }

  private configView(boardId: string, goalId: string): GoalEventConfigView {
    const current = this.records.getConfig(boardId, goalId);
    return {
      board_id: boardId,
      goal_id: goalId,
      version: current?.current_version ?? 0,
      types: this.records.listLatestTypes(boardId, goalId),
      adopted_planning: current ? this.records.listAdoptedPlanning(boardId, goalId, current.current_version) : [],
      extra_requirements: this.records.listExtraRequirements(boardId, goalId),
      requirement_bindings: this.records.listBindings(boardId, goalId),
      updated_at: current?.updated_at ?? null,
      updated_by: current?.updated_by ?? null,
    };
  }

  private addAgreementRequirements(input: SetGoalEventAgreementInput, goal: GoalRecord): void {
    if (!input.new_requirements?.length) return;
    const at = this.context.now().toISOString();
    const configVersion = this.records.getConfig(goal.board_id, goal.goal_id)?.current_version ?? 0;
    this.configWrites.applyRequirements(
      goal,
      {
        board_id: input.board_id,
        goal_id: input.goal_id,
        actor_id: input.actor_id,
        actor_kind: input.actor_kind,
        expected_version: input.expected_config_version ?? configVersion,
        idempotency_key: input.idempotency_key,
        new_requirements: input.new_requirements,
      },
      [],
      configVersion,
      at,
    );
  }

  private latestWorkEventRows(boardId: string, goalId: string, query: GoalEventHistoryQuery) {
    this.context.requireGoal(boardId, goalId);
    const beforeCursor = query.before_cursor;
    if (beforeCursor != null && (!Number.isInteger(beforeCursor) || beforeCursor < 1)) {
      throw this.context.error("event_list.invalid_cursor", "最新页游标必须是正整数");
    }
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw this.context.error("event_list.invalid_limit", `每页最多 ${MAX_PAGE_SIZE} 条`);
    }
    return this.records.listLatestWorkEvents(boardId, goalId, beforeCursor ?? null, limit);
  }

  private toTimelineItem(row: StoredWorkEvent): GoalEventTimelineItem {
    const event = this.toWorkEvent(row);
    return {
      event_id: event.event_id,
      journal_seq: event.journal_seq,
      received_at: event.received_at,
      title: event.title,
      kind: event.kind,
      type_id: event.kind === "report" ? event.type?.type_id ?? row.type_id : null,
      type_name: event.kind === "report" ? event.type?.name ?? null : event.kind === "configuration" ? "配置" : "系统",
      semantic_family: event.kind === "report" ? event.type?.semantic_family ?? null : null,
      system_operation: event.kind === "system" ? event.payload.operation : null,
      actor_id: event.actor_id,
      actor_kind: event.actor_kind,
    };
  }

  private toWorkEvent(row: StoredWorkEvent): GoalWorkEventRecord {
    if (row.kind === "configuration") return this.toConfigurationEvent(row);
    if (row.kind === "system") return this.toSystemEvent(row);
    return this.toReportEvent(row);
  }

  private toSystemEvent(row: StoredWorkEvent): Extract<GoalWorkEventRecord, { kind: "system" }> {
    return {
      ...this.workEventBase(row),
      kind: "system",
      type: null,
      payload: parseGoalEventSystemPayload(row.payload),
      judgments: this.records.listJudgments(row.event_id),
    };
  }

  private toConfigurationEvent(row: StoredWorkEvent): GoalWorkEventRecord {
    return {
      ...this.workEventBase(row),
      kind: "configuration",
      type: null,
      payload: configurationPayload(row.payload),
      judgments: this.records.listJudgments(row.event_id),
    };
  }

  private toReportEvent(row: StoredWorkEvent): GoalReportWorkEventRecord {
    const type = row.type_id != null && row.type_version != null
      ? this.records.getType(row.board_id, row.goal_id, row.type_id, row.type_version)
      : null;
    return {
      ...this.workEventBase(row),
      kind: "report",
      type,
      payload: ownStringRecord(row.payload),
      judgments: this.records.listJudgments(row.event_id),
    };
  }

  private workEventBase(row: StoredWorkEvent) {
    return {
      event_id: row.event_id,
      board_id: row.board_id,
      goal_id: row.goal_id,
      title: row.title,
      actor_id: row.actor_id,
      actor_kind: row.actor_kind,
      received_at: row.received_at,
      journal_seq: row.journal_seq,
      config_version: row.config_version,
    };
  }

  private actorKind(kind: "user" | "runtime" | undefined): "user" | "runtime" | null {
    if (kind == null) return null;
    if (kind !== "user" && kind !== "runtime") throw this.context.error("event_report.invalid_actor_kind", "actor_kind 只能是 user 或 runtime");
    return kind;
  }

  private readonly error = (code: string, message: string, details?: Record<string, unknown>) =>
    this.context.error(code, message, details);
}
