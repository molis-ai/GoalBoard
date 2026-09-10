import {
  goalEventClosureKinds,
  goalEventConcernActions,
  type ApplyGoalConcernInput,
  type CiteGoalDecisionInput,
  type ConfigureGoalEventsApplicationInput,
  type CreateGoalIntentInput,
  type RecordGoalProgressSummaryInput,
  type RecordGoalUserDecisionInput,
  type ReportGoalEventsInput,
  type ReportGoalWorkEventInput,
  type RequestGoalDecisionInput,
  type ResumeGoalEventWorkInput,
  type SetGoalEventAgreementInput,
  type SubmitGoalEventClosureInput,
} from "@adeptify/goalboard-contracts/modules/goals";
import { createGoalEventEntryClient, hostEventDecisionAuthority } from "@adeptify/goalboard-plugin-goals";
import type { LocalHostProjectClient } from "@adeptify/goalboard-contracts/platform/app-host";
import type { McpPresentationErrorFactory } from "./query-presentation.js";

const WRITE_TOOLS = new Set([
  "goalboard_v1_goal_intent_create",
  "goalboard_v1_event_configure",
  "goalboard_v1_event_report",
  "goalboard_v1_event_progress",
  "goalboard_v1_event_concern",
  "goalboard_v1_event_decision_request",
  "goalboard_v1_event_cite_decision",
  "goalboard_v1_event_agree",
  "goalboard_v1_event_close",
  "goalboard_v1_event_resume",
  "goalboard_v1_event_decide",
]);

const ALLOWED_KEYS: Record<string, readonly string[]> = {
  goalboard_v1_goal_intent_create: [
    "database_path", "board_id", "actor_id", "actor_kind", "title", "outcome", "goal_id", "idempotency_key",
  ],
  goalboard_v1_goal_state: ["database_path", "board_id", "goal_id"],
  goalboard_v1_event_configure: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "expected_version", "idempotency_key",
    "types", "adopted_planning", "adopt_default_requirement_ids", "new_requirements", "requirement_bindings",
  ],
  goalboard_v1_event_report: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "idempotency_key", "events",
  ],
  goalboard_v1_event_list: ["database_path", "board_id", "goal_id", "after_cursor", "limit"],
  goalboard_v1_event_read: ["database_path", "board_id", "goal_id", "event_id"],
  goalboard_v1_event_progress: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "idempotency_key",
    "based_on_cursor", "summary", "next_step", "next_actor",
  ],
  goalboard_v1_event_concern: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "idempotency_key", "action",
    "concern_id", "title", "statement", "scope", "blocks_closure", "reason",
    "supporting_event_ids", "cited_decision_id",
  ],
  goalboard_v1_event_decision_request: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "idempotency_key",
    "question", "options", "scope",
  ],
  goalboard_v1_event_cite_decision: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "idempotency_key", "decision_id", "scope",
  ],
  goalboard_v1_event_agree: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "idempotency_key",
    "expected_config_version", "expected_agreement_version", "outcome", "new_requirements",
  ],
  goalboard_v1_event_close: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "idempotency_key",
    "kind", "result", "reason", "expected_config_version", "expected_agreement_version",
  ],
  goalboard_v1_event_resume: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "idempotency_key", "reason",
  ],
  goalboard_v1_event_decide: [
    "database_path", "board_id", "actor_id", "actor_kind", "goal_id", "idempotency_key",
    "request_id", "selected_option_id", "conclusion", "accepts_requirements", "effects", "scope",
  ],
};

