# 目标、关系与生命周期事实

拥有目标合同、完成标准、关系图、策略、风险、项目指导、规划事实，以及 Goal 局部事件配置与工作事实上报，是目标写入及正式生命周期判断的入口。

包名：`@adeptify/goalboard-module-goals`。工作区内部包，通过仓库构建和 Host 装配使用。

## 一次典型调用

GoalsModule 公开 commands、query、lifecycle 与 events；Host 提供跨 owner hooks，Native Goals 用公开接口组合页面、执行验收和事件工作入口。createGoalReadServices 给读取场景提供明确服务，schema 与 revision 迁移也由本包提供。新意图和已采用事件配置的 Goal 由 `events` 作为唯一状态 owner，写入进展、Concern、决定效果和显式收尾；旧 lifecycle 完成入口在这些 Goal 上拒绝或跳过。

## 从哪里读代码

公开入口是 [src/index.ts](src/index.ts)。生产调用使用包名或 package.json 声明的子路径；下列链接用于定位实现，不是深层导入示例。

| 文件 | 用途 |
| --- | --- |
| [src/index.ts](src/index.ts) | GoalsModule 与读取服务 |
| [src/goal-commands.ts](src/goal-commands.ts) | 目标写入 |
| [src/query.ts](src/query.ts) | 查询与策略解析 |
| [src/lifecycle-commands.ts](src/lifecycle-commands.ts) | 生命周期入口 |
| [src/planning](src/planning) | 规划与方法库 |
| [src/event-facts.ts](src/event-facts.ts) | Goal 局部事件配置、上报与读取 |
| [src/planning/event-adoption.ts](src/planning/event-adoption.ts) | 规划来源版本解析、等价合并与 Goal 局部要求实例化 |

可对照现有调用方 [apps/local-host/src/goal-project-application.ts](../../apps/local-host/src/goal-project-application.ts) 阅读装配方式。

## 接入与边界

新意图和已转交 Goal 由 `events` 作为唯一状态 owner。执行 Claim/Run、证据、Review/Decision 各有独立 owner，实际消费者是未转交 `legacy_claim_run` Goal、历史读取和 Host 租约。规划事实不等于已确认提案；旧 coverage 兼容逻辑仍服务历史数据。不得以页面或 MCP 推导状态回写替代正式生命周期。

由 Local Host 装配数据库与协作端口；跨 Module 协作使用公开 Contract，不从另一 Module 深层导入实现。完整依赖见 [package.json](package.json)。

## 本地开发

以下命令在**仓库根目录**执行，使用 Node.js 24+ 与仓库配置的 pnpm。首次准备运行 `pnpm install --frozen-lockfile` 和 `pnpm build`；之后可单独检查此包。

```bash
pnpm --filter @adeptify/goalboard-module-goals typecheck
pnpm --filter @adeptify/goalboard-module-goals build
```

已有行为示例与回归：[goals-command-module.test.ts](../../tests/goals-command-module.test.ts)、[goals-query-module.test.ts](../../tests/goals-query-module.test.ts)、[goal-events.test.ts](../../tests/goal-events.test.ts)、[goal-events-state.test.ts](../../tests/goal-events-state.test.ts)。完成上述构建后运行：

```bash
node --import tsx --test --test-concurrency=1 tests/goals-command-module.test.ts tests/goals-query-module.test.ts tests/goal-events.test.ts tests/goal-events-state.test.ts
```

阅读测试中的输入与断言，可以看到接入方式、结果和错误分支。

## 进一步阅读

- [职责与接入说明](../../docs/modules/goals.md)
- [架构与当前实现索引](../../docs/SSOT-MATRIX.md)

- Status: `partial`
- Contract entrypoint: `@adeptify/goalboard-contracts/modules/goals`
- Migration Goals: `goal-reorg-f2`, `goal-f826dfb8-bf63-4e98-b6b7-57f6b4b7c3b8`, `goal-reorg-gw1`, `goal-reorg-gw2`, `goal-reorg-gw3`, `goal-reorg-gw4`.

上述状态用于追踪架构实现范围；当前行为以本包公开入口、调用方和对应测试为准。
