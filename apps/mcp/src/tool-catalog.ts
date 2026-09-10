import type { McpToolDefinition } from "./protocol.js";
import { V1_TOOLS } from "./goal-tools.js";
import { EVENT_TOOLS } from "./goal-event-tools.js";
import { CONTEXT_TOOLS } from "./context-tools.js";

const SERVER_INFO = { name: "goalboard-mcp", version: "1.0.0" };

const TOOLS: McpToolDefinition[] = [...V1_TOOLS, ...EVENT_TOOLS, ...CONTEXT_TOOLS];

const RUNTIME_V1_TOOL_NAMES = new Set([
  "goalboard_v1_snapshot",
  "goalboard_v1_contract",
  "goalboard_v1_project_guidance_get",
  "goalboard_v1_project_guidance_add",
  "goalboard_v1_project_guidance_update",
  "goalboard_v1_ready",
  "goalboard_v1_available",
  "goalboard_v1_planning_methods",
  "goalboard_v1_planning_method_save",
  "goalboard_v1_planning_analyze_change",
  "goalboard_v1_planning_graph_check",
  "goalboard_v1_goal_intent_create",
  "goalboard_v1_goal_state",
  "goalboard_v1_event_configure",
  "goalboard_v1_event_report",
  "goalboard_v1_event_list",
  "goalboard_v1_event_read",
  "goalboard_v1_event_progress",
  "goalboard_v1_event_concern",
  "goalboard_v1_event_decision_request",
  "goalboard_v1_event_cite_decision",
  "goalboard_v1_event_agree",
  "goalboard_v1_event_close",
  "goalboard_v1_event_resume",
  "goalboard_v1_explain",
  "goalboard_v1_claim",
  "goalboard_v1_select_goal",
  "goalboard_v1_draft_dialogue_start",
  "goalboard_v1_draft_dialogue_turn",
  "goalboard_v1_draft_dialogue_resume",
  "goalboard_v1_goal_tree_propose",
  "goalboard_v1_goal_tree_read",
  "goalboard_v1_goal_tree_check",
  "goalboard_v1_goal_tree_decide",
  "goalboard_v1_claim_renew",
  "goalboard_v1_release",
  "goalboard_v1_run_start",
  "goalboard_v1_revalidate",
  "goalboard_v1_rework_request",
  "goalboard_v1_run_report",
  "goalboard_v1_evidence_submit",
  "goalboard_v1_evidence_correct",
  "goalboard_v1_review_submit",
  "goalboard_v1_complete",
  "goalboard_v1_goal_trash",
  "goalboard_v1_goal_trash_list",
  "goalboard_v1_goal_restore",
  "goalboard_v1_contract_propose",
  "goalboard_v1_candidate_submit",
  "goalboard_v1_dependency_propose",
]);

const RUNTIME_CONTEXT_TOOL_NAMES = new Set([
  "goalboard_v1_context_resolve",
  "goalboard_v1_context_list_projects",
  "goalboard_v1_context_reject_suggestion",
  "goalboard_v1_context_bind",
  "goalboard_v1_context_unbind",
  "goalboard_v1_context_create_and_bind",
  "goalboard_v1_project_delete",
]);

const RUNTIME_TOOL_NAMES = new Set([...RUNTIME_V1_TOOL_NAMES, ...RUNTIME_CONTEXT_TOOL_NAMES]);

