# 目标用例与原生界面

把目标合同、执行、依据、复核和上下文组合成用户可操作的目标工作流，并提供目标树、文档和决定界面。

包名：`@adeptify/goalboard-plugin-goals`。工作区内部包，通过仓库构建和 Host 装配使用。

## 一次典型调用

Host 注入各 Module 的公开端口；ExecutionValidationApplication、GoalReadApplication 等组合状态与操作，HTTP handler 和 UI contribution 将结果交给各 App。批量工作状态复用本次读取的 snapshot。

## 从哪里读代码

公开入口是 [src/index.ts](src/index.ts)。生产调用使用包名或 package.json 声明的子路径；下列链接用于定位实现，不是深层导入示例。

| 文件 | 用途 |
| --- | --- |
| [src/execution-validation-application.ts](src/execution-validation-application.ts) | 执行与验收用例 |
| [src/goal-query-application.ts](src/goal-query-application.ts) | 目标读取 |
| [src/goal-tree-decision.ts](src/goal-tree-decision.ts) | 目标树确认 |
| [src/document-collection.ts](src/document-collection.ts) | 文档列表投影 |
| [src/http/index.ts](src/http/index.ts) | Web 操作入口 |

可对照现有调用方 [apps/local-host/src/goal-project-application.ts](../../../apps/local-host/src/goal-project-application.ts) 阅读装配方式。

## 接入与边界

这里拥有跨 Module 用例及呈现，不取代 Module 事实 owner。提案检查、确认、执行和完成各有独立门禁；legacy 文件仍承接旧提案/数据，不是可以整批删除的空壳。

工作区依赖：`@adeptify/goalboard-contracts`、`@adeptify/goalboard-module-evidence-verification`、`@adeptify/goalboard-module-execution`、`@adeptify/goalboard-module-goals`。其他运行依赖见 [package.json](package.json)。

## 本地开发

以下命令在**仓库根目录**执行，使用 Node.js 24+ 与仓库配置的 pnpm。首次准备运行 `pnpm install --frozen-lockfile` 和 `pnpm build`；之后可单独检查此包。

```bash
pnpm --filter @adeptify/goalboard-plugin-goals typecheck
pnpm --filter @adeptify/goalboard-plugin-goals build
```

已有行为示例与回归：[execution-validation-app-adapters.test.ts](../../../tests/execution-validation-app-adapters.test.ts)、[goals-document-ui.test.ts](../../../tests/goals-document-ui.test.ts)。完成上述构建后运行：

```bash
node --import tsx --test --test-concurrency=1 tests/execution-validation-app-adapters.test.ts tests/goals-document-ui.test.ts
```

阅读测试中的输入与断言，可以看到接入方式、结果和错误分支。

## 进一步阅读

- [职责与接入说明](../../../docs/modules/goals.md)
- [架构与当前实现索引](../../../docs/SSOT-MATRIX.md)

- Status: `partial`
- Contract entrypoint: `@adeptify/goalboard-contracts/platform/plugin`
- Migration Goals: `goal-reorg-f2`, `goal-f826dfb8-bf63-4e98-b6b7-57f6b4b7c3b8`, `goal-reorg-gw4`, `goal-reorg-gw5`, `goal-reorg-ex4`.

上述状态用于追踪架构实现范围；当前行为以本包公开入口、调用方和对应测试为准。
