import type { ExecutionValidationSnapshot } from "@adeptify/goalboard-plugin-goals";

type EvidenceRecord = ExecutionValidationSnapshot["evidence"][number];

export const EXECUTION_EVIDENCE_KIND_LABELS: Record<EvidenceRecord["kind"], string> = {
  test: "测试",
  measurement: "测量",
  artifact: "产物",
  inspection: "检查",
  attestation: "人工陈述",
  human_verdict: "人工结论",
};

export const EXECUTION_EVIDENCE_RESULT_LABELS: Record<EvidenceRecord["result"], string> = {
  passed: "通过",
  failed: "失败",
  inconclusive: "证据不足",
};
