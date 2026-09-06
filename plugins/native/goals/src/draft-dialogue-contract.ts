import type { GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionClaimRecord as ClaimRecord, ExecutionRunRecord as RunRecord } from "@adeptify/goalboard-contracts/modules/execution";
import type { ClarificationSessionRecord, ClarificationTurnRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalWorkStateView } from "./execution-validation-contract.js";

export interface DraftDialogueStartInput {
  board_id: string;
  actor_id: string;
  rough_idea: string;
  draft_title?: string;
  goal_id?: string;
  capabilities?: string[];
  goal_mode_attestation?: boolean;
  lease_seconds?: number;
  idempotency_key: string;
}

export interface DraftDialogueTurnInput {
  board_id: string;
  goal_id: string;
  run_id: string;
  actor_id: string;
  user_message: string;
  current_understanding: string;
  known_facts?: import("@adeptify/goalboard-contracts/modules/governance-collaboration").ClarificationFactInput[];
  assumptions?: import("@adeptify/goalboard-contracts/modules/governance-collaboration").ClarificationAssumptionInput[];
  next_question?: string | null;
  proposal_summary?: string | null;
  idempotency_key: string;
}

export interface DraftDialogueResumeInput {
  board_id: string;
  goal_id: string;
  actor_id: string;
  capabilities?: string[];
  goal_mode_attestation?: boolean;
  lease_seconds?: number;
  idempotency_key: string;
}

export interface DraftDialogueView {
  dialogue: ClarificationSessionRecord;
  turns: ClarificationTurnRecord[];
  goal: GoalRecord;
  work_state: GoalWorkStateView;
  claim: ClaimRecord | null;
  run: RunRecord | null;
  observed_event_cursor: number;
}

export interface DraftDialogueApplicationApi {
  startDraftDialogue(input: DraftDialogueStartInput): DraftDialogueView & { replayed: boolean };
  recordDraftDialogueTurn(input: DraftDialogueTurnInput): DraftDialogueView & { replayed: boolean };
  resumeDraftDialogue(input: DraftDialogueResumeInput): DraftDialogueView & { replayed: boolean };
}
