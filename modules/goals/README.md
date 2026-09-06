# @adeptify/goalboard-module-goals

Status: `partial`  
Workspace path: `modules/goals`  
Contract entrypoint: `@adeptify/goalboard-contracts/modules/goals`

## Purpose

Goal Contract, graph, policy, risk, lifecycle, guidance, and planning facts.

This package explicitly does **not** own Claims/Runs, Evidence, Reviews/Decisions, or cross-Module provenance.

## Public entrypoint

GW6: `GOALS_SCHEMA_SQL` owns the remaining Goal tables and indexes. The public migrations for 15/25/26 own Risk/Guidance upgrades. Migration 30 exposes `migrateGoalContractRevisionColumn` and `backfillGoalContractRevisions`; the Host calls both on the same connection inside its existing cross-owner transaction, with the success marker last. Do not run these stages in separate transactions.

`query.listLegacyCoverage(boardId)` and `commands.importLegacyCoverage(boardId, rows)` own the V3 `coverage_items` compatibility records. The importer still maps old IDs/status and owns the aggregate transaction and audit event; Web only reads the public Query. This is not Contract revision coverage or a new Ledger. No arbitrary SQL API is exposed.

`GoalsModuleHooks.supersedePendingContractProposals` is required for Draft edits. Bind the public Governance records operation on the same transaction connection. It returns superseded IDs in original creation order, preserving the existing Draft audit event; no no-op fallback or Governance SQL belongs in Goals. Direct Module tests must bind the real owner as well.

`src/index.ts` exports the public Goals Contract implementation. `GoalsModule.query` owns Goal/Relation/Risk/Policy/Guidance reads and Goal-owned snapshots. `GoalsModule.commands` owns Goal and Draft writes, relations, Policy, Risk, and project Guidance. `GoalsModule.lifecycle` owns Draft acceptance, Contract revision, completion/revalidation, archive, trash/restore, compound-parent reconciliation, and Goal lifecycle migrations. `GoalsModule.planning` owns project method selection/versioning, graph checks, metrics, and change-impact analysis. `GoalsRepository` is the repository used by those handlers.

`GoalsModule.impacts` owns resource declarations, their audit history and idempotent commands. `impact-repository.ts` owns their schema and history migration; `impact-commands.ts` uses the existing Goals command context. Accepted Proposal application uses `registerAccepted` inside the caller's authorized aggregate transaction, without adding duplicate standalone events. Execution consumes these public declaration types for compatibility checks; resource surfaces are not Ledger ObjectRefs.

The 37 built-in planning methods are package assets under `methods/`. Keeping them beside their owner makes source builds, npm packages, and the installed home runtime load the same catalog. The home installer exposes a contained compatibility link under the installed Runtime Skill for older readers; it does not create a second source copy.

Claims/Runs, Review obligations, Project active-Goal state, and action projection stay with their own owners. Lifecycle calls them through narrow ports; it does not read or write their stores. Planning consumes proposal-shaped values only for validation; Proposal and Decision persistence remain Governance-owned.

## Dependencies

DD2 adds finite already-confirmed Goal/Draft, Policy, Risk and Relation commands. `confirmed-goal`, `confirmed-policy`, `confirmed-risk` and `confirmed-relations` keep each owner's existing validation, writes and lifecycle behavior; they are not new external confirmation bypasses. `goal-contract-records` shares ordinary/confirmed creation and criteria records. The caller retains the whole decision transaction and Governance completion ordering. `planning.contracts` owns business-contract comparison and accepted closure/revision structure checks; the existing acceptance/revision/closure lifecycle methods are now typed in public Contracts. Legacy proposal composition remains DD2 work.

The only declared workspace dependency is `@adeptify/goalboard-contracts`. Implementation dependencies are added by the Goal that migrates a complete use case, never by deep-importing legacy code.

## Commands

Legacy aggregate confirmation also uses `registerAcceptedPolicy`, `registerAcceptedRisk` and `applyAcceptedRewireRelations`; their original audit ordering and distinct native/legacy behavior remain intact. All open Risk inserts share the repository implementation. `query.policyBindingVersion` encapsulates legacy and semantic-v1 proposal compatibility, including original serialized Policy values. Do not replace saved baselines with a newly parsed representation. Rewire and native planning share `planning.wouldCreatePartOfCycle`.

```bash
pnpm --filter @adeptify/goalboard-module-goals typecheck
pnpm --filter @adeptify/goalboard-module-goals build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-f826dfb8-bf63-4e98-b6b7-57f6b4b7c3b8`
- `goal-reorg-gw1`
- `goal-reorg-gw2`
- `goal-reorg-gw3`
- `goal-reorg-gw4`
- `goal-reorg-gw6`

## Legacy sources

AR2 also moves Goal input confirmation behind `GoalInputBindings(db, ledger)`. The host must supply a Ledger API on the same transaction connection. Goals owns `input_bindings` and its migration; parseable Feed source endpoints live only in Ledger, while confirmation metadata and opaque legacy locators remain here. Public `list` reconstructs compatible locators and rejects a missing registered source edge instead of silently losing provenance.

- `src/v1/`
- `src/planning/`

Goals Query, GW1 Command/Repository, GW2 Lifecycle/Migrations, GW3 Planning Engine, and GW4 application-entry migration are implemented. Web, MCP, and CLI Goal reads use the separate `goalQueries` boundary; Goal writes, lifecycle operations, and planning calls use app-owned adapters over `GoalsApplicationApi`. The old Coordinator write/lifecycle/planning forwarding methods and zero-caller Planning re-export files have been removed. Query compatibility delegates and cross-owner work/action projection remain until their owning migration Goals finish; EX4 owns the latter. See [the architecture SSOT](../../docs/SSOT-MATRIX.md), [migration matrix](../../docs/system/MIGRATION.md), and [one-off migration tooling](../../tooling/migrations/README.md).
# 查询消费说明（2026-09-06）

旧 FeedStore 的 Attention Goal subject 校验也必须调用公开 Goals Query；同项目 archived/trashed Goal 仍算存在，不用过滤后的可见 Goal 列表替代。缺失或跨项目 Goal 仍由 Attention 返回原错误，不能落 Inbox/审计事件。

Web 的全部 Policy 历史与 Risk 关联，以及 Runtime 的依赖、开放风险、最新替代关系必须通过 `GoalsQueryApi` 读取。`query-facts-repository.ts` 维护这一组已有读取，不增加新表或第二存储。历史规则使用 `listPolicyHistory`（含 active/replaced/withdrawn、来源与理由），不能用 `resolvePolicy` 或 active-only snapshot 代替。旧公开 Query caller 审查遗漏的旁路及纠正验收见 `specs/goalboard-architecture-reorganization/goals-query-correction.md`。
