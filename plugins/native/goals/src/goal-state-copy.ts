import type { GoalPresentationState } from "./tree-order.js";
export interface WorkStateExplanation {
  label: string;
  meaning: string;
  nextAction: string;
  howToContinue: string;
  actionKind:
    | "clarify"
    | "close_parent"
    | "decide"
    | "choose_child"
    | "start"
    | "view_progress"
    | "resolve_blocker"
    | "review"
    | "revalidate"
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
  clarification_pending: {
    label: "目标待澄清",
    meaning: "这条 Goal 还只是草稿，现在不能开始执行。",
    nextAction: "补全并确认这条 Goal",
    howToContinue: "说明想要的结果、工作范围和怎样才算完成。",
    actionKind: "clarify",
  },
  clarification_decision_pending: {
    label: "待你确认",
    meaning: "方案已经整理好，采用前仍保留原草稿，暂时不能开始。",
    nextAction: "查看并决定这份方案",
    howToContinue: "在待决定中查看会改什么，然后选择采用或退回修改。",
    actionKind: "decide",
  },
  compound_closure_pending: {
    label: "待确认父目标",
    meaning: "现有子 Goal 都完成了，但父 Goal 仍标记为尚未拆完，所以不会自动完成。",
    nextAction: "确认当前拆分是否完整",
    howToContinue: "如果这些子 Goal 已覆盖整个目标，就确认由它们共同完成；否则继续补充遗漏的子 Goal。",
    actionKind: "close_parent",
  },
  clarifying: {
    label: "目标澄清中",
    meaning: "这条 Goal 正在补全关键信息，还没有成为可执行工作。",
    nextAction: "继续回答关键问题",
    howToContinue: "补上仍会影响结果、范围或完成标准的信息。",
    actionKind: "clarify",
  },
  clarification_blocked: {
    label: "目标澄清受阻",
    meaning: "缺少必要信息或决定，所以暂时不能完成目标说明。",
    nextAction: "先解决目标说明的卡点",
    howToContinue: "查看被挡住的原因，再补信息或完成对应决定。",
    actionKind: "resolve_blocker",
  },
  waiting_children: {
    label: "等待子 Goal",
    meaning: "这项工作由子 Goal 共同完成，不直接执行这个上层 Goal。",
    nextAction: "选择一个可以开始的子 Goal",
    howToContinue: "进入具体子 Goal，查看它的下一步并从那里打开终端。",
    actionKind: "choose_child",
  },
  execution_pending: {
    label: "待执行",
    meaning: "目标和完成标准已经确认，现在可以开始推进。",
    nextAction: "开始推进这条 Goal",
    howToContinue: "在这条 Goal 下打开终端，或让 Runtime 领取后开始工作。",
    actionKind: "start",
  },
  executing: {
    label: "执行中",
    meaning: "已经有人或 Runtime 在处理这条 Goal。",
    nextAction: "查看最新进展",
    howToContinue: "继续当前工作，或查看最近结果、卡点和完成依据。",
    actionKind: "view_progress",
  },
  execution_blocked: {
    label: "执行受阻",
    meaning: "当前有未解决的依赖、风险或决定，工作不能继续。",
    nextAction: "先解除当前阻塞",
    howToContinue: "查看具体原因，完成前置工作或处理等待你的决定。",
    actionKind: "resolve_blocker",
  },
  completion_pending: {
    label: "待完成",
    meaning: "执行、完成依据和所需复核都已完成，不需要重新执行。",
    nextAction: "运行完成判定",
    howToContinue: "让 Runtime 直接重试完成判定；不要重新领取或重复执行这条 Goal。",
    actionKind: "start",
  },
  completion_blocked: {
    label: "完成受阻",
    meaning: "工作和复核已经完成，但仍有完成门禁没有解除。",
    nextAction: "处理完成门禁",
    howToContinue: "查看具体风险或决定，按恢复条件处理后再运行完成判定；不要重新执行。",
    actionKind: "resolve_blocker",
  },
  review_pending: {
    label: "待复核",
    meaning: "工作结果已经提交，但还没有完成所需检查。",
    nextAction: "检查结果是否达到完成标准",
    howToContinue: "对照完成标准和已有依据，提交通过或需要修改的结论。",
    actionKind: "review",
  },
  reviewing: {
    label: "复核中",
    meaning: "检查者正在判断结果是否达到完成标准。",
    nextAction: "等待或继续完成检查",
    howToContinue: "查看检查进展；如果由你检查，就对照标准提交结论。",
    actionKind: "review",
  },
  review_blocked: {
    label: "复核受阻",
    meaning: "当前缺少检查所需的结果、依据或检查者。",
    nextAction: "补齐检查需要的内容",
    howToContinue: "查看具体卡点，补交结果或依据，再重新检查。",
    actionKind: "resolve_blocker",
  },
  waiting_for_human: {
    label: "等待你验收",
    meaning: "Runtime 能完成的检查已经结束，现在只剩你本人操作、判断或确认的完成标准。",
    nextAction: "完成真实操作并提交验收决定",
    howToContinue: "在待决定中提交你的判断；如果完成标准要求验收依据，也一并登记真实操作结果。",
    actionKind: "decide",
  },
  revalidation_pending: {
    label: "待重新验证",
    meaning: "依赖、风险或目标事实发生了变化，旧结论不能直接沿用。",
    nextAction: "重新确认这条 Goal 仍然成立",
    howToContinue: "检查变化后的目标、依赖、风险和已有依据。",
    actionKind: "revalidate",
  },
  revalidating: {
    label: "重新验证中",
    meaning: "当前正在核对变化是否影响这条 Goal 和已有结果。",
    nextAction: "完成变化后的核对",
    howToContinue: "提交新的核对依据，说明这条 Goal 是否仍然有效。",
    actionKind: "revalidate",
  },
  revalidation_blocked: {
    label: "重新验证受阻",
    meaning: "缺少核对变化所需的信息、依赖结果或风险处理。",
    nextAction: "补齐重新确认需要的内容",
    howToContinue: "查看具体卡点，先补信息或处理关联事项。",
    actionKind: "resolve_blocker",
  },
  replaced: {
    label: "已被替代",
    meaning: "用户已经确认由另一条 Goal 接替这项工作；旧 Contract 和历史仍保留，但不再允许 Runtime 领取。",
    nextAction: "转到替代 Goal 继续",
    howToContinue: "查看 Goal 关系中的替代方并推进新版；只有用户撤销替代关系后，旧 Goal 才会重新开放。",
    actionKind: "none",
  },
  invalidated: {
    label: "已失效",
    meaning: "新的事实已经让这条 Goal 或已有结果失效。",
    nextAction: "查看失效原因并决定后续处理",
    howToContinue: "确认发生了什么，再创建替代工作或恢复成立条件。",
    actionKind: "resolve_blocker",
  },
  satisfied: {
    label: "已完成",
    meaning: "完成标准和所需检查已经满足。",
    nextAction: "查看结果或归档这条 Goal",
    howToContinue: "确认结果不再需要日常关注后，可以把它归档。",
    actionKind: "archive",
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
