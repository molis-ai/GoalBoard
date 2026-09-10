import type { GoalBoardSessionRecord, SessionTimelineEvent, SessionHandoffGoalContext } from "./types.js";

const MAX_CONTEXT_EVENTS = 8;
const MAX_CONTEXT_EVENT_CHARS = 700;

export function buildSessionHandoffPackage(input: {
  source_session: GoalBoardSessionRecord;
  project_name: string;
  goal_contract: SessionHandoffGoalContext;
  timeline: readonly SessionTimelineEvent[];
}): string {
  const { goal, work_state: workState, event_work: eventWork, event_facts: eventFacts } = input.goal_contract;
  const currentRuns = input.goal_contract.runs
    .filter((run) => run.state === "started" || run.state === "blocked")
    .map((run) => `${run.run_id} · ${run.state} · ${run.role} · ${run.actor_id} · ${run.started_at}`);
  const effectiveEvidence = input.goal_contract.evidence
    .filter((item) => item.lifecycle_state === "effective")
    .map((item) => `${item.result} · ${item.kind}: ${item.locator}`);
  const outputRefs = input.goal_contract.runs
    .flatMap((run) => run.output_refs)
    .filter((item, index, items) => item && items.indexOf(item) === index);
  const openRisks = input.goal_contract.risks
    .filter((risk) => risk.state === "open" || risk.state === "triggered")
    .map((risk) => `${risk.description}；处理：${risk.treatment_plan}`);
  const timeline = minimalSessionContext(input.timeline);
  const eventSection = eventWork && eventFacts
    ? [
        "## 当前事件工作",
        "",
        `- 协议：事件记录，不要领取角色或开始 Run`,
        `- 工作状态：${eventFacts.work_status}`,
        `- 当前约定：${eventFacts.outcome || "无"}`,
        `- 下一步：${eventFacts.next_step || "无"}`,
        `- 摘要是否过时：${eventFacts.stale_summary ? "是" : "否"}`,
        "",
        listSection("待决定（不要重复已决定内容）", eventFacts.pending_decisions),
        listSection("当前有效决定", eventFacts.current_decisions),
        listSection("未满足要求", eventFacts.gaps),
      ]
    : [];
  const lines = [
    `# Handoff：${goal.title}`,
    "",
    "> 这是一个新的 Runtime Session。请依据下列 GoalBoard 事实继续工作，不要假装继承来源 Runtime 的内存或未记录推理。",
    "",
    "## 来源",
    "",
    `- Project：${input.project_name}（${input.source_session.project_id ?? "未关联"}）`,
    `- 来源 Session：${input.source_session.session_id}`,
    `- 来源 Runtime：${input.source_session.runtime_id}`,
    `- 来源原生 Session：${input.source_session.native_runtime_session_id ?? "无"}`,
    `- 工作目录：${input.source_session.workspace_path ?? "未关联"}`,
    "",
    "## 当前 Goal",
    "",
    `- Goal ID：${goal.goal_id}`,
    `- 目标结果：${goal.outcome}`,
    `- 为什么：${goal.why}`,
    `- 业务逻辑：${goal.business_logic}`,
    `- 当前工作状态：${eventWork ? eventFacts?.work_status ?? workState.work_state : workState.work_state}`,
    `- 下一动作：${eventWork ? eventFacts?.next_step ?? "按当前差距继续" : workState.next_action ?? "无"}`,
    "",
    ...eventSection,
    listSection("范围内", goal.in_scope),
    listSection("范围外", goal.out_of_scope),
    listSection("约束", goal.constraints),
    listSection("所需输入", goal.required_inputs),
    listSection("承诺输出", goal.promised_outputs),
    listSection("当前 Run", currentRuns),
    "## 验收标准",
    "",
    ...goal.acceptance_criteria.flatMap((criterion) => [
      `- [ ] ${criterion.statement}`,
      `  - 通过条件：${criterion.pass_condition}`,
      `  - 判定方式：${criterion.decision_method}`,
    ]),
    "",
    listSection("有效 Evidence", effectiveEvidence),
    listSection("产物与输出引用", outputRefs),
    listSection("开放 Risk", openRisks),
    listSection("待检查角色", eventWork ? [] : workState.pending_review_roles),
    "## 最近 Session 上下文",
    "",
    ...(timeline.length > 0
      ? timeline.flatMap((event) => [
          `### ${event.label} · ${event.occurred_at}`,
          "",
          event.content,
          "",
        ])
      : ["没有可安全带入的逐轮上下文；请以 Goal Contract 和引用为准。", ""]),
    "## 继续执行",
    "",
    eventWork
      ? "先读取当前 goal_state，再从差距继续。已决定的内容不要再问。不要领取角色或开始 Run。重要事实写回同一个 Goal。"
      : "先核对当前仓库与 GoalBoard 状态，再从“下一动作”继续。重要决定、产物、Evidence 和阻塞仍写回同一个 Goal；不要创建第二套 Goal 状态。",
  ];
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function minimalSessionContext(events: readonly SessionTimelineEvent[]): SessionTimelineEvent[] {
  const selected = events.filter((event) =>
    event.kind === "user_message"
    || event.kind === "runtime_message"
    || event.kind === "artifact"
    || event.kind === "status");
  return selected.slice(-MAX_CONTEXT_EVENTS).map((event) => ({
    ...event,
    content: clipText(event.content, MAX_CONTEXT_EVENT_CHARS),
  }));
}

function listSection(title: string, values: readonly string[]): string {
  return [`## ${title}`, "", ...(values.length > 0 ? values.map((value) => `- ${value}`) : ["- 无"]), ""].join("\n");
}

function clipText(value: string, limit: number): string {
  const text = value.trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}
