# @adeptify/goalboard-plugin-cli

Status: `partial`

Contract entrypoint: `@adeptify/goalboard-contracts/platform/tooling`.
Migration Goals: `goal-reorg-f2`, `goal-reorg-dv3`.
DV3 developer-tool entrypoint; not a marketplace or Runtime installer.

## Available now

`goalboard-plugin validate <manifest.json>` reads JSON and invokes the public Plugin Contract parser. Exit 0 returns the validated identity/version, exit 1 reports invalid input or I/O failure, exit 2 means unsupported usage. It does not execute the Plugin or write configuration.

```bash
pnpm --filter @adeptify/goalboard-contracts build
pnpm --filter @adeptify/goalboard-plugin-cli build
node tooling/plugin-cli/dist/main.js validate /path/to/manifest.json
```

The package exports `runPluginCli`, `validatePluginManifestFile`, `createPluginProject`, packaging and signing adapters. It uses only public Contracts and Plugin Runtime entrypoints; validation and signature rules are not duplicated here. `bin` points to the source-distributed `bin/goalboard-plugin.mjs`, which only imports the compiled entrypoint. This lets a clean workspace install create the command before the first build. Build before invoking it; no CLI implementation is copied into the launcher.

`goalboard-plugin create <directory> <plugin-id> <publisher-id> <binding-signature>` creates a local sample with public SDK imports. The parent directory must exist and the target must not exist; existing projects are never overwritten. The binding is explicitly supplied by the developer, not fabricated proof of official signing. The sample's SDK dependency must be installed from the matching local distribution until actual publishing is approved.

## Application development command

`goalboard plugin dev <source-directory> <isolated-state-directory> <comma-separated-grants> --allow-unsigned-development` delegates to the application's real Local Host. It installs, starts, polls, renders and uninstalls while retaining private development data and exchanged Artifacts. A second invocation restores the counter. The standalone CLI exports a `PluginCliHost` injection port, but never creates a second application Store itself. See the [developer guide](../../docs/platform/PLUGIN-DEVELOPMENT.md) for reproducible commands, the public fixture and the trusted-code limitation.

## Local package and signing commands

`pack <directory> <output.json>` includes package.json, manifest.json and the explicit files list (no globs, symlinks, directory traversal or lifecycle scripts). The resulting JSON bundle is limited to 64 MiB. Output files are never overwritten.

`identity <public-key.pem>` returns the Ed25519 publisher binding for use when creating a signed Plugin. `sign <input.json> <private-key.pem> <output.json>` reads only the explicitly supplied private key and requires that binding to match the Manifest. `verify <input.json> <trusted-public-key.pem>` requires the caller's trusted key; it does not trust a key supplied by the package. Unsigned local development packages cannot pass verification.

Signing authenticates the bundled bytes and publisher binding, not official review or marketplace admission. The runtime signing API accepts an external signer adapter so a release environment need not expose its private key to application code. Tests use generated temporary keys; no existing user key or Runtime setting was changed.

See [DV3 work plan](../../specs/goalboard-architecture-reorganization/dv3-work-plan.md) and [architecture ownership](../../docs/SSOT-MATRIX.md).
