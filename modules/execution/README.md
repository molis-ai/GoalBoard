# 执行领取与运行状态

维护 Claim、Run、尝试和租约，保证执行者领取、报告、恢复时遵循同一生命周期。

包名：`@adeptify/goalboard-module-execution`。工作区内部包，通过仓库构建和 Host 装配使用。

## 一次典型调用

ExecutionModule.commands 委托 ExecutionLifecycle 改变领取/运行状态，query 提供运行事实。Goals Plugin 把这些事实与目标合同、Review 等组合成可执行动作；Runtime Host 只处理实际进程。

## 从哪里读代码

公开入口是 [src/index.ts](src/index.ts)。生产调用使用包名或 package.json 声明的子路径；下列链接用于定位实现，不是深层导入示例。

| 文件 | 用途 |
| --- | --- |
| [src/index.ts](src/index.ts) | ExecutionModule 与只读 API |
| [src/lifecycle.ts](src/lifecycle.ts) | Claim/Run 生命周期 |
| [src/repository.ts](src/repository.ts) | 执行记录持久化 |
| [src/impact-policy.ts](src/impact-policy.ts) | 执行影响策略 |

可对照现有调用方 [apps/local-host/src/goal-project-application.ts](../../apps/local-host/src/goal-project-application.ts) 阅读装配方式。

## 接入与边界

Run 完成不等于 Goal 完成。目标合同、Evidence、Review 和 Session 不在本模块重复存储；并行影响策略通过明确的 impact policy 参与执行判断。

由 Local Host 装配数据库与协作端口；跨 Module 协作使用公开 Contract，不从另一 Module 深层导入实现。完整依赖见 [package.json](package.json)。

## 本地开发

以下命令在**仓库根目录**执行，使用 Node.js 24+ 与仓库配置的 pnpm。首次准备运行 `pnpm install --frozen-lockfile` 和 `pnpm build`；之后可单独检查此包。

```bash
pnpm --filter @adeptify/goalboard-module-execution typecheck
pnpm --filter @adeptify/goalboard-module-execution build
```

已有行为示例与回归：[execution-module.test.ts](../../tests/execution-module.test.ts)。完成上述构建后运行：

```bash
node --import tsx --test --test-concurrency=1 tests/execution-module.test.ts
```

阅读测试中的输入与断言，可以看到接入方式、结果和错误分支。

## 进一步阅读

- [职责与接入说明](../../docs/modules/execution.md)
- [架构与当前实现索引](../../docs/SSOT-MATRIX.md)

- Status: `partial`
- Contract entrypoint: `@adeptify/goalboard-contracts/modules/execution`
- Migration Goals: `goal-reorg-f2`, `goal-reorg-ex1`, `goal-reorg-ex4`.

上述状态用于追踪架构实现范围；当前行为以本包公开入口、调用方和对应测试为准。
