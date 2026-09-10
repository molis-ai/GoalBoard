import type {
  ClarificationAssumption, ClarificationAssumptionInput, ClarificationFact, ClarificationFactInput,
  ContractFieldSource, GovernanceProvenanceApi,
  GoalEventTrustedAuthority,
  GoalTreeProposalItemInput, GoalTreeProposalItemRecord,
} from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { CreateGoalInput } from "@adeptify/goalboard-contracts/modules/goals";
import { GovernanceError, type GovernanceErrorFactory } from "./errors.js";
import { legacyProposalView } from "./legacy-proposal-view.js";

/** Confirmation provenance belongs to Governance; a locator is not automatically a Ledger edge. */
export class GovernanceProvenance implements GovernanceProvenanceApi {
  readonly legacyProposalView = legacyProposalView;
  constructor(private readonly error: GovernanceErrorFactory = (code, message, details) => new GovernanceError(code, message, details)) {}

  normalizeProposalSource(input: Pick<GoalTreeProposalItemInput, "source_refs" | "reason" | "confidence" | "requires_user_confirmation">,
    index: number): Pick<GoalTreeProposalItemRecord, "source_refs" | "reason" | "confidence"> & { requires_user_confirmation: true } {
    const path = `items[${index}]`;
    const issues: Array<{ code: string; path: string; message: string; expected: string }> = [];
    const add = (field: string, code: string, message: string, expected: string) =>
      issues.push({ code, path: `${path}.${field}`, message, expected });
    const references = input.source_refs;
    const validReferences = Array.isArray(references) && references.every(ref => typeof ref === "string");
    const sourceRefs = validReferences ? [...new Set(references.map(ref => ref.trim()).filter(Boolean))].sort() : [];
    if (!sourceRefs.length || !validReferences) add("source_refs", "goal_tree_proposal.source_required",
      `第 ${index + 1} 个条目至少需要一个来源引用`, "包含真实来源的字符串数组，例如 [\"clarification-turn:实际 turn ID\"]");
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (!reason) add("reason", "goal_tree_proposal.reason_required", `第 ${index + 1} 个条目必须说明业务理由`, "非空字符串");
    if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
      add("confidence", "goal_tree_proposal.confidence_invalid", `第 ${index + 1} 个条目的置信度必须在 0 到 1 之间`, "0 到 1 的数字");
    }
    if (input.requires_user_confirmation !== undefined && input.requires_user_confirmation !== true) {
      add("requires_user_confirmation", "goal_tree_proposal.user_confirmation_required",
        "Goal Tree 提案的每个条目都必须等待用户确认，不能提前物化为正式事实", "省略或 true");
    }
    if (issues.length) {
      const first = issues[0]!;
      throw this.error(first.code, issues.map(issue => issue.message).join("；"), {
        path: first.path, issues,
        recovery: "修正列出的字段后重试 goalboard_v1_goal_tree_propose；失败调用不会创建提案，无需切换接口。",
      });
    }
    return { source_refs: sourceRefs, reason, confidence: input.confidence, requires_user_confirmation: true };
  }

  normalizeFacts(facts: readonly ClarificationFactInput[], turnId: string): ClarificationFact[] {
    return facts.map((fact) => {
      const statement = this.text(fact.statement, "draft_dialogue.fact_required", "每条已知事实都需要清楚说明");
      if (!["user_answer", "repository_fact", "document_fact"].includes(fact.source_kind)) {
        throw this.error("draft_dialogue.fact_source_invalid", "Runtime 推断必须写入假设，不能伪装成已知事实");
      }
      return { statement, source_kind: fact.source_kind, source_refs: references(fact.source_refs, turnId),
        confidence: this.confidence(fact.confidence, "事实"),
        confirmed_by_user: fact.source_kind === "user_answer" ? true : Boolean(fact.confirmed_by_user) };
    });
  }

  normalizeAssumptions(assumptions: readonly ClarificationAssumptionInput[], turnId: string): ClarificationAssumption[] {
    return assumptions.map((assumption) => ({
      statement: this.text(assumption.statement, "draft_dialogue.assumption_required", "每条假设都需要清楚说明"),
      source_refs: references(assumption.source_refs, turnId), confidence: this.confidence(assumption.confidence, "假设"),
      requires_user_confirmation: true,
    }));
  }

  /** Validate caller facts, and supply the two pending-proposal constants owned by Governance. */
  validateSourceShape(value: unknown): ContractFieldSource[] {
    if (!Array.isArray(value)) this.invalidField("field_sources", "字段来源对象数组");
    const issues: Array<{ path: string; expected: string }> = [];
    const sources = value.map((entry, index) => {
      const path = `field_sources[${index}]`;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        issues.push({ path, expected: "对象" });
        return entry;
      }
      const source = { ...entry, status: entry.status === undefined ? "proposed" : entry.status,
        requires_user_confirmation: entry.requires_user_confirmation === undefined ? true : entry.requires_user_confirmation };
      for (const field of ["field", "source_kind", "rationale"]) {
        if (typeof source[field] !== "string" || !source[field].trim()) issues.push({ path: `${path}.${field}`, expected: "非空字符串" });
      }
      if (source.status !== "proposed") issues.push({ path: `${path}.status`, expected: "proposed（可省略，由系统填写）" });
      if (!Array.isArray(source.source_refs)) issues.push({ path: `${path}.source_refs`, expected: "字符串数组" });
      else for (const [refIndex, ref] of source.source_refs.entries()) {
        if (typeof ref !== "string" || !ref.trim()) issues.push({ path: `${path}.source_refs[${refIndex}]`, expected: "非空字符串" });
      }
      if (typeof source.confidence !== "number" || !Number.isFinite(source.confidence) || source.confidence < 0 || source.confidence > 1)
        issues.push({ path: `${path}.confidence`, expected: "0 到 1 的数字" });
      if (source.requires_user_confirmation !== true) issues.push({ path: `${path}.requires_user_confirmation`, expected: "true（可省略，由系统填写）" });
      return source;
    });
    if (issues.length) {
      throw this.error("contract_proposal.field_invalid", issues.map(issue => `Contract Proposal 字段 ${issue.path} 必须是${issue.expected}。`).join("\n"), {
        ...issues[0], issues,
        recovery: "一次修正列出的字段后重试；status 和 requires_user_confirmation 可省略。失败调用不会创建 Proposal。",
      });
    }
    return sources as ContractFieldSource[];
  }

  validateContractSources(proposedGoal: Pick<CreateGoalInput, "constraints" | "required_inputs" | "promised_outputs">, fieldSources: readonly ContractFieldSource[]): void {
    const validFields = new Set(["title", "outcome", "why", "business_logic", "in_scope", "out_of_scope", "constraints",
      "required_inputs", "promised_outputs", "priority", "acceptance_criteria", "review_policy"]);
    const requiredFields = new Set(["title", "outcome", "why", "business_logic", "in_scope", "out_of_scope",
      "priority", "acceptance_criteria", "review_policy"]);
    if ((proposedGoal.constraints ?? []).length) requiredFields.add("constraints");
    if ((proposedGoal.required_inputs ?? []).length) requiredFields.add("required_inputs");
    if ((proposedGoal.promised_outputs ?? []).length) requiredFields.add("promised_outputs");
    const sourceKinds = new Set(["user_answer", "repository_fact", "document_fact", "runtime_inference"]);
    const seenFields = new Set<string>();
    for (const source of fieldSources) {
      if (!validFields.has(source.field) || seenFields.has(source.field)) {
        throw this.error("contract_proposal.source_invalid", `字段来源无效或重复: ${String(source.field)}`);
      }
      seenFields.add(source.field);
      const refs = Array.isArray(source.source_refs) ? source.source_refs.map(String).map((value) => value.trim()).filter(Boolean) : [];
      if (!sourceKinds.has(source.source_kind) || refs.length === 0 || !Number.isFinite(source.confidence)
        || source.confidence < 0 || source.confidence > 1 || !source.rationale?.trim()
        || source.status !== "proposed" || source.requires_user_confirmation !== true) {
        throw this.error("contract_proposal.source_invalid", `字段 ${String(source.field)} 必须保留来源、可信度、理由和待用户确认状态`);
      }
    }
    const missingSources = [...requiredFields].filter((field) => !seenFields.has(field));
    if (missingSources.length) throw this.error("contract_proposal.source_missing", `Contract Proposal 缺少字段来源: ${missingSources.join("、")}`);
  }

  validateEventDecisionAuthority(authority: GoalEventTrustedAuthority): GoalEventTrustedAuthority {
    if (!authority || typeof authority !== "object") {
      throw this.error("event_decision.untrusted_actor", "用户决定必须来自 Host 受保护入口，不能由客户端自填身份");
    }
    if (authority.actor_kind !== "user") {
      throw this.error("event_decision.untrusted_actor", "用户决定必须来自可信用户入口，Runtime 不能声明自己是用户");
    }
    if (authority.authority_source !== "web" && authority.authority_source !== "management") {
      throw this.error(
        "event_decision.runtime_dialogue_not_user",
        "Runtime 对话摘要引用不是系统读取到的用户消息，不能当作用户批准",
      );
    }
    const actorId = authority.actor_id?.trim();
    const conversationRef = authority.conversation_ref?.trim();
    const messageRef = authority.message_ref?.trim();
    if (!actorId || !conversationRef || !messageRef) {
      throw this.error("event_decision.untrusted_actor", "可信用户决定需要 Host 注入的 actor、会话与消息来源");
    }
    return {
      actor_id: actorId,
      actor_kind: "user",
      authority_source: authority.authority_source,
      conversation_ref: conversationRef,
      message_ref: messageRef,
    };
  }

  private text(value: string, code: string, message: string): string {
    const text = value.trim();
    if (!text) throw this.error(code, message);
    return text;
  }

  private confidence(value: number | undefined, label: string): number {
    const confidence = value ?? 1;
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw this.error("draft_dialogue.confidence_invalid", `${label} 的置信度必须在 0 到 1 之间`);
    }
    return confidence;
  }

  private invalidField(path: string, expected: string): never {
    throw this.error("contract_proposal.field_invalid", `Contract Proposal 字段 ${path} 必须是${expected}。`, {
      path, expected,
      recovery: `请按 goalboard_v1_contract_propose 工具 schema 修正 ${path}，并使用新的 idempotency_key 重试；失败调用不会创建 Proposal。`,
    });
  }
}

function references(value: string[] | undefined, turnId: string): string[] {
  return [...new Set([...(value ?? []).map((item) => item.trim()).filter(Boolean), `clarification-turn:${turnId}`])];
}
