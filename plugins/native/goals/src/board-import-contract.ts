export interface LegacyV3ImportInput {
  schema_version: "3.0";
  goal_id: string;
  meta: {
    title?: string;
    source: { seed: string };
  };
  root_goal: {
    constraints: string[];
  };
  goals: Array<{
    id: string;
    parent: string | null;
    one_liner: string;
    covers: string[];
    inputs: string[];
    outputs: string[];
  }>;
  coverage_ledger: Array<{
    id: string;
    requirement: string;
    status: "now" | "later" | "out";
    owner_goal: string | null;
    reason?: string | null;
    entry_condition?: string | null;
    revisit_at?: string | null;
  }>;
}

export interface V3ImportReport {
  board_id: string;
  migrated: string[];
  regenerate: string[];
  goal_id_map: Record<string, string>;
  observed_event_cursor: number;
}
