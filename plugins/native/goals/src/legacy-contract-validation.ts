import type { GoalsQueryApi, GoalsCommandApi, CreateGoalInput, GoalPolicy } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceApplicationApi, ContractFieldSource, ContractProposalImpact, ContractProposalRisk } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { SubmitContractProposalInput } from "./legacy-proposal-contract.js";
import { goalProposalLeafReadinessIssues } from "@adeptify/goalboard-module-goals";

/** Original legacy Contract wire checks, composed with owner fact and provenance validation. */
export class LegacyContractProposalValidator {
  constructor(private readonly ports: {
    goals: { query: Pick<GoalsQueryApi, "criterionGoalId" | "getRisk">; commands: Pick<GoalsCommandApi, "validateGoalInput"> };
    governance: Pick<GovernanceApplicationApi, "provenance" | "query">;
    errorFactory: (code: string, message: string, details?: Record<string, unknown>) => Error;
  }) {}

  private contractProposalFieldInvalid(path: string, expected: string): never {
    throw this.ports.errorFactory(
      "contract_proposal.field_invalid",
      `Contract Proposal 字段 ${path} 必须是${expected}。`,
      {
        path,
        expected,
        recovery: `请按 goalboard_v1_contract_propose 工具 schema 修正 ${path}，并使用新的 idempotency_key 重试；失败调用不会创建 Proposal。`,
      },
    );
  }
  
