import type { ContractDescriptor } from "../platform/package.js";
import type { StoredModuleEvent } from "../platform/storage.js";

export const modulesGoalsContract = {
  contractId: "io.goalboard.module.goals.v1",
  kind: "module",
  schemaVersion: 1,
  maturity: "partial",
  ssot: "docs/modules/goals.md",
} as const satisfies ContractDescriptor;

export type GoalDefinitionState = "draft" | "accepted";
export type ImpactAccess = "read" | "write" | "decide" | "exclusive";

/** A Goal's resource declaration, not a cross-module ObjectRef relationship. */
export interface ImpactBindingRecord {
  binding_id: string;
  board_id: string;
  goal_id: string;
  surface: string;
  access: ImpactAccess;
  input_snapshot: string | null;
  state: "proposed" | "confirmed" | "inactive";
  reason: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
  deactivation_reason: string | null;
}

export interface ImpactFactsInput {
  binding_id?: string;
  goal_id: string;
  surface: string;
  access: ImpactAccess;
  input_snapshot?: string | null;
  state?: "proposed" | "confirmed";
  reason: string;
}

export interface ImpactWriteResult {
  impact: ImpactBindingRecord;
  replayed: boolean;
  observed_event_cursor: number;
}

export interface GoalsImpactApi {
  list(boardId: string): ImpactBindingRecord[];
  get(boardId: string, bindingId: string): ImpactBindingRecord | null;
  add(boardId: string, input: ImpactFactsInput, write: GoalsActorWrite): ImpactWriteResult & { binding_id: string };
  update(boardId: string, input: ImpactFactsInput & { binding_id: string }, write: GoalsActorWrite): ImpactWriteResult;
  deactivate(boardId: string, input: { binding_id: string; reason: string }, write: GoalsActorWrite): ImpactWriteResult;
  /** Accepted Proposal application only: caller owns authorization, transaction and aggregate audit event. */
  registerAccepted(boardId: string, input: Omit<ImpactFactsInput, "state"> & { binding_id: string }, actorId: string, at: string): void;
}
export type GoalDecompositionState =
  | "abstract"
  | "frontier_open"
  | "closed_leaf"
  | "closed_compound";
export type GoalValidityState = "valid" | "needs_revalidation" | "invalidated";
export type GoalFulfillmentState = "unmet" | "satisfied";
export type GoalContractRevisionEffect = "metadata" | "revalidate" | "rework";
export type GoalTaskContext = "game" | "app" | "ai_data" | "content_research" | "operations" | "other";
export type GoalLegacyProductContext = "game" | "app" | "other";
export const goalRelationTypes = ["part_of", "depends_on", "conflicts_with", "mitigates", "extends", "replaces", "corrects", "invalidates", "migrates_from"] as const;
export type GoalRelationType = typeof goalRelationTypes[number];

export interface GoalDecompositionReview {
  status: "complete" | "paused";
  method_pack_ids?: string[];
  task_context?: GoalTaskContext;
  product_context?: GoalLegacyProductContext;
  coverage: Array<{
    area: string;
    disposition: "goal" | "owned" | "not_applicable";
    goal_ids: string[];
    reason: string;
  }>;
  open_goal_ids: string[];
  next_step: string;
  contract_coverage?: {
    promised_outputs: Array<{
      parent_promised_output: string;
      status: "complete" | "partial" | "integration_required" | "uncovered";
      child_outputs: Array<{ goal_id: string; promised_output: string; contract_revision?: number }>;
      reason: string;
    }>;
    acceptance_criteria: Array<{
      parent_criterion_id: string;
      status: "complete" | "partial" | "integration_required" | "uncovered";
      child_criteria: Array<{ goal_id: string; criterion_id: string; contract_revision?: number }>;
      reason: string;
    }>;
  };
}

export interface GoalAcceptanceCriterion {
  criterion_id: string;
  goal_id: string;
  statement: string;
  decision_method: "automated_check" | "measurement" | "inspection" | "human_decision";
  pass_condition: string;
  target: Record<string, unknown> | null;
  required_evidence: string[];
}

