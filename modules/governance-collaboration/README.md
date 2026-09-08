# 提案、复核与决定事实

保存澄清、提案、Review obligation、Review 和用户决定，回答“谁依据什么确认了哪个变化”。

包名：`@adeptify/goalboard-module-governance-collaboration`。工作区内部包，通过仓库构建和 Host 装配使用。

## 一次典型调用

GovernanceCollaborationModule 装配记录、复核生命周期和 provenance；state-machine 校验转换。Native Goals 接收确认后，通过各 owner 执行目标树等变化，再把决定及关联事实留在这里。

## 从哪里读代码

公开入口是 [src/index.ts](src/index.ts)。生产调用使用包名或 package.json 声明的子路径；下列链接用于定位实现，不是深层导入示例。

| 文件 | 用途 |
| --- | --- |
| [src/index.ts](src/index.ts) | 模块服务与公开查询 |
| [src/review-lifecycle.ts](src/review-lifecycle.ts) | Review 生命周期 |
| [src/state-machine.ts](src/state-machine.ts) | 提案/决定状态转换 |
| [src/clarification-store.ts](src/clarification-store.ts) | 澄清会话事实 |

可对照现有调用方 [apps/local-host/src/goal-project-application.ts](../../apps/local-host/src/goal-project-application.ts) 阅读装配方式。

## 接入与边界

Governance 不直接替代 Goals/Artifacts/Projects 的写入接口。复核结论和 Goal 完成不是同一个状态；legacy proposal 视图仍用于兼容既有历史。

由 Local Host 装配数据库与协作端口；跨 Module 协作使用公开 Contract，不从另一 Module 深层导入实现。完整依赖见 [package.json](package.json)。

## 本地开发

以下命令在**仓库根目录**执行，使用 Node.js 24+ 与仓库配置的 pnpm。首次准备运行 `pnpm install --frozen-lockfile` 和 `pnpm build`；之后可单独检查此包。

```bash
pnpm --filter @adeptify/goalboard-module-governance-collaboration typecheck
pnpm --filter @adeptify/goalboard-module-governance-collaboration build
```

已有行为示例与回归：[governance-collaboration-module.test.ts](../../tests/governance-collaboration-module.test.ts)。完成上述构建后运行：

```bash
node --import tsx --test --test-concurrency=1 tests/governance-collaboration-module.test.ts
```

阅读测试中的输入与断言，可以看到接入方式、结果和错误分支。

## 进一步阅读

- [职责与接入说明](../../docs/modules/governance-collaboration.md)
- [架构与当前实现索引](../../docs/SSOT-MATRIX.md)

- Status: `partial`
- Contract entrypoint: `@adeptify/goalboard-contracts/modules/governance-collaboration`
- Migration Goals: `goal-reorg-f2`, `goal-reorg-ex3`, `goal-reorg-ex4`.

上述状态用于追踪架构实现范围；当前行为以本包公开入口、调用方和对应测试为准。
