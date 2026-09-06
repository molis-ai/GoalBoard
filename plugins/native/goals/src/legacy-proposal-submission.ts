import { createHash, randomUUID } from "node:crypto";
import type { GoalsApplicationApi, GoalsQueryApi, GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceApplicationApi, ContractProposalRecord, CandidateGoalRecord, RewireRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { ExecutionQueryApi } from "@adeptify/goalboard-contracts/modules/execution";
import type { LegacyProposalApplicationApi, SubmitContractProposalInput } from "./legacy-proposal-contract.js";
import type { GoalTreeInputReader } from "./goal-tree-inputs.js";
import type { LegacyContractProposalValidator } from "./legacy-contract-validation.js";

/** Historical submission formats remain pending records, with their original Run and source checks. */
export class LegacyProposalSubmissionApplication implements Pick<LegacyProposalApplicationApi, "submitContractProposal" | "submitCandidate" | "submitDependencyProposal"> {
  constructor(private readonly ports: {
    goals: Pick<GoalsApplicationApi, "commands" | "planning"> & { query: Pick<GoalsQueryApi, "getGoal" | "getBoard"> };
    governance: Pick<GovernanceApplicationApi, "records" | "query">;
    execution: Pick<ExecutionQueryApi, "getRun" | "listNonterminalRuns">;
    inputs: GoalTreeInputReader; validator: LegacyContractProposalValidator; clock: () => Date;
    errorFactory: (code: string, message: string) => Error;
  }) {}
  submitContractProposal(input: SubmitContractProposalInput): {
    proposal: ContractProposalRecord;
    replayed: boolean;
    observed_event_cursor: number;
  } {
    this.ports.validator.validateShape(input);
    const normalizedDependencyIds = unique(input.dependency_rewire_ids ?? []).sort();
    const normalizedInput = {
      ...input,
      proposed_impacts: input.proposed_impacts ?? [],
      proposed_risks: input.proposed_risks ?? [],
      dependency_rewire_ids: normalizedDependencyIds,
    };
    const hash = requestHash(normalizedInput);
    return this.ports.governance.records.executeContractProposalSubmission({
      board_id: input.board_id, actor_id: input.actor_id, idempotency_key: input.idempotency_key, request_hash: hash,
    }, () => {
      const goal = this.requireGoalOnBoard(input.board_id, input.goal_id);
      if (goal.definition_state !== "draft") {
        throw this.ports.errorFactory(
          "contract_proposal.goal_not_draft",
          "Contract Proposal 只能补全尚未接受的 Draft Goal",
        );
      }
      const run = this.ports.execution.getRun(input.board_id, input.discovered_in_run_id);
      if (!run) {
        throw this.ports.errorFactory(
          "contract_proposal.run_not_found",
          "Contract Proposal 引用的 clarifier Run 不存在",
        );
      }
      if (
        run.actor_id !== input.actor_id ||
        run.goal_id !== input.goal_id ||
        run.role !== "clarifier"
      ) {
        throw this.ports.errorFactory(
          "contract_proposal.run_invalid",
          "只有认领这个 Draft 的 clarifier 可以提交它的 Contract Proposal",
        );
      }
      if (["failed", "abandoned"].includes(run.state)) {
        throw this.ports.errorFactory(
          "contract_proposal.run_closed",
          "失败或放弃的 clarifier Run 不能提交 Contract Proposal",
        );
      }
      this.ports.validator.validate(
        input.board_id,
        input.goal_id,
        input.proposed_goal,
        input.field_sources,
        input.review_policy,
        input.proposed_impacts ?? [],
        input.proposed_risks ?? [],
        normalizedDependencyIds,
        false,
      );

      const now = this.ports.clock().toISOString();
      this.ports.governance.records.supersedePendingContractProposals(
        input.board_id,
        input.goal_id,
        now,
        { reason: "clarifier 提交了新的完整 Proposal", superseded_by: input.actor_id },
      );
      const proposalId = `contract-proposal-${randomUUID()}`;
      this.ports.governance.records.insertContractProposal({
        proposal_id: proposalId,
        board_id: input.board_id,
        goal_id: input.goal_id,
        submitted_by: input.actor_id,
        discovered_in_run_id: input.discovered_in_run_id,
        proposed_goal: input.proposed_goal,
        field_sources: input.field_sources,
        review_policy: input.review_policy,
        proposed_impacts: input.proposed_impacts ?? [],
        proposed_risks: input.proposed_risks ?? [],
        dependency_rewire_ids: normalizedDependencyIds,
        state: "pending",
        decision: null,
        created_at: now,
        decided_at: null,
      });
      const cursor = this.ports.governance.records.recordContractProposalSubmission({
        board_id: input.board_id, actor_id: input.actor_id, at: now,
        proposal_id: proposalId, goal_id: input.goal_id, field_count: input.field_sources.length,
        dependency_rewire_ids: normalizedDependencyIds,
      });
      const proposal = this.readContractProposal(input.board_id, proposalId);
      const outcome = { proposal, observed_event_cursor: cursor };
      return { value: outcome, at: now };
    });
  }

  submitCandidate(input: Parameters<LegacyProposalApplicationApi["submitCandidate"]>[0]): { candidate: CandidateGoalRecord; replayed: boolean; observed_event_cursor: number } {
    this.ports.goals.commands.validateGoalInput(input.proposed_goal);
    const proposedRelations = this.ports.inputs.normalizeProposedRelations(input.proposed_relations ?? [], true);
    if (input.blocking_mode === "current_run" && !input.discovered_in_run_id) {
      throw this.ports.errorFactory(
        "candidate.run_required",
        "blocking_mode=current_run 的 Candidate 必须引用发现它的 Run",
      );
    }
    const hash = requestHash({ ...input, proposed_relations: proposedRelations });
    return this.ports.governance.records.executeCandidateSubmission({
      board_id: input.board_id, actor_id: input.actor_id, idempotency_key: input.idempotency_key, request_hash: hash,
    }, () => {
      this.ports.goals.planning.proposals.validateCandidateCoordination(
        input.board_id,
        input.proposed_goal,
        proposedRelations,
        input.proposed_impacts ?? [],
        input.proposed_risks ?? [],
      );
      this.requireBoard(input.board_id);
      if (input.discovered_in_run_id) {
        const run = this.ports.execution.getRun(input.board_id, input.discovered_in_run_id);
        if (!run) throw this.ports.errorFactory("candidate.run_not_found", "Candidate 引用的 Run 不存在");
        if (run.actor_id !== input.actor_id) {
          throw this.ports.errorFactory("candidate.run_not_owner", "只有 Run 执行者可以报告它发现的新工作");
        }
      }
      const candidateId = `candidate-${randomUUID()}`;
      const now = this.ports.clock().toISOString();
      this.ports.governance.records.insertCandidate({
        candidate_id: candidateId,
        board_id: input.board_id,
        submitted_by: input.actor_id,
        discovered_in_run_id: input.discovered_in_run_id ?? null,
        proposed_goal: input.proposed_goal,
        proposed_relations: proposedRelations,
        proposed_impacts: input.proposed_impacts ?? [],
        proposed_risks: input.proposed_risks ?? [],
        blocking_mode: input.blocking_mode ?? "none",
        state: "pending",
        decision: null,
        created_at: now,
        decided_at: null,
      });
      const cursor = this.ports.governance.records.recordCandidateSubmission({
        board_id: input.board_id, actor_id: input.actor_id, at: now,
        candidate_id: candidateId, blocking_mode: input.blocking_mode ?? "none",
      });
      const candidate = this.readCandidate(input.board_id, candidateId);
      const outcome = { candidate, observed_event_cursor: cursor };
      return { value: outcome, at: now };
    });
  }

  submitDependencyProposal(input: Parameters<LegacyProposalApplicationApi["submitDependencyProposal"]>[0]): { rewire: RewireRecord; replayed: boolean; observed_event_cursor: number } {
    if (input.dependencies.length === 0) {
      throw this.ports.errorFactory(
        "dependency_proposal.empty",
        "Dependency Proposal 至少要包含一条依赖调整",
      );
    }
    const dependencies = this.ports.inputs.normalizeProposedRelations(input.dependencies).map((relation) => {
      if (relation.type !== "depends_on") {
        throw this.ports.errorFactory(
          "dependency_proposal.type_invalid",
          "Dependency Proposal 只接受 depends_on 关系",
        );
      }
      return relation;
    });
    const blockingMode = input.blocking_mode ?? "none";
    const hash = requestHash({ ...input, dependencies, blocking_mode: blockingMode });
    return this.ports.governance.records.executeDependencyProposalSubmission({
      board_id: input.board_id, actor_id: input.actor_id, idempotency_key: input.idempotency_key, request_hash: hash,
    }, () => {
      this.requireBoard(input.board_id);
      const run = this.ports.execution.getRun(input.board_id, input.discovered_in_run_id);
      if (!run) {
        throw this.ports.errorFactory(
          "dependency_proposal.run_not_found",
          "Dependency Proposal 引用的 Run 不存在",
        );
      }
      if (run.actor_id !== input.actor_id) {
        throw this.ports.errorFactory(
          "dependency_proposal.run_not_owner",
          "只有 Run 执行者可以提交它发现的依赖",
        );
      }
      this.ports.goals.planning.proposals.validateStandaloneDependencies(input.board_id, dependencies);
      if (
        blockingMode === "current_run" &&
        !dependencies.some((dependency) => dependency.from_goal_id === run.goal_id)
      ) {
        throw this.ports.errorFactory(
          "dependency_proposal.current_run_unrelated",
          "阻塞当前 Run 的依赖提案必须从这个 Run 的 Goal 出发",
        );
      }
      const rewireId = `rewire-${randomUUID()}`;
      const now = this.ports.clock().toISOString();
      const affectedGoalIds = unique(
        dependencies.flatMap((dependency) => [dependency.from_goal_id, dependency.to_goal_id]),
      ).sort();
      const activeRuns = this.ports.execution.listNonterminalRuns(input.board_id);
      const proposal: RewireRecord["proposal"] = {
        proposal_kind: "dependency",
        submitted_by: input.actor_id,
        discovered_in_run_id: input.discovered_in_run_id,
        blocking_mode: blockingMode,
        relations: dependencies,
      };
      const impact = {
        affected_goal_ids: affectedGoalIds,
        active_runs_protected: activeRuns
          .filter((activeRun) => affectedGoalIds.includes(activeRun.goal_id))
          .map((activeRun) => ({
            run_id: activeRun.run_id,
            goal_id: activeRun.goal_id,
          })),
        proposed_changes_applied: false,
      };
      this.ports.governance.records.insertRewire({
        rewire_id: rewireId,
        board_id: input.board_id,
        candidate_id: null,
        proposal,
        impact,
        state: "pending",
        created_at: now,
        decided_at: null,
      });
      const cursor = this.ports.governance.records.recordDependencyProposalSubmission({
        board_id: input.board_id, actor_id: input.actor_id, at: now,
        rewire_id: rewireId, dependency_count: dependencies.length, blocking_mode: blockingMode,
      });
      const rewire = this.readRewire(input.board_id, rewireId);
      const outcome = { rewire, observed_event_cursor: cursor };
      return { value: outcome, at: now };
    });
  }

  private readContractProposal(boardId: string, proposalId: string): ContractProposalRecord {
    const proposal = this.ports.governance.query.getContractProposal(boardId, proposalId);
    if (!proposal) throw new Error(`Contract Proposal 写入后无法读取: ${proposalId}`);
    return proposal;
  }

  private readCandidate(boardId: string, candidateId: string): CandidateGoalRecord {
    const candidate = this.ports.governance.query.getCandidate(boardId, candidateId);
    if (!candidate) throw new Error(`Candidate 写入后无法读取: ${candidateId}`);
    return candidate;
  }

  private readRewire(boardId: string, rewireId: string): RewireRecord {
    const rewire = this.ports.governance.query.getRewire(boardId, rewireId);
    if (!rewire) throw new Error(`Rewire 写入后无法读取: ${rewireId}`);
    return rewire;
  }

  private requireGoalOnBoard(boardId: string, goalId: string): GoalRecord {
    const goal = this.ports.goals.query.getGoal(boardId, goalId);
    if (!goal) {
      throw this.ports.errorFactory("goal.not_found", `Goal 不存在: ${goalId}`);
    }
    return goal;
  }

  private requireBoard(boardId: string): void {
    if (!this.ports.goals.query.getBoard(boardId)) {
      throw this.ports.errorFactory("board.not_found", `Board 不存在: ${boardId}`);
    }
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