function runtimeToolDefinition(tool: McpToolDefinition): McpToolDefinition {
  const clone = structuredClone(tool);
  const inputProperties = clone.inputSchema.properties as Record<string, unknown>;
  delete inputProperties.database_path;
  delete inputProperties.web_base_url;
  if (
    tool.name === "goalboard_v1_goal_intent_create"
    || tool.name === "goalboard_v1_event_configure"
    || tool.name === "goalboard_v1_event_report"
    || tool.name === "goalboard_v1_event_progress"
    || tool.name === "goalboard_v1_event_concern"
    || tool.name === "goalboard_v1_event_decision_request"
    || tool.name === "goalboard_v1_event_cite_decision"
    || tool.name === "goalboard_v1_event_agree"
    || tool.name === "goalboard_v1_event_close"
    || tool.name === "goalboard_v1_event_resume"
  ) {
    delete inputProperties.actor_id;
    const required = clone.inputSchema.required as string[];
    clone.inputSchema.required = required.filter((field) => field !== "actor_id");
  }
  if (tool.name === "goalboard_v1_goal_tree_decide") {
    delete inputProperties.authority;
    inputProperties.user_confirmed = {
      type: "boolean",
      description: "只有用户刚刚在当前对话中明确确认了这次决定时才传 true。",
    };
    inputProperties.confirmation_summary = {
      type: "string",
      description: "简要记录用户确认了什么；这是可审计的 Runtime 对话证明，不是密码学身份凭证。",
    };
    inputProperties.whole_confirmation_prompted = {
      type: "boolean",
      description: "上一问是否明确要求用户确认本次 proposal_id 指向的整份提案；仅用于 confirm_all_pending。其他无关 pending Proposal 不影响这次精确确认。",
    };
    const required = clone.inputSchema.required as string[];
    clone.inputSchema.required = required
      .filter((field) => field !== "authority")
      .concat(
        required.includes("runtime_actor_id") ? [] : ["runtime_actor_id"],
        ["user_confirmed", "confirmation_summary"],
      );
    clone.description =
      "在当前 Runtime 对话中执行用户已经明确表达的 Goal Tree 决定。goal_tree_read 返回的 native 或 legacy handle 都可直接使用。必须传 user_confirmed=true 和确认摘要；confirm_all_pending 全有或全无，并要求上一问明确点名本次 proposal_id，其他无关 pending Proposal 不制造歧义。逐项 decisions 才允许独立安全条目分别落地。成功应用后 semantic_review 会把结构校验通过与仍需复核的祖先、下游消费者、相邻上游依赖分开；Runtime 必须完成受影响子图复核，后续 canonical 调整仍需新 Proposal 和用户确认。Draft 上的 Risk 生命周期条目不能脱离同一轮确认中的完整 Goal Contract 单独落地；两者任一冲突时 canonical Goal 与 Risk 都不改变。GoalBoard 结合 MCP 宿主会话元数据记录审计来源，不把 Runtime 声明伪装成密码学证明。";
    return clone;
  }
  if (tool.name === "goalboard_v1_evidence_submit") {
    const payload = inputProperties.payload as { properties: Record<string, unknown> };
    payload.properties.kind = {
      type: "string",
      enum: ["test", "measurement", "artifact", "inspection", "attestation"],
      description: "Runtime MCP 不能写入 human_verdict；人工结论必须来自可信用户入口。",
    };
    clone.description = "提交当前 Contract revision 的 Runtime Evidence，并立即返回新动作投影。项目文件和 Markdown anchor 会做有界只读预检；外部、不透明或超限 locator 明确保留为 UNVERIFIED。人工验收不在 Runtime MCP 中开放。";
    return clone;
  }
  if (tool.name !== "goalboard_v1_review_submit") return clone;
  const payload = inputProperties.payload as { properties: Record<string, unknown> };
  payload.properties.actor_kind = {
    type: "string",
    enum: ["runtime"],
    description: "Runtime MCP 只能提交 Runtime Review；human approval 由用户入口完成。",
  };
  clone.description = "提交 Runtime 可承担的 Review；human approval 不在 Runtime MCP 中开放。";
  return clone;
}

const RUNTIME_TOOLS = TOOLS
  .filter((tool) => RUNTIME_TOOL_NAMES.has(tool.name))
  .map(runtimeToolDefinition);


/** Classify the same tool audience used by discovery before host execution. */
export function isRuntimeMcpTool(name: string): boolean {
  return RUNTIME_TOOL_NAMES.has(name);
}

/** Connection tools run before a project has been resolved. */
export function isRuntimeContextMcpTool(name: string): boolean {
  return RUNTIME_CONTEXT_TOOL_NAMES.has(name);
}

export { TOOLS as MCP_TOOLS, RUNTIME_TOOLS as RUNTIME_MCP_TOOLS, SERVER_INFO as MCP_SERVER_INFO };
