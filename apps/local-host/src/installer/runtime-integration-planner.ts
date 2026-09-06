import path from "node:path";
import { INTEGRATION_OWNER } from "./runtime-integration-contract.js";
import type { RuntimeAdapter, SupportedRuntimeId, RuntimeSnapshot, IntegrationReceipt, PreparedPlan, RuntimeIntegrationPlan, RuntimeIntegrationChange, RuntimeIntegrationAction, SkillSnapshot } from "./runtime-integration-contract.js";
import { digest } from "./runtime-config-text.js";

interface RuntimeIntegrationPlanPaths {
  homeDirectory: string;
  userHomeDirectory: string;
  receiptPath(runtimeId: SupportedRuntimeId): string;
  backupPath(runtimeId: SupportedRuntimeId, planId: string): string;
}

/** Builds previews only; cannot execute writes or authorize confirmation. */
export class RuntimeIntegrationPlanner {
  constructor(private readonly paths: RuntimeIntegrationPlanPaths) {}

  prepareConnect(snapshot: RuntimeSnapshot, receipt: IntegrationReceipt | null): PreparedPlan {
    const { adapter } = snapshot;
    const common = this.planCommon(snapshot, "connect");
    if (!snapshot.runtimeDetected) {
      return preparedWithStatus(common, snapshot, receipt, "unavailable", `没有检测到 ${adapter.displayName}，不会修改配置。`);
    }
    if (!snapshot.artifacts) {
      return preparedWithStatus(common, snapshot, receipt, "unavailable", "GoalBoard 本体安装不完整，请先修复安装。" );
    }
    if (snapshot.configInspection.state === "conflict" || snapshot.skill.state === "conflict") {
      return preparedWithStatus(
        common,
        snapshot,
        receipt,
        "conflict",
        "发现同名但不属于 GoalBoard 的配置或 Skill。为避免覆盖用户内容，本次不会写入。",
      );
    }

    const desired = adapter.desiredConnection(snapshot.artifacts, this.paths.homeDirectory);
    const nextConfig = adapter.connectConfig(snapshot.configText, desired);
    const alreadyConnected = snapshot.configInspection.state === "current" && snapshot.skill.state === "current";
    const backupPath = snapshot.configText !== null && nextConfig !== snapshot.configText
      ? this.paths.backupPath(adapter.id, common.planId)
      : null;
    const changes: RuntimeIntegrationChange[] = [];
    if (nextConfig !== snapshot.configText) {
      changes.push({
        kind: "runtime_config",
        target_path: adapter.configPath(this.paths.userHomeDirectory),
        operation: snapshot.configInspection.state === "absent" ? "add" : "replace",
        before: snapshot.configInspection.summary,
        after: `GoalBoard MCP（命令 ${snapshot.artifacts.launcherPath}；环境仅含 GOALBOARD_HOME、GOALBOARD_MCP_AUDIENCE、GOALBOARD_RUNTIME_ID）`,
      });
    }
    if (snapshot.skill.state !== "current") {
      changes.push({
        kind: "skill_link",
        target_path: adapter.skillPath(this.paths.userHomeDirectory),
        operation: snapshot.skill.state === "absent" ? "add" : "replace",
        before: skillSummary(snapshot.skill),
        after: `链接到 ${snapshot.artifacts.skillSourcePath}`,
      });
    }
    if (!alreadyConnected || !receipt) {
      changes.push({
        kind: "ownership_receipt",
        target_path: this.paths.receiptPath(adapter.id),
        operation: receipt ? "replace" : "add",
        before: receipt ? "已有 GoalBoard 所有权收据" : "无",
        after: "记录 GoalBoard 写入的字段指纹和 Skill 链接，不保存用户配置内容",
      });
    }

    const publicPlan = this.publicPlan(common, alreadyConnected && receipt ? "no_change" : "ready", changes, backupPath,
      alreadyConnected && receipt ? `${adapter.displayName} 已经接入，无需重复写入。` : `准备接入 ${adapter.displayName}。`);
    return {
      publicPlan,
      adapter,
      beforeConfigText: snapshot.configText,
      beforeConfigHash: snapshot.configHash,
      beforeSkill: snapshot.skill,
      nextConfigText: nextConfig,
      artifacts: snapshot.artifacts,
      receipt,
    };
  }

