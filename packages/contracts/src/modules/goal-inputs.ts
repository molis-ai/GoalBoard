/** Goal-owned confirmation receipt. A locator is not automatically an Artifact identity. */
export interface GoalInputBindingRecord {
  binding_id: string;
  board_id: string;
  goal_id: string;
  input_name: string;
  source_type: string;
  source_ref: string;
  snapshot_digest: string | null;
  state: "proposed" | "confirmed" | "inactive";
  reason: string;
  created_by: string;
  created_at: string;
}

export interface GoalInputBindingsApi {
  list(boardId: string): GoalInputBindingRecord[];
  register(input: GoalInputBindingRecord): void;
}
