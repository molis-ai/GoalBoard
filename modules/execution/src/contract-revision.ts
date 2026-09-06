import type { GoalRevisionDependentTransition } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionRepository, ExecutionEventInput } from "./repository.js";

/** Apply the already-confirmed Goal revision to Execution facts in the caller's transaction. */
export function transitionExecutionContractRevision(
  repository: ExecutionRepository,
  appendEvent: (input: ExecutionEventInput) => number,
  id: () => string,
  input: GoalRevisionDependentTransition,
): void {
    const activeClaims = repository
      .listClaimsForGoal(input.board_id, input.goal_id)
      .filter((claim) => claim.state === "active")
      .sort((left, right) => left.claimed_at.localeCompare(right.claimed_at) || left.claim_id.localeCompare(right.claim_id));
    if (input.effect !== "metadata") {
      for (const claim of activeClaims) {
        const activeRunIds = repository.activeRunIdsForClaim(claim.claim_id);
        for (const runId of activeRunIds) {
          const run = repository.getRunById(runId);
          if (!run) continue;
          repository.updateRun(
            runId,
            "abandoned",
            "abandoned_by_contract_revision",
            run.output_refs,
            run.discovery_refs,
            input.at,
          );
          appendEvent({
            eventId: id(),
            boardId: input.board_id,
            actorId: input.actor_id,
            type: "run.abandoned",
            objectType: "run",
            objectId: runId,
            reason: "Contract revision 已确认，旧版本 Run 安全结束",
            payload: {
              goal_id: input.goal_id,
              previous_contract_revision: input.previous_contract_revision,
              contract_revision: input.contract_revision,
            },
            at: input.at,
          });
        }
        repository.updateClaimState(
          claim.claim_id,
          "revoked",
          input.at,
          "abandoned_by_contract_revision",
        );
        appendEvent({
          eventId: id(),
          boardId: input.board_id,
          actorId: input.actor_id,
          type: "claim.revoked_by_contract_revision",
          objectType: "claim",
          objectId: claim.claim_id,
          reason: "Contract revision 已确认，旧版本 Claim 被撤销",
          payload: {
            goal_id: input.goal_id,
            previous_contract_revision: input.previous_contract_revision,
            contract_revision: input.contract_revision,
          },
          at: input.at,
        });
      }
      return;
    }
    for (const claim of activeClaims) {
      repository.updateClaimContractRevision(claim.claim_id, input.contract_revision);
    }
  }
