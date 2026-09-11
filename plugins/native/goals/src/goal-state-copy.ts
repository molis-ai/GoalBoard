import type { GoalPresentationState } from "./tree-order.js";
export interface WorkStateExplanation {
  label: string;
  meaning: string;
  nextAction: string;
  howToContinue: string;
  actionKind:
    | "decide"
    | "start"
    | "view_progress"
    | "resolve_blocker"
    | "archive"
    | "restore"
    | "none";
}

interface WorkStateCopy {
  label: string;
  meaning: string;
  nextAction: string;
  howToContinue: string;
  actionKind: WorkStateExplanation["actionKind"];
}

export const WORK_STATE_COPY: Record<GoalPresentationState, WorkStateCopy> = {
  waiting_for_human: {
    label: "需要你决定",
    meaning: "这条 Goal 有待你确认的当前事件决定。",
    nextAction: "作出决定",
    howToContinue: "在这条 Goal 的事件记录里提交你的判断。",
    actionKind: "decide",
  },
  executing: {
    label: "正在推进",
    meaning: "按当前约定记录事实。",
    nextAction: "记录进展",
    howToContinue: "继续记录事实、进展或决定。",
    actionKind: "view_progress",
  },
  execution_blocked: {
    label: "可记录，尚不可完成",
    meaning: "仍有会挡住收尾的 Concern。",
    nextAction: "处理 Concern",
    howToContinue: "先处理挡住收尾的事项，再按当前约定继续。",
    actionKind: "resolve_blocker",
  },
  execution_pending: {
    label: "可记录",
    meaning: "这条 Goal 可以按当前约定记录事实。",
    nextAction: "开始记录",
    howToContinue: "在这条 Goal 下记录事实或规划事件类型。",
    actionKind: "start",
  },
  satisfied: {
    label: "已完成",
    meaning: "这条 Goal 已有明确完成结论。",
    nextAction: "查看结果或归档",
    howToContinue: "如需继续，打开「继续此目标」并填写原因。",
    actionKind: "archive",
  },
  invalidated: {
    label: "已取消",
    meaning: "这条 Goal 已取消，不会被普通记录自动恢复。",
    nextAction: "显式继续",
    howToContinue: "继续前必须打开「显式继续」并填写原因。",
    actionKind: "none",
  },
  trashed: {
    label: "回收站",
    meaning: "这条 Goal 已从日常列表移除，但内容和历史仍然保留。",
    nextAction: "按需要恢复这条 Goal",
    howToContinue: "确认仍要继续这项工作后，把它恢复到 Goal Tree。",
    actionKind: "restore",
  },
  archived: {
    label: "已归档",
    meaning: "这条 Goal 已完成并退出日常工作列表，完整记录仍然保留。",
    nextAction: "查看结果或恢复到日常列表",
    howToContinue: "通常不需要操作；需要继续关注时再恢复。",
    actionKind: "restore",
  },
};
