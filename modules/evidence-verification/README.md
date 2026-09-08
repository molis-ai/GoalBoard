# @adeptify/goalboard-module-evidence-verification

Status: `partial`  
Workspace path: `modules/evidence-verification`  
Contract entrypoint: `@adeptify/goalboard-contracts/modules/evidence-verification`

## Purpose

Evidence, immutable corrections, safe project-file references, criterion coverage, and automatic verification gates.

This package explicitly does **not** own Artifact bodies, Goal Contracts, Runs, or Review verdicts.

## Public entrypoint

`src/index.ts` exports the real `EvidenceVerificationModule`, its public Repository and migration helpers, file-reference utilities, and pure coverage projection functions.

The application API exposes:

- Query: Evidence and Correction lists, review-safe Evidence references, project-reference source lookup, criterion coverage, and post-rework freshness.
- Command: authorized Evidence submission, immutable supersede/retract, and attaching the Review that consumed human-verdict Evidence.
- Events: `evidence.submitted`, `evidence.superseded`, and `evidence.retracted` through the host event port.

`AuthorizedEvidenceSubmissionInput` means the caller has already checked the Goal Contract and optional Run ownership. The Module still owns Evidence invariants, locator validation, persistence, Correction rules, and coverage decisions; it never reads or writes the Goals Store.

## Internal boundaries

- `repository.ts`: Evidence/Correction schema, queries, mappings, and event-sequence reads.
- `lifecycle.ts`: submission, locator preflight, immutable Correction, ownership and cycle rules.
- `verification.ts` / `coverage.ts`: current criterion coverage, rework freshness, and snapshot projection rules.
- `locator.ts`: bounded local text/Markdown preflight and safe registered-worktree handling.
- `migrations.ts`: migrations 17–20 and the Evidence columns owned inside migration 30.

## Dependencies

The only declared workspace dependency is `@adeptify/goalboard-contracts`. Node filesystem and Git inspection use built-in APIs. The package does not deep-import legacy code or another Module implementation.

## Commands

```bash
pnpm --filter @adeptify/goalboard-module-evidence-verification typecheck
pnpm --filter @adeptify/goalboard-module-evidence-verification build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-ex2`
- `goal-reorg-ex4`

## Current caller ownership

Native Goals owns Goal/Run authorization, idempotency, action tokens, lifecycle reconciliation and Review orchestration through public Module APIs. Evidence invariants, persistence and locator validation remain here. Local Host assembles migrations, snapshot queries and bounded Web file access. The old Coordinator, Store, action projection and locator forwarding files have been removed.

Web/CLI/MCP keep their existing payloads. See [the architecture SSOT](../../docs/SSOT-MATRIX.md), [migration matrix](../../docs/system/MIGRATION.md), and [final validation](../../specs/goalboard-architecture-reorganization/cutover-validation.md).