  prepareRemove(snapshot: RuntimeSnapshot, receipt: IntegrationReceipt | null): PreparedPlan {
    const { adapter } = snapshot;
    const common = this.planCommon(snapshot, "remove");
    const hasGoalBoardState = snapshot.configInspection.state !== "absent" || snapshot.skill.state !== "absent";
    if (!receipt) {
      const status = hasGoalBoardState ? "conflict" : "no_change";
      const message = hasGoalBoardState
        ? "现有 GoalBoard 配置没有统一接入服务的所有权收据，不能自动删除。可先完成一次接入修复，再从同一入口移除。"
        : `${adapter.displayName} 没有由 GoalBoard 管理的接入。`;
      return preparedWithStatus(common, snapshot, receipt, status, message);
    }
    if (
      receipt.config_path !== adapter.configPath(this.paths.userHomeDirectory)
      || receipt.skill_path !== adapter.skillPath(this.paths.userHomeDirectory)
      || snapshot.configInspection.entryFingerprint !== receipt.config_entry_fingerprint
      || snapshot.skill.resolvedLinkTarget !== path.resolve(receipt.skill_target)
    ) {
      return preparedWithStatus(
        common,
        snapshot,
        receipt,
        "conflict",
        "GoalBoard 接入后相关配置或 Skill 已被改动。为避免删除用户修改，本次不会移除。",
      );
    }

    const nextConfig = adapter.removeConfig(snapshot.configText);
    const backupPath = snapshot.configText !== null && nextConfig !== snapshot.configText
      ? this.paths.backupPath(adapter.id, common.planId)
      : null;
    const changes: RuntimeIntegrationChange[] = [
      {
        kind: "runtime_config",
        target_path: adapter.configPath(this.paths.userHomeDirectory),
        operation: "remove",
        before: snapshot.configInspection.summary,
        after: "只移除 GoalBoard MCP entry，保留其他 Runtime 配置",
      },
      {
        kind: "skill_link",
        target_path: adapter.skillPath(this.paths.userHomeDirectory),
        operation: "remove",
        before: skillSummary(snapshot.skill),
        after: "移除 GoalBoard 创建的 Skill 链接",
      },
      {
        kind: "ownership_receipt",
        target_path: this.paths.receiptPath(adapter.id),
        operation: "remove",
        before: "GoalBoard 所有权收据",
        after: "无",
      },
    ];
    return {
      publicPlan: this.publicPlan(common, "ready", changes, backupPath, `准备移除 ${adapter.displayName} 的 GoalBoard 接入。`),
      adapter,
      beforeConfigText: snapshot.configText,
      beforeConfigHash: snapshot.configHash,
      beforeSkill: snapshot.skill,
      nextConfigText: nextConfig,
      artifacts: snapshot.artifacts,
      receipt,
    };
  }

  private planCommon(snapshot: RuntimeSnapshot, action: RuntimeIntegrationAction): {
    planId: string;
    planHash: string;
    adapter: RuntimeAdapter;
    action: RuntimeIntegrationAction;
  } {
    const payload = {
      owner: INTEGRATION_OWNER,
      runtime_id: snapshot.adapter.id,
      action,
      config_path: snapshot.adapter.configPath(this.paths.userHomeDirectory),
      config_hash: snapshot.configHash,
      skill_path: snapshot.adapter.skillPath(this.paths.userHomeDirectory),
      skill_signature: snapshot.skill.signature,
      launcher_path: snapshot.artifacts?.launcherPath ?? null,
      skill_source_path: snapshot.artifacts?.skillSourcePath ?? null,
    };
    const planHash = digest(JSON.stringify(payload));
    return {
      planId: `runtime-integration-${planHash.slice(0, 24)}`,
      planHash,
      adapter: snapshot.adapter,
      action,
    };
  }

  private publicPlan(
    common: { planId: string; planHash: string; adapter: RuntimeAdapter; action: RuntimeIntegrationAction },
    status: RuntimeIntegrationPlan["status"],
    changes: RuntimeIntegrationChange[],
    backupPath: string | null,
    message: string,
  ): RuntimeIntegrationPlan {
    const verb = common.action === "connect" ? "接入" : "移除接入";
    return {
      schema_version: 1,
      plan_id: common.planId,
      plan_hash: common.planHash,
      runtime_id: common.adapter.id,
      display_name: common.adapter.displayName,
      action: common.action,
      status,
      changes,
      backup_path: backupPath,
      confirmation: `确认${verb} ${common.adapter.displayName}`,
      alternative: "可以保持当前状态，稍后再从设置页操作；GoalBoard 本体和已有项目不会受影响。",
      restart_instructions: [...common.adapter.restartInstructions],
      message,
    };
  }
}

export function preparedWithStatus(
  common: { planId: string; planHash: string; adapter: RuntimeAdapter; action: RuntimeIntegrationAction },
  snapshot: RuntimeSnapshot,
  receipt: IntegrationReceipt | null,
  status: RuntimeIntegrationPlan["status"],
  message: string,
): PreparedPlan {
  const verb = common.action === "connect" ? "接入" : "移除接入";
  return {
    publicPlan: {
      schema_version: 1,
      plan_id: common.planId,
      plan_hash: common.planHash,
      runtime_id: common.adapter.id,
      display_name: common.adapter.displayName,
      action: common.action,
      status,
      changes: [],
      backup_path: null,
      confirmation: `确认${verb} ${common.adapter.displayName}`,
      alternative: "可以保持当前状态，稍后再从设置页操作；GoalBoard 本体和已有项目不会受影响。",
      restart_instructions: [...common.adapter.restartInstructions],
      message,
    },
    adapter: common.adapter,
    beforeConfigText: snapshot.configText,
    beforeConfigHash: snapshot.configHash,
    beforeSkill: snapshot.skill,
    nextConfigText: snapshot.configText,
    artifacts: snapshot.artifacts,
    receipt,
  };
}

export function skillSummary(skill: SkillSnapshot): string {
  if (skill.state === "absent") return "未安装 GoalBoard Skill";
  if (skill.state === "current") return "当前 GoalBoard Skill 链接";
  if (skill.state === "managed") return "旧版 GoalBoard Skill 链接";
  return "同名但不属于 GoalBoard 的 Skill";
}