export interface GoalLeafReadiness {
  verdict: "ready" | "split_required";
  primary_deliverable: string;
  output_coverage: Array<{
    promised_output: string;
    role: "primary" | "supporting" | "independent";
    reason: string;
  }>;
  split_candidates: Array<{
    work_item: string;
    separately_deliverable: boolean;
    separately_acceptable: boolean;
    independently_reworkable: boolean;
    decision: "keep" | "split";
    reason: string;
  }>;
  rationale: string;
  unresolved_decisions: string[];
  independent_deliverables: string[];
  acceptance_criterion_ids: string[];
}

export interface GoalRecord {
  goal_id: string;
  board_id: string;
  title: string;
  outcome: string;
  why: string;
  business_logic: string;
  in_scope: string[];
  out_of_scope: string[];
  constraints: string[];
  required_inputs: string[];
  promised_outputs: string[];
  decomposition_review: GoalDecompositionReview | null;
  definition_state: GoalDefinitionState;
  decomposition_state: GoalDecompositionState;
  validity_state: GoalValidityState;
  fulfillment_state: GoalFulfillmentState;
  current_contract_revision: number;
  trashed_at: string | null;
  trashed_by: string | null;
  archived_at: string | null;
  archived_by: string | null;
  priority: number;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  acceptance_criteria: GoalAcceptanceCriterion[];
}

export interface CreateGoalInput {
  goal_id?: string;
  title: string;
  outcome: string;
  why: string;
  business_logic: string;
  in_scope?: string[];
  out_of_scope?: string[];
  constraints?: string[];
  required_inputs?: string[];
  promised_outputs?: string[];
  leaf_readiness?: GoalLeafReadiness;
  decomposition_review?: GoalDecompositionReview;
  definition_state?: GoalDefinitionState;
  decomposition_state?: GoalDecompositionState;
  priority?: number;
  acceptance_criteria: Array<{
    criterion_id?: string;
    statement: string;
    decision_method: GoalAcceptanceCriterion["decision_method"];
    pass_condition: string;
    target?: Record<string, unknown> | null;
    required_evidence?: string[];
  }>;
}

export interface GoalRelationRecord {
  relation_id: string;
  board_id: string;
  from_goal_id: string;
  to_goal_id: string;
  type: GoalRelationType;
  state: "proposed" | "active" | "inactive";
  reason: string;
  created_by: string;
  created_at: string;
  deactivated_at: string | null;
}

export type PlanningMethodScope = "built_in" | "personal" | "project";
export type PlanningMethodKind =
  | "meta"
  | "work_type"
  | "domain"
  | "industry"
  | "overlay"
  | "custom";

export interface PlanningCoverageRule {
  area: string;
  label: string;
  question: string;
}

export interface PlanningDependencyRule {
  rule_id: string;
  statement: string;
  direction_hint: string;
}

