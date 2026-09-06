export type HumanDecisionKind = "contract" | "candidate" | "rewire" | "review" | "risk";

export interface DecisionCopy {
  question: string;
  purpose: string;
  insufficientEvidence: string;
}

const DECISION_COPY: Record<HumanDecisionKind, DecisionCopy> = {
  contract: {
    question: "这条 Goal 已经说清楚，可以开始了吗？",
    purpose: "确认后，目标、范围和完成标准会成为正式依据。",
    insufficientEvidence: "现在还不能可靠推荐确认。请先补齐目标、范围、完成标准或字段来源。",
  },
  candidate: {
    question: "要把这项新发现的工作加入 Goal Tree 吗？",
    purpose: "决定它是否需要成为一条独立 Goal，而不是留在当前工作的范围里。",
    insufficientEvidence: "现在还不能可靠推荐加入。请先说明它为什么超出原 Goal，以及独立完成能交付什么。",
  },
  rewire: {
    question: "要调整这些 Goal 的先后或归属关系吗？",
    purpose: "决定 Goal 之间实际的先后顺序或归属，已有执行中的工作不会被改绑。",
    insufficientEvidence: "现在还不能可靠推荐调整。请先补充关系方向、依据和拒绝后的影响。",
  },
  review: {
    question: "这份结果达到完成标准了吗？",
    purpose: "你的结论会决定结果通过、退回修改，还是因为依据不足暂不判断。",
    insufficientEvidence: "现在还不能可靠判断。请先补充与完成标准对应的结果或依据。",
  },
  risk: {
    question: "这个风险要现在处理、接受，还是暂缓？",
    purpose: "你的选择会决定风险是否继续阻止相关 Goal 完成。",
    insufficientEvidence: "现在还不能可靠推荐处理方式。请先补充触发条件、影响和可行的处理办法。",
  },
};

export function explainGoalDecision(kind: HumanDecisionKind, L: (text: string) => string): DecisionCopy {
  const copy = DECISION_COPY[kind];
  return {
    question: L(copy.question),
    purpose: L(copy.purpose),
    insufficientEvidence: L(copy.insufficientEvidence),
  };
}
