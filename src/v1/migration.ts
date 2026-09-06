import { randomUUID } from "node:crypto";
import { GoalProjectApplication } from "@adeptify/goalboard-app-local-host";
import { LocalProjectDatabase } from "@adeptify/goalboard-app-local-host";

import type { LegacyV3ImportInput, V3ImportReport } from "@adeptify/goalboard-plugin-goals";
export type { LegacyV3ImportInput, V3ImportReport } from "@adeptify/goalboard-plugin-goals";

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "") || "legacy";
}

export function importV3Board(
  store: LocalProjectDatabase,
  coordinator: GoalProjectApplication,
  legacy: LegacyV3ImportInput,
  input: {
    target_board_id: string;
    actor_id: string;
    idempotency_key: string;
  },
): V3ImportReport {
  if (legacy.schema_version !== "3.0") {
    throw new Error(`只支持 V3 JSON，收到 schema_version=${legacy.schema_version}`);
  }
  const existing = store.db.prepare("SELECT board_id FROM boards WHERE board_id = ?").get(input.target_board_id);
  if (existing) throw new Error(`目标 Board 已存在，不会覆盖: ${input.target_board_id}`);

  return store.immediate(() => {
    coordinator.initializeBoard({
      board_id: input.target_board_id,
      title: legacy.meta.title || legacy.meta.source.seed,
      actor_id: input.actor_id,
      idempotency_key: `${input.idempotency_key}:board`,
    });
    const idMap: Record<string, string> = {};
    for (const legacyGoal of legacy.goals) {
      idMap[legacyGoal.id] = `${safeId(input.target_board_id)}:v3:${safeId(legacyGoal.id)}`;
    }
    for (const legacyGoal of legacy.goals) {
      const migratedId = idMap[legacyGoal.id];
      const hasChildren = legacy.goals.some((item) => item.parent === legacyGoal.id);
      coordinator.goals.commands.createGoal(
        input.target_board_id,
        {
          goal_id: migratedId,
          title: legacyGoal.one_liner,
          outcome: legacyGoal.one_liner,
          why: "从 Clarification Agent V3 迁入，保留原目标树供重新确认",
          business_logic: "旧数据没有完整的业务逻辑说明；这个 Goal 保持草稿，用户补全业务行为和验收条件后才能接受和领取。",
          in_scope: legacyGoal.covers,
          constraints: legacy.root_goal.constraints,
          required_inputs: legacyGoal.inputs,
          promised_outputs: legacyGoal.outputs,
          definition_state: "draft",
          decomposition_state: hasChildren ? "closed_compound" : "closed_leaf",
          acceptance_criteria: [
            {
              criterion_id: `${migratedId}:regenerate-acceptance`,
              statement: "用户重新定义这个 Goal 的可判定验收条件",
              decision_method: "human_decision",
              pass_condition: "验收条件被用户补全并重新接受 Goal",
              required_evidence: ["human_verdict"],
            },
          ],
        },
        {
          actor_id: input.actor_id,
          idempotency_key: `${input.idempotency_key}:goal:${legacyGoal.id}`,
          reason: "从 V3 导入可安全保留的 Goal 结构",
        },
      );
    }
    for (const legacyGoal of legacy.goals) {
      if (!legacyGoal.parent || !idMap[legacyGoal.parent]) continue;
      coordinator.goals.commands.addRelation(
        input.target_board_id,
        {
          from_goal_id: idMap[legacyGoal.id],
          to_goal_id: idMap[legacyGoal.parent],
          type: "part_of",
          reason: "保留 V3 Goal 树关系",
        },
        {
          actor_id: input.actor_id,
          idempotency_key: `${input.idempotency_key}:relation:${legacyGoal.id}`,
        },
      );
    }
    const now = new Date().toISOString();
    coordinator.goals.commands.importLegacyCoverage(input.target_board_id, legacy.coverage_ledger.map(item => {
      const disposition = item.status === "out" ? "out" : item.status === "later" ? "deferred" : item.owner_goal ? "covered" : "unresolved";
      return {
        requirement_id: `${safeId(input.target_board_id)}:v3:${safeId(item.id)}`,
        statement: item.requirement, disposition,
        owner_goal_id: item.owner_goal ? idMap[item.owner_goal] ?? null : null,
        reason: item.reason ?? "从 V3 coverage ledger 导入",
        revisit_condition: item.entry_condition ?? item.revisit_at ?? null,
        blocking: disposition === "unresolved", created_at: now, updated_at: now,
      };
    }));
    const activeGoalId = legacy.goals[0] ? idMap[legacy.goals[0].id] : null;
    store.db
      .prepare("UPDATE boards SET active_goal_id = ?, updated_at = ? WHERE board_id = ?")
      .run(activeGoalId, now, input.target_board_id);
    const cursor = store.appendEvent({
      eventId: randomUUID(),
      boardId: input.target_board_id,
      actorId: input.actor_id,
      type: "v3.imported",
      objectType: "board",
      objectId: input.target_board_id,
      reason: "保留可安全映射的 V3 字段，其余明确要求重新生成",
      payload: { legacy_goal_id: legacy.goal_id, legacy_schema_version: legacy.schema_version },
      at: now,
    });
    return {
      board_id: input.target_board_id,
      migrated: [
        "Goal 名称与父子树",
        "inputs / outputs",
        "root constraints",
        "coverage ledger disposition",
        "V3 source identity",
      ],
      regenerate: [
        "每个 Goal 的非技术业务逻辑",
        "可判定验收条件与 Evidence",
        "accepted / satisfied 状态",
        "依赖、Impact Surface、Risk 与 Policy",
        "Review 独立性和用户确认",
        "未关闭的澄清票",
      ],
      goal_id_map: idMap,
      observed_event_cursor: cursor,
    };
  });
}
