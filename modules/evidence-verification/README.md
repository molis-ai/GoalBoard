# 依据记录与验证条件

保存 Evidence、不可变更正和标准覆盖，判断现有依据是否足以进入验证流程。

包名：`@adeptify/goalboard-module-evidence-verification`。工作区内部包，通过仓库构建和 Host 装配使用。

## 一次典型调用

EvidenceVerificationModule.commands 记录依据及更正；query 由验证服务提供。locator preflight 校验引用形态，coverage 区分当前有效依据与已有结果；实际 Review 结论由 Governance 保存。

## 从哪里读代码

公开入口是 [src/index.ts](src/index.ts)。生产调用使用包名或 package.json 声明的子路径；下列链接用于定位实现，不是深层导入示例。

| 文件 | 用途 |
| --- | --- |
| [src/index.ts](src/index.ts) | Module Command/Query |
| [src/lifecycle.ts](src/lifecycle.ts) | 依据及更正生命周期 |
| [src/coverage.ts](src/coverage.ts) | 有效依据与覆盖 |
| [src/locator.ts](src/locator.ts) | 引用预检 |

可对照现有调用方 [apps/local-host/src/goal-project-application.ts](../../apps/local-host/src/goal-project-application.ts) 阅读装配方式。

## 接入与边界

依据不是 Artifact 正文，也不是用户/Runtime 的 Review verdict。旧记录的更正须保留历史，不能覆盖原始依据来制造通过结果。

由 Local Host 装配数据库与协作端口；跨 Module 协作使用公开 Contract，不从另一 Module 深层导入实现。完整依赖见 [package.json](package.json)。

## 本地开发

以下命令在**仓库根目录**执行，使用 Node.js 24+ 与仓库配置的 pnpm。首次准备运行 `pnpm install --frozen-lockfile` 和 `pnpm build`；之后可单独检查此包。

```bash
pnpm --filter @adeptify/goalboard-module-evidence-verification typecheck
pnpm --filter @adeptify/goalboard-module-evidence-verification build
```

已有行为示例与回归：[evidence-verification-module.test.ts](../../tests/evidence-verification-module.test.ts)。完成上述构建后运行：

```bash
node --import tsx --test --test-concurrency=1 tests/evidence-verification-module.test.ts
```

阅读测试中的输入与断言，可以看到接入方式、结果和错误分支。

## 进一步阅读

- [职责与接入说明](../../docs/modules/evidence-verification.md)
- [架构与当前实现索引](../../docs/SSOT-MATRIX.md)

- Status: `partial`
- Contract entrypoint: `@adeptify/goalboard-contracts/modules/evidence-verification`
- Migration Goals: `goal-reorg-f2`, `goal-reorg-ex2`, `goal-reorg-ex4`.

上述状态用于追踪架构实现范围；当前行为以本包公开入口、调用方和对应测试为准。
