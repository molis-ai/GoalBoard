export type PanelRecord = {
  panel_id: string;
  goal_id: string;
  runtime_kind: string;
  launch_command: string;
  launch_args: string[];
  cwd: string | null;
  work_context_id: string;
  title: string;
  status: "open" | "exited";
  spawn?: {
    command: string;
    args: string[];
    cwd: string | null;
    env: Record<string, string>;
    sessionId?: string | null;
  };
};

export type SpawnMode = "start" | "attach" | "reopen" | "reconnect";