  private contractProposalRecord(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      this.contractProposalFieldInvalid(path, "对象");
    }
    return value as Record<string, unknown>;
  }
  
  private contractProposalString(value: unknown, path: string): string {
    if (typeof value !== "string" || !value.trim()) {
      this.contractProposalFieldInvalid(path, "非空字符串");
    }
    return value;
  }
  
  private contractProposalStringArray(value: unknown, path: string): string[] {
    if (!Array.isArray(value)) this.contractProposalFieldInvalid(path, "字符串数组");
    for (const [index, item] of value.entries()) {
      this.contractProposalString(item, `${path}[${index}]`);
    }
    return value as string[];
  }
  
  validateShape(input: SubmitContractProposalInput): void {
    const raw = input as unknown as Record<string, unknown>;
    for (const field of ["board_id", "goal_id", "actor_id", "discovered_in_run_id", "idempotency_key"]) {
      this.contractProposalString(raw[field], field);
    }
  
    const goal = this.contractProposalRecord(raw.proposed_goal, "proposed_goal");
    for (const field of ["goal_id", "title", "outcome", "why", "business_logic", "definition_state", "decomposition_state"]) {
      this.contractProposalString(goal[field], `proposed_goal.${field}`);
    }
    for (const field of ["in_scope", "out_of_scope", "required_inputs", "promised_outputs"]) {
      this.contractProposalStringArray(goal[field], `proposed_goal.${field}`);
    }
    if (goal.constraints != null) {
      this.contractProposalStringArray(goal.constraints, "proposed_goal.constraints");
    }
    if (typeof goal.priority !== "number" || !Number.isFinite(goal.priority)) {
      this.contractProposalFieldInvalid("proposed_goal.priority", "有限数字");
    }
    this.contractProposalRecord(goal.leaf_readiness, "proposed_goal.leaf_readiness");
    if (!Array.isArray(goal.acceptance_criteria) || goal.acceptance_criteria.length === 0) {
      this.contractProposalFieldInvalid("proposed_goal.acceptance_criteria", "至少含一个验收对象的数组");
    }
    for (const [index, value] of goal.acceptance_criteria.entries()) {
      const path = `proposed_goal.acceptance_criteria[${index}]`;
      const criterion = this.contractProposalRecord(value, path);
      for (const field of ["criterion_id", "statement", "decision_method", "pass_condition"]) {
        this.contractProposalString(criterion[field], `${path}.${field}`);
      }
      if (criterion.required_evidence != null) {
        this.contractProposalStringArray(criterion.required_evidence, `${path}.required_evidence`);
      }
      if (
        criterion.target != null &&
        (typeof criterion.target !== "object" || Array.isArray(criterion.target))
      ) {
        this.contractProposalFieldInvalid(`${path}.target`, "对象或 null");
      }
    }
  
    this.ports.governance.provenance.validateSourceShape(raw.field_sources);
  
    const policy = this.contractProposalRecord(raw.review_policy, "review_policy");
    this.contractProposalString(policy.goal_mode, "review_policy.goal_mode");
    this.contractProposalStringArray(policy.required_capabilities, "review_policy.required_capabilities");
    for (const field of ["self_verification", "human_approval"]) {
      if (typeof policy[field] !== "boolean") this.contractProposalFieldInvalid(`review_policy.${field}`, "boolean");
    }
    for (const field of ["cross_reviewers", "adversarial_reviewers", "max_lease_seconds"]) {
      if (typeof policy[field] !== "number" || !Number.isFinite(policy[field])) {
        this.contractProposalFieldInvalid(`review_policy.${field}`, "数字");
      }
    }
  
    for (const field of ["proposed_impacts", "proposed_risks"] as const) {
      const values = raw[field];
      if (values == null) continue;
      if (!Array.isArray(values)) this.contractProposalFieldInvalid(field, "对象数组");
      for (const [index, value] of values.entries()) this.contractProposalRecord(value, `${field}[${index}]`);
    }
    if (raw.dependency_rewire_ids != null) {
      this.contractProposalStringArray(raw.dependency_rewire_ids, "dependency_rewire_ids");
    }
  }

  validate(
    boardId: string,
    goalId: string,
    proposedGoal: CreateGoalInput,
    fieldSources: ContractFieldSource[],
    reviewPolicy: GoalPolicy,
    proposedImpacts: ContractProposalImpact[],
    proposedRisks: ContractProposalRisk[],
    dependencyRewireIds: string[],
    requireResolvedDependencies: boolean,
  ): void {
    if (proposedGoal.goal_id !== goalId) {
      throw this.ports.errorFactory(
        "contract_proposal.goal_mismatch",
        "Contract Proposal 必须补全同一个 Draft Goal，不能换成新 Goal ID",
      );
    }
    if (
      proposedGoal.definition_state !== "accepted" ||
      proposedGoal.decomposition_state !== "closed_leaf"
    ) {
      throw this.ports.errorFactory(
        "contract_proposal.not_executable",
        "Contract Proposal 必须明确形成 accepted / closed_leaf 的最小可执行 Goal",
      );
    }
    this.ports.goals.commands.validateGoalInput(proposedGoal);
    const leafReadinessIssue = goalProposalLeafReadinessIssues(
      {
        item_id: `contract-proposal:${goalId}`,
        kind: "contract",
        operation: "update",
        payload: proposedGoal as unknown as Record<string, unknown>,
      },
      proposedGoal as unknown as Record<string, unknown>,
      "proposed_goal",
    )[0];
    if (leafReadinessIssue) {
      const { code, message, recovery, ...details } = leafReadinessIssue;
      throw this.ports.errorFactory(
        code,
        `${message}${recovery}`,
        details,
      );
    }
    const priority = proposedGoal.priority;
    if (!Number.isInteger(priority) || Number(priority) < 0 || Number(priority) > 100) {
      throw this.ports.errorFactory(
        "contract_proposal.priority_invalid",
        "Contract Proposal 必须给出 0 到 100 的明确优先级",
      );
    }
    const criterionIds = proposedGoal.acceptance_criteria
      .map((criterion) => criterion.criterion_id?.trim())
      .filter((criterionId): criterionId is string => Boolean(criterionId));
    if (new Set(criterionIds).size !== criterionIds.length) {
      throw this.ports.errorFactory(
        "contract_proposal.acceptance_duplicate",
        "Contract Proposal 的验收条件 ID 不能重复",
      );
    }
    for (const criterionId of criterionIds) {
      const existing = this.ports.goals.query.criterionGoalId(criterionId);
      if (existing && existing !== goalId) {
        throw this.ports.errorFactory(
          "contract_proposal.acceptance_conflict",
          `验收条件 ID 已被其他 Goal 使用: ${criterionId}`,
        );
      }
    }

    this.ports.governance.provenance.validateContractSources(proposedGoal, fieldSources);

    const goalModes = new Set(["disabled", "preferred", "required"]);
    if (
      !goalModes.has(reviewPolicy.goal_mode) ||
      !Array.isArray(reviewPolicy.required_capabilities) ||
      reviewPolicy.required_capabilities.some(
        (capability) => typeof capability !== "string" || !capability.trim(),
      ) ||
      typeof reviewPolicy.self_verification !== "boolean" ||
      !Number.isInteger(reviewPolicy.cross_reviewers) ||
      reviewPolicy.cross_reviewers < 0 ||
      !Number.isInteger(reviewPolicy.adversarial_reviewers) ||
      reviewPolicy.adversarial_reviewers < 0 ||
      typeof reviewPolicy.human_approval !== "boolean" ||
      !Number.isInteger(reviewPolicy.max_lease_seconds) ||
      reviewPolicy.max_lease_seconds <= 0
    ) {
      throw this.ports.errorFactory(
        "contract_proposal.policy_invalid",
        "Contract Proposal 必须包含完整、有效的 Goal Mode 与 Review policy",
      );
    }

    const impactAccesses = new Set(["read", "write", "decide", "exclusive"]);
    for (const impact of proposedImpacts) {
      if (
        !impact.surface?.trim() ||
        !impactAccesses.has(impact.access) ||
        !impact.reason?.trim()
      ) {
        throw this.ports.errorFactory(
          "contract_proposal.impact_invalid",
          "每个 Impact 必须说明影响面、访问方式和原因",
        );
      }
    }

    const treatments = new Set(["accept", "mitigate", "avoid", "defer"]);
    const blockingModes = new Set(["none", "claim", "completion", "invalidate_on_trigger"]);
    const proposedRiskIds = new Set<string>();
    for (const risk of proposedRisks) {
      const riskId = risk.risk_id?.trim();
      if (
        !riskId ||
        proposedRiskIds.has(riskId) ||
        !risk.description?.trim() ||
        !risk.probability?.trim() ||
        !risk.impact?.trim() ||
        !Array.isArray(risk.affected_surfaces) ||
        !risk.trigger?.trim() ||
        !treatments.has(risk.treatment) ||
        !blockingModes.has(risk.blocking_mode) ||
        !risk.revisit_condition?.trim() ||
        !risk.owner?.trim()
      ) {
        throw this.ports.errorFactory(
          "contract_proposal.risk_invalid",
          "每个 Risk 必须有唯一 ID、影响、触发条件、处理方式、复查条件和负责人",
        );
      }
      proposedRiskIds.add(riskId);
      const existingRisk = this.ports.goals.query.getRisk(boardId, riskId);
      if (existingRisk) {
        throw this.ports.errorFactory(
          "contract_proposal.risk_exists",
          `Risk 已存在，Contract Proposal 不能静默覆盖: ${riskId}`,
        );
      }
    }

    if (new Set(dependencyRewireIds).size !== dependencyRewireIds.length) {
      throw this.ports.errorFactory(
        "contract_proposal.dependency_duplicate",
        "Dependency Rewire 引用不能重复",
      );
    }
    for (const rewireId of dependencyRewireIds) {
      const rewire = this.ports.governance.query.getRewire(boardId, rewireId);
      if (!rewire) {
        throw this.ports.errorFactory(
          "contract_proposal.dependency_not_found",
          `找不到 Dependency Rewire: ${rewireId}`,
        );
      }
      const proposal = rewire.proposal;
      if (
        proposal.proposal_kind !== "dependency" ||
        !(proposal.relations ?? []).some(
          (relation) => String(relation.from_goal_id ?? "") === goalId,
        )
      ) {
        throw this.ports.errorFactory(
          "contract_proposal.dependency_unrelated",
          `Dependency Rewire 不属于这个 Draft: ${rewireId}`,
        );
      }
      if (
        requireResolvedDependencies &&
        !["applied", "rejected"].includes(rewire.state)
      ) {
        throw this.ports.errorFactory(
          "contract_proposal.dependency_pending",
          `请先确认或拒绝依赖调整，再接受 Contract: ${rewireId}`,
        );
      }
    }
  }
}