export interface PlanningMethodPack {
  method_id: string;
  version: number;
  scope: PlanningMethodScope;
  kind: PlanningMethodKind;
  name: string;
  summary: string;
  /** Complete Runtime-facing guidance; structured fields support UI and checks. */
  instructions: string;
  applies_to: string[];
  domain_tags: string[];
  steps: string[];
  required_coverage: PlanningCoverageRule[];
  dependency_rules: PlanningDependencyRule[];
  evidence_requirements: string[];
  completion_checks: string[];
  failure_modes: string[];
  source_refs: string[];
  confidence: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type PlanningMethodPackInput = Omit<
  PlanningMethodPack,
  "scope" | "version" | "created_at" | "updated_at" | "instructions"
> & { version?: number; instructions?: string };

export interface ResolvedPlanningMethodPack extends PlanningMethodPack {
  overridden_scopes: PlanningMethodScope[];
}

export interface PlanningMethodPath {
  method_id: string;
  method_name: string;
  kind: PlanningMethodKind;
  steps: string[];
  instructions: string;
}

export interface PlanningMethodComposition {
  method_pack_ids: string[];
  method_names: string[];
  method_paths: PlanningMethodPath[];
  required_coverage: PlanningCoverageRule[];
  dependency_rules: PlanningDependencyRule[];
  evidence_requirements: string[];
  completion_checks: string[];
  failure_modes: string[];
}

/** Structural input only; Proposal and Decision persistence remain Governance-owned. */
export interface PlanningProposalItem {
  item_id?: string;
  kind: string;
  operation: string;
  payload: Record<string, unknown>;
}

export interface PlanningRelationChange {
  action: "add" | "deactivate";
  relation_id?: string | null;
  from_goal_id: string;
  to_goal_id: string;
  type: GoalRelationType;
  reason?: string;
}

export interface PlanningGraphIssue {
  code:
    | "planning.goal_missing"
    | "planning.goal_trashed"
    | "planning.relation_self_reference"
    | "planning.relation_duplicate"
    | "planning.part_of_cycle"
    | "planning.dependency_cycle"
    | "planning.execution_cycle";
  message: string;
  goal_ids: string[];
  relation_ids: string[];
  path: string[];
}

export interface PlanningMetric {
  goal_id: string;
  topological_level: number;
  unlock_count: number;
  longest_downstream_chain: number;
}

export interface GoalChangeImpact {
  changed_goal_ids: string[];
  affected_ancestors: string[];
  affected_dependents: string[];
  adjacent_dependencies: string[];
  reusable_open_goal_ids: string[];
  review_order: string[];
  graph_issues: PlanningGraphIssue[];
}

export interface SaveProjectPlanningMethodInput {
  board_id: string;
  method: PlanningMethodPackInput;
  actor_id: string;
  user_confirmed: boolean;
}

export type GoalContractStructureConflict = {
  code: string;
  message: string;
  objects: Array<{ object_type: string; object_id: string }>;
  next_action: string;
  recovery: string;
  current_goal?: Pick<GoalRecord, "goal_id" | "title" | "definition_state" | "decomposition_state" | "fulfillment_state">;
  required_item?: { kind: string; operation: string; goal_id: string };
};

export interface GoalContractPlanningApi {
  proposalGoalConflict(boardId: string, item: { kind: string; operation: string; payload: Record<string, unknown> },
    goal: CreateGoalInput, targetGoalId: string): Record<string, unknown> | null;
  candidateGoalMatches(goalId: string, proposed: CreateGoalInput): boolean;
  businessContractMatches(existing: GoalRecord, goal: CreateGoalInput): boolean;
  isCompoundClosure(existing: GoalRecord, goal: CreateGoalInput): boolean;
  compoundClosureConflict(boardId: string, operation: string, existing: GoalRecord, goal: CreateGoalInput, goalId: string): GoalContractStructureConflict | null;
  revisionStructureConflict(boardId: string, existing: GoalRecord, goal: CreateGoalInput): GoalContractStructureConflict | null;
}

export interface GoalsPlanningApi {
  validateRelationAddition(boardId: string, input: AddGoalRelationInput): Pick<PlanningGraphIssue, "code" | "message"> | null;
  compoundCoverageBlocksClosure(boardId: string, goalId: string): boolean;
  metrics(
    goals: readonly Pick<GoalRecord, "goal_id" | "decomposition_state" | "fulfillment_state" | "trashed_at">[],
    relations: readonly Pick<GoalRelationRecord, "relation_id" | "from_goal_id" | "to_goal_id" | "type" | "state">[],
  ): Map<string, PlanningMetric>;
  proposals: GoalsProposalCoordinationApi;
  proposalGraphIssues(boardId: string, items: readonly PlanningProposalItem[]): PlanningGraphIssue[];
  wouldCreatePartOfCycle(boardId: string, fromGoalId: string, toGoalId: string): boolean;
  contracts: GoalContractPlanningApi;
  effectiveMethods(boardId: string): PlanningMethodPack[];
  projectComposition(boardId: string): PlanningMethodComposition;
  saveProjectMethod(input: SaveProjectPlanningMethodInput): {
    method: PlanningMethodPack;
    observed_event_cursor: number;
  };
  analyzeChange(boardId: string, changedGoalIds: readonly string[]): GoalChangeImpact;
  validateBoardGraph(boardId: string): {
    issues: PlanningGraphIssue[];
    observed_event_cursor: number;
  };
}

export interface GoalDependencyReference {
  from_goal_id: string;
  to_goal_id: string;
  action?: unknown;
}

/** Validate existing proposal payloads against Goals-owned identities, graph and Risk facts. */
export interface GoalsProposalCoordinationApi {
  validateStandaloneDependencies(boardId: string, dependencies: GoalDependencyReference[]): void;
  validateCandidateCoordination(boardId: string, proposedGoal: CreateGoalInput,
    relations: Array<Record<string, unknown>>, impacts: Array<Record<string, unknown>>,
    risks: Array<Record<string, unknown>>, allowExistingGoalId?: string): void;
}

export interface GoalLifecycleReason {
  code: string;
  severity: "info" | "warning" | "blocker";
  subject_type: string;
  subject_id: string;
  message: string;
  facts?: Record<string, unknown>;
  remediation?: string;
}

export type GoalTrashStatus =
  | "trashed"
  | "restored"
  | "already_trashed"
  | "already_active"
  | "blocked";

export interface GoalTrashResult {
  status: GoalTrashStatus;
  goal: GoalRecord;
  active_goal_cleared: boolean;
  deactivated_relation_ids: string[];
  restored_relation_ids: string[];
  pending_relation_ids: string[];
  blocking_claim_ids: string[];
  blocking_run_ids: string[];
}

export interface GoalArchiveResult {
  goal: GoalRecord;
  active_goal_cleared: boolean;
  observed_event_cursor: number;
  replayed: boolean;
}

export interface GoalRevalidationInput {
  board_id: string;
  goal_id: string;
  run_id: string;
  actor_id: string;
  reason: string;
  evidence_refs: string[];
  contract_revision?: number;
  action_token?: string;
  idempotency_key: string;
}

export interface GoalRevalidationDecision<TTransition = unknown> {
  revalidated: boolean;
  goal: GoalRecord;
  observed_event_cursor: number;
  reasons: GoalLifecycleReason[];
  replayed: boolean;
  transition?: TTransition;
}

export interface GoalCompletionResult {
  satisfied: boolean;
  reasons: GoalLifecycleReason[];
  observed_event_cursor: number;
  replayed: boolean;
}

export interface AddGoalRelationInput {
  from_goal_id: string;
  to_goal_id: string;
  type: GoalRelationType;
  state?: "proposed" | "active";
  reason: string;
}

export interface GoalPolicy {
  goal_mode: "disabled" | "preferred" | "required";
  required_capabilities: string[];
  self_verification: boolean;
  cross_reviewers: number;
  adversarial_reviewers: number;
  human_approval: boolean;
  max_lease_seconds: number;
}

export interface GoalsBoardRecord {
  board_id: string;
  title: string;
  active_goal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalRiskLinkRecord {
  goal_id: string;
  risk_id: string;
}

export interface GoalPolicyBindingRecord {
  scope: "project_default" | "ancestor_minimum" | "goal_override";
  goal_id: string | null;
  policy: Partial<GoalPolicy>;
}

/** Historical bindings for user-facing rule records, not just the active policy. */
export interface GoalPolicyHistoryRecord extends Omit<GoalPolicyBindingRecord, "scope"> {
  scope: "project_default" | "ancestor_minimum" | "goal";
  policy_binding_id: string;
  state: "active" | "replaced" | "withdrawn";
  created_by: string;
  reason: string;
  created_at: string;
}

export type GoalDependencyFact = Pick<GoalRecord, "goal_id" | "title" | "fulfillment_state" | "validity_state">;
export interface GoalReplacementFact {
  relation_id: string;
  replacement_goal_id: string;
  replacement_goal_title: string;
}

export type RiskBlockingMode = "none" | "claim" | "completion" | "invalidate_on_trigger";

export interface RiskRecord {
  risk_id: string;
  board_id: string;
  description: string;
  probability: string;
  impact: string;
  affected_surfaces: string[];
  trigger: string;
  treatment: "accept" | "mitigate" | "avoid" | "defer";
  treatment_plan: string;
  blocking_mode: RiskBlockingMode;
  revisit_condition: string;
  owner: string;
  state: "open" | "triggered" | "resolved" | "accepted" | "expired";
  resolution_basis: {
    summary: string;
    evidence_refs: string[];
    residual_gaps: string[];
  } | null;
  created_at: string;
  updated_at: string;
}

export interface RiskFactsInput {
  risk_id?: string;
  goal_ids: string[];
  description: string;
  probability: string;
  impact: string;
  affected_surfaces?: string[];
  trigger: string;
  treatment: RiskRecord["treatment"];
  treatment_plan?: string;
  blocking_mode: RiskRecord["blocking_mode"];
  revisit_condition: string;
  owner: string;
}

export type AcceptedRiskFacts = Omit<RiskRecord, "state" | "resolution_basis" | "created_at" | "updated_at"> & {
  goal_ids: string[];
};

export interface UpdateRiskInput extends Omit<RiskFactsInput, "risk_id"> {
  risk_id: string;
  action_goal_id?: string;
  contract_revision?: number;
  action_id?: string;
  action_token?: string;
}

export interface SetRiskStateInput {
  risk_id: string;
  state: RiskRecord["state"];
  reason: string;
  resolution_basis?: NonNullable<RiskRecord["resolution_basis"]>;
  goal_id?: string;
  contract_revision?: number;
  action_id?: string;
  action_token?: string;
}

export type ProjectGuidanceKind =
  | "context"
  | "requirement"
  | "constraint"
  | "convention"
  | "workflow"
  | "quality_bar";

export interface ProjectGuidanceEntryRecord {
  guidance_id: string;
  board_id: string;
  position: number;
  revision: number;
  active: boolean;
  kind: ProjectGuidanceKind;
  content: string;
  content_hash: string;
  source_refs: string[];
  created_by: string;
  confirmation_summary: string;
  reason: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface ProjectGuidanceRevisionRecord {
  revision_id: string;
  guidance_id: string;
  board_id: string;
  revision: number;
  kind: ProjectGuidanceKind;
  content: string;
  content_hash: string;
  source_refs: string[];
  active: boolean;
  changed_by: string;
  change_kind: "created" | "edited" | "deactivated" | "restored";
  confirmation_summary: string;
  reason: string;
  created_at: string;
}

export interface ProjectGuidanceView {
  entries: ProjectGuidanceEntryRecord[];
  inactive_entries: ProjectGuidanceEntryRecord[];
  revisions: ProjectGuidanceRevisionRecord[];
  virtual_document: string;
  runtime_prompt_prefix: string;
}

export interface GoalsQuerySnapshot {
  board: GoalsBoardRecord;
  observed_event_cursor: number;
  goals: GoalRecord[];
  relations: GoalRelationRecord[];
  risks: RiskRecord[];
  goal_risks: GoalRiskLinkRecord[];
  policy_bindings: GoalPolicyBindingRecord[];
  planning_method_packs: PlanningMethodPack[];
  project_guidance: ProjectGuidanceEntryRecord[];
}

export interface GoalFactsView {
  board: GoalsBoardRecord;
  observed_event_cursor: number;
  goal_path: string;
  goal: GoalRecord;
  parent_contract_coverage: Array<{
    parent_goal_id: string;
    parent_goal_title: string;
    record_status: "recorded" | "unrecorded";
    promised_outputs: NonNullable<GoalDecompositionReview["contract_coverage"]>["promised_outputs"];
    acceptance_criteria: NonNullable<GoalDecompositionReview["contract_coverage"]>["acceptance_criteria"];
  }>;
  relations: GoalRelationRecord[];
  risks: RiskRecord[];
  resolved_policy: GoalPolicy;
  project_guidance: ProjectGuidanceEntryRecord[];
}

/** Retained V3 requirement coverage, distinct from Contract revision coverage. */
export interface GoalLegacyCoverageRecord {
  requirement_id: string;
  board_id: string;
  statement: string;
  disposition: "covered" | "deferred" | "out" | "unresolved";
  owner_goal_id: string | null;
  reason: string | null;
  revisit_condition: string | null;
  blocking: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalsQueryApi {
  listActivePolicyBindings(boardId: string, goalId?: string): GoalPolicyBindingRecord[];
  listLegacyCoverage(boardId: string): Array<Omit<GoalLegacyCoverageRecord, "board_id">>;
  listPolicyHistory(boardId: string): GoalPolicyHistoryRecord[];
  listGoalRiskLinks(boardId: string): GoalRiskLinkRecord[];
  listDependencies(boardId: string, goalId: string): GoalDependencyFact[];
  listOpenGoalRisks(boardId: string, goalId: string): RiskRecord[];
  activeReplacement(boardId: string, goalId: string): GoalReplacementFact | null;
  /** Global ID collision check only; does not expose another Board's Goal contents. */
  hasGoalIdentity(goalId: string): boolean;
  listLifecycleEvents(boardId: string): StoredModuleEvent[];
  listContractRevisions(boardId: string): GoalContractRevisionRecord[];
  listCoverageRevisions(boardId: string): CoverageContractRevisionRecord[];
  getRelation(boardId: string, relationId: string): GoalRelationRecord | null;
  getRisk(boardId: string, riskId: string): RiskRecord | null;
  policyBindingState(boardId: string, bindingId: string): "active" | "replaced" | "withdrawn" | null;
  /** Global criterion identity is needed to reject cross-Goal ID collisions. */
  criterionGoalId(criterionId: string): string | null;
  /** Existing Proposal compatibility versions; persistence representation stays inside Goals. */
  policyBindingVersion(boardId: string, bindingId: string, mode: "legacy" | "semantic-v1"): { exists: boolean; version: string };
  getBoard(boardId: string): GoalsBoardRecord | null;
  getGoal(boardId: string, goalId: string): GoalRecord | null;
  listGoals(
    boardId: string,
    options?: { include_archived?: boolean; include_trashed?: boolean },
  ): GoalRecord[];
  listRelations(boardId: string, goalId?: string): GoalRelationRecord[];
  listTrashedGoals(boardId: string): GoalRecord[];
  snapshot(boardId: string): GoalsQuerySnapshot;
  resolvePolicy(boardId: string, goalId: string, strengthen?: Partial<GoalPolicy>): GoalPolicy;
  readGoal(boardId: string, goalId: string): GoalFactsView;
  readProjectGuidance(boardId: string): ProjectGuidanceView;
}

export interface AddProjectGuidanceInput {
  board_id: string;
  actor_id: string;
  kind: ProjectGuidanceKind;
  content: string;
  source_refs?: string[];
  reason: string;
  confirmation_summary: string;
  user_confirmed: boolean;
  idempotency_key: string;
}

export interface AddProjectGuidanceResult {
  entry: ProjectGuidanceEntryRecord;
  created: boolean;
  observed_event_cursor: number;
  replayed: boolean;
}

export interface UpdateProjectGuidanceInput {
  board_id: string;
  guidance_id: string;
  actor_id: string;
  action: "edit" | "deactivate" | "restore";
  kind?: ProjectGuidanceKind;
  content?: string;
  source_refs?: string[];
  reason: string;
  confirmation_summary: string;
  user_confirmed: boolean;
  idempotency_key: string;
}

export interface UpdateProjectGuidanceResult {
  entry: ProjectGuidanceEntryRecord;
  revision: ProjectGuidanceRevisionRecord;
  observed_event_cursor: number;
  replayed: boolean;
}

export interface GoalsActorWrite {
  actor_id: string;
  actor_kind?: "user" | "runtime";
  idempotency_key: string;
  reason?: string;
}

/** Finite Policy write inside an already-authorized Proposal decision transaction. */
export type ConfirmedPolicyChange = {
  board_id: string;
  actor_id: string;
  reason: string;
  at: string;
  source_item_id: string;
} & ({ operation: "deactivate"; policy_binding_id: string } | {
  operation: "replace";
  policy_binding_id?: string;
  goal_id: string | null;
  policy: { [K in keyof GoalPolicy]?: unknown };
});

export type ConfirmedRiskChange = {
  board_id: string; risk_id: string; actor_id: string; reason: string; at: string; source_item_id: string;
} & ({ operation: "deactivate" } | {
  operation: "create" | "update";
  facts: Omit<RiskFactsInput, "risk_id">;
  requested_state: string;
  resolution_basis: { summary: string; evidence_refs: string[]; residual_gaps?: string[] } | null;
});

export interface ConfirmedRelationBatch {
  board_id: string; actor_id: string; reason: string; at: string; source_item_id: string;
  relations: Array<{
    action: "add" | "deactivate";
    relation_id?: string | null;
    from_goal_id: string;
    to_goal_id: string;
    type: GoalRelationType | null;
    reason: string;
  }>;
}

export interface GoalsCommandApi<TTransition = unknown> {
  /** Internal import port; caller retains the complete V3 import transaction and audit event. */
  importLegacyCoverage(boardId: string, rows: ReadonlyArray<Omit<GoalLegacyCoverageRecord, "board_id">>): void;
  validateGoalInput(input: CreateGoalInput): void;
  applyAcceptedRewireRelations(input: {
    board_id: string; rewire_id: string; formal_goal_id: string; actor_id: string; at: string;
    relations: Array<{ from_goal_id: string; to_goal_id: string; type: string; action: string; reason: string }>;
  }): { added_relation_ids: string[]; deactivated_relation_ids: string[]; revalidated_goal_ids: string[] };
  registerAcceptedRisk(facts: AcceptedRiskFacts, at: string): void;
  registerAcceptedRewireRisk(facts: AcceptedRiskFacts, actorId: string, at: string): void;
  /** Accepted legacy aggregate facts; the application preserves its existing aggregate audit. */
  registerAcceptedPolicy(input: {
    board_id: string; goal_id: string; policy_binding_id: string; policy: Partial<GoalPolicy>;
    actor_id: string; reason: string; at: string;
  }): void;
  updateConfirmedDraft(input: {
    board_id: string; goal_id: string; goal: CreateGoalInput; actor_id: string; at: string;
  }): GoalRecord;
  /** Record the original final event after Governance supersession/closure in the same decision. */
  recordConfirmedDraftUpdate(input: {
    board_id: string; goal_id: string; actor_id: string; reason: string; source_item_id: string; at: string;
  }): number;
  applyConfirmedRelations(input: ConfirmedRelationBatch): Array<{ relation_id: string }>;
  applyConfirmedRisk(input: ConfirmedRiskChange): { risk_id: string };
  createConfirmedGoal(input: {
    board_id: string; goal_id: string; goal: CreateGoalInput;
    source_proposal_id: string; source_item_id: string;
    actor_id: string; reason: string; at: string;
  }): GoalRecord;
  applyConfirmedPolicy(input: ConfirmedPolicyChange): { policy_binding_id: string };
  initializeBoard(input: { board_id: string; title: string; actor_id: string; idempotency_key: string }): { board_id: string; replayed: boolean; observed_event_cursor: number };
  setActiveGoal(boardId: string, input: { goal_id: string; reason: string }, write: GoalsActorWrite): { active_goal_id: string; replayed: boolean; observed_event_cursor: number };
  createGoal(boardId: string, input: CreateGoalInput, write: GoalsActorWrite): {
    goal: GoalRecord;
    observed_event_cursor: number;
    replayed: boolean;
  };
  updateDraftGoal(boardId: string, goalId: string, input: CreateGoalInput, write: GoalsActorWrite): {
    goal: GoalRecord;
    observed_event_cursor: number;
    replayed: boolean;
  };
  addRelation(boardId: string, input: AddGoalRelationInput, write: GoalsActorWrite): {
    relation_id: string;
    observed_event_cursor: number;
    replayed: boolean;
  };
  deactivateRelation(boardId: string, input: { relation_id: string; reason: string }, write: GoalsActorWrite): {
    relation: GoalRelationRecord;
    observed_event_cursor: number;
    replayed: boolean;
  };
  setPolicy(boardId: string, input: { goal_id?: string | null; policy: Partial<GoalPolicy>; reason: string }, write: GoalsActorWrite): {
    policy_binding_id: string;
    observed_event_cursor: number;
    replayed: boolean;
  };
  addRisk(boardId: string, input: RiskFactsInput, write: GoalsActorWrite): {
    risk: RiskRecord;
    transitions: TTransition[];
    observed_event_cursor: number;
    replayed: boolean;
  };
  updateRisk(boardId: string, input: UpdateRiskInput, write: GoalsActorWrite): {
    risk: RiskRecord;
    transitions: TTransition[];
    observed_event_cursor: number;
    replayed: boolean;
  };
  setRiskState(boardId: string, input: SetRiskStateInput, write: GoalsActorWrite): {
    risk: RiskRecord;
    transitions: TTransition[];
    observed_event_cursor: number;
    replayed: boolean;
  };
  addProjectGuidance(input: AddProjectGuidanceInput): AddProjectGuidanceResult;
  updateProjectGuidance(input: UpdateProjectGuidanceInput): UpdateProjectGuidanceResult;
}

export interface AcceptDraftGoalInput {
  board_id: string; goal_id: string; proposed_goal: CreateGoalInput; actor_id: string; accepted_at: string;
}

export interface ApplyAcceptedContractRevisionInput {
  board_id: string; goal_id: string; proposed_goal: CreateGoalInput; source_proposal_id: string;
  source_item_id?: string; actor_id: string; reason: string; applied_at: string;
}

export interface AppliedGoalContractRevision {
  goal: GoalRecord; previous_contract_revision: number; contract_revision: number;
  effect: GoalContractRevisionEffect; downstream_goal_ids: string[];
}

export interface GoalsLifecycleApi<TTransition = unknown> {
  markSatisfiedGoalForEvidenceRevalidation(boardId: string, goalId: string, actorId: string, evidenceId: string, correctionId: string, at: string): number;
  reconcileAllClosedCompoundGoals(boardId: string, actorId: string, at: string): number;
  markCandidateAwaitingRewire(boardId: string, goalId: string, at: string): void;
  reconcileRewireGoalValidity(boardId: string, formalGoalId: string, revalidatedGoalIds: readonly string[], at: string): void;
  reopenForLifecycleFacts(boardId: string, goalId: string, actorId: string, at: string, reason: string): number;
  satisfyForLifecycleFacts(boardId: string, goalId: string, actorId: string, at: string): number;
  acceptDraft(input: AcceptDraftGoalInput): GoalRecord;
  applyAcceptedContractRevision(input: ApplyAcceptedContractRevisionInput): AppliedGoalContractRevision;
  closeAcceptedCompound(input: {
    board_id: string; goal_id: string; decomposition_review?: GoalDecompositionReview;
    actor_id: string; reason: string; source_item_id: string; at: string;
  }): GoalRecord;
  setArchived(
    boardId: string,
    input: { goal_id: string; archived: boolean; reason: string },
    write: GoalsActorWrite,
  ): GoalArchiveResult;
  setTrashed(
    boardId: string,
    input: { goal_id: string; trashed: boolean; reason: string },
    write: GoalsActorWrite,
  ): GoalTrashResult & { observed_event_cursor: number; replayed: boolean };
  listTrashed(boardId: string): GoalRecord[];
  revalidate(input: GoalRevalidationInput): GoalRevalidationDecision<TTransition>;
  evaluateCompletion(input: {
    board_id: string;
    goal_id: string;
    actor_id: string;
    idempotency_key: string;
  }): GoalCompletionResult;
}

/** Existing cross-owner consequence of a confirmed Goal Contract revision. */
export interface GoalRevisionDependentTransition {
  board_id: string;
  goal_id: string;
  previous_contract_revision: number;
  contract_revision: number;
  effect: GoalContractRevisionEffect;
  actor_id: string;
  at: string;
}

/** Public application-facing Goals capabilities; Apps bind this port without owning rules or Stores. */
export interface GoalsApplicationApi<TTransition = unknown> {
  impacts: GoalsImpactApi;
  commands: GoalsCommandApi<TTransition>;
  lifecycle: GoalsLifecycleApi<TTransition>;
  planning: GoalsPlanningApi;
}
export type { GoalInputBindingRecord, GoalInputBindingsApi } from "./goal-inputs.js";
export interface GoalContractRevisionRecord {
  goal_id: string;
  board_id: string;
  revision: number;
  contract: CreateGoalInput;
  effect: GoalContractRevisionEffect;
  source_proposal_id: string | null;
  changed_by: string;
  reason: string;
  created_at: string;
}

export interface CoverageContractRevisionRecord {
  parent_goal_id: string;
  child_goal_id: string;
  parent_contract_revision: number;
  child_contract_revision: number;
  recorded_at: string;
}