export function createMcpGoalEventHandlers(
  client: LocalHostProjectClient,
  audience: "runtime" | "management",
  createError: McpPresentationErrorFactory,
) {
  const events = createGoalEventEntryClient(client);
  const rejectUnknown = (name: string, input: Record<string, unknown>) => {
    const allowed = new Set(ALLOWED_KEYS[name] ?? []);
    const unexpected = Object.keys(input).filter((key) => !allowed.has(key));
    if (unexpected.length) {
      throw createError(
        "mcp.unexpected_field",
        `不能使用未许可字段：${unexpected.join("、")}`,
        { fields: unexpected },
      );
    }
  };
  const actor = (input: Record<string, unknown>) => {
    const actorId = String(input.actor_id ?? "").trim();
    if (!actorId) {
      throw createError(
        audience === "runtime" ? "mcp.runtime_identity_missing" : "mcp.actor_required",
        audience === "runtime"
          ? "宿主没有提供可信 Runtime 身份。请重新连接 GoalBoard MCP，不要在参数里填用户身份。"
          : "管理入口需要 actor_id",
      );
    }
    return {
      actor_id: actorId,
      actor_kind: audience === "runtime" ? "runtime" as const : "user" as const,
    };
  };

  return {
    goalboard_v1_goal_intent_create: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_goal_intent_create", input);
      const payload: CreateGoalIntentInput = {
        board_id: String(input.board_id),
        title: String(input.title ?? ""),
        outcome: input.outcome == null ? undefined : String(input.outcome),
        goal_id: input.goal_id == null ? undefined : String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        ...actor(input),
      };
      return events.createIntent(payload);
    },
    goalboard_v1_goal_state: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_goal_state", input);
      return events.readState(String(input.board_id), String(input.goal_id));
    },
    goalboard_v1_event_configure: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_configure", input);
      const payload: ConfigureGoalEventsApplicationInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        expected_version: Number(input.expected_version),
        idempotency_key: String(input.idempotency_key ?? ""),
        types: input.types as ConfigureGoalEventsApplicationInput["types"],
        adopted_planning: input.adopted_planning as ConfigureGoalEventsApplicationInput["adopted_planning"],
        adopt_default_requirement_ids: input.adopt_default_requirement_ids as string[] | undefined,
        new_requirements: input.new_requirements as ConfigureGoalEventsApplicationInput["new_requirements"],
        requirement_bindings: input.requirement_bindings as ConfigureGoalEventsApplicationInput["requirement_bindings"],
        ...actor(input),
      };
      return events.configure(payload);
    },
    goalboard_v1_event_report: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_report", input);
      const payload: ReportGoalEventsInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        events: (input.events as ReportGoalWorkEventInput[]) ?? [],
        ...actor(input),
      };
      return events.report(payload);
    },
    goalboard_v1_event_list: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_list", input);
      return events.listEvents(String(input.board_id), String(input.goal_id), {
        after_cursor: input.after_cursor == null ? undefined : Number(input.after_cursor),
        limit: input.limit == null ? undefined : Number(input.limit),
      });
    },
    goalboard_v1_event_read: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_read", input);
      return events.readEvent(String(input.board_id), String(input.goal_id), String(input.event_id));
    },
    goalboard_v1_event_progress: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_progress", input);
      const payload: RecordGoalProgressSummaryInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        based_on_cursor: Number(input.based_on_cursor),
        summary: String(input.summary ?? ""),
        next_step: input.next_step == null ? undefined : String(input.next_step),
        next_actor: input.next_actor == null ? undefined : String(input.next_actor),
        ...actor(input),
      };
      return events.recordProgress(payload);
    },
    goalboard_v1_event_concern: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_concern", input);
      if (typeof input.action !== "string" || !(goalEventConcernActions as readonly string[]).includes(input.action)) {
        throw createError("event_concern.invalid_action", "Concern 动作只能是 open、resolve、accept 或 overturn", { value: input.action });
      }
      const payload: ApplyGoalConcernInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        action: input.action as ApplyGoalConcernInput["action"],
        concern_id: input.concern_id == null ? undefined : String(input.concern_id),
        title: input.title == null ? undefined : String(input.title),
        statement: input.statement == null ? undefined : String(input.statement),
        scope: input.scope as ApplyGoalConcernInput["scope"],
        blocks_closure: input.blocks_closure == null ? undefined : Boolean(input.blocks_closure),
        reason: input.reason == null ? undefined : String(input.reason),
        supporting_event_ids: input.supporting_event_ids as string[] | undefined,
        cited_decision_id: input.cited_decision_id == null ? undefined : String(input.cited_decision_id),
        ...actor(input),
      };
      return events.applyConcern(payload);
    },
    goalboard_v1_event_decision_request: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_decision_request", input);
      const payload: RequestGoalDecisionInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        question: String(input.question ?? ""),
        options: input.options as RequestGoalDecisionInput["options"],
        scope: input.scope as RequestGoalDecisionInput["scope"],
        ...actor(input),
      };
      return events.requestDecision(payload);
    },
    goalboard_v1_event_cite_decision: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_cite_decision", input);
      const payload: CiteGoalDecisionInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        decision_id: String(input.decision_id),
        scope: input.scope as CiteGoalDecisionInput["scope"],
        ...actor(input),
      };
      return events.citeDecision(payload);
    },
    goalboard_v1_event_agree: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_agree", input);
      const payload: SetGoalEventAgreementInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        expected_config_version: input.expected_config_version == null ? undefined : Number(input.expected_config_version),
        expected_agreement_version: input.expected_agreement_version == null ? undefined : Number(input.expected_agreement_version),
        outcome: input.outcome == null ? undefined : String(input.outcome),
        new_requirements: input.new_requirements as SetGoalEventAgreementInput["new_requirements"],
        ...actor(input),
      };
      return events.setAgreement(payload);
    },
    goalboard_v1_event_close: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_close", input);
      if (typeof input.kind !== "string" || !(goalEventClosureKinds as readonly string[]).includes(input.kind)) {
        throw createError("event_closure.invalid_kind", "收尾类型只能是 complete 或 cancel", { value: input.kind });
      }
      const payload: SubmitGoalEventClosureInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        kind: input.kind as SubmitGoalEventClosureInput["kind"],
        result: input.result == null ? undefined : String(input.result),
        reason: String(input.reason ?? ""),
        expected_config_version: Number(input.expected_config_version),
        expected_agreement_version: input.expected_agreement_version == null ? undefined : Number(input.expected_agreement_version),
        ...actor(input),
      };
      return events.submitClosure(payload);
    },
    goalboard_v1_event_resume: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_resume", input);
      const payload: ResumeGoalEventWorkInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        reason: String(input.reason ?? ""),
        ...actor(input),
      };
      return events.resumeWork(payload);
    },
    goalboard_v1_event_decide: async (input: Record<string, unknown>) => {
      rejectUnknown("goalboard_v1_event_decide", input);
      if (audience !== "management") {
        throw createError(
          "mcp.authority_denied",
          "用户决定只能由受保护的管理入口或 Web 记录。Runtime 可以请求或引用已保存决定，不能自行批准。",
        );
      }
      const actorFields = actor(input);
      const payload: RecordGoalUserDecisionInput = {
        board_id: String(input.board_id),
        goal_id: String(input.goal_id),
        idempotency_key: String(input.idempotency_key ?? ""),
        authority: hostEventDecisionAuthority(
          "management",
          String(input.board_id),
          actorFields.actor_id,
          String(input.idempotency_key ?? ""),
        ),
        request_id: input.request_id == null ? undefined : String(input.request_id),
        selected_option_id: input.selected_option_id == null ? undefined : String(input.selected_option_id),
        conclusion: String(input.conclusion ?? ""),
        accepts_requirements: input.accepts_requirements === true ? true : input.accepts_requirements === false ? false : undefined,
        effects: input.effects as RecordGoalUserDecisionInput["effects"],
        scope: input.scope as RecordGoalUserDecisionInput["scope"],
      };
      return events.recordTrustedDecision(payload);
    },
  };
}

export function isGoalEventTool(name: string): boolean {
  return Object.hasOwn(ALLOWED_KEYS, name);
}

export function isGoalEventWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name);
}
