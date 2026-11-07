# Bundled companion source

Snapshot of the local `@vizualmodel/companion` 0.0.0 library from `C:/dev/companion`, included with the owner's explicit permission for the Phase 1 baseline on 7 November 2026. The original checkout is unchanged. This is a private npm package installed through `file:packages/companion`; it is not published to npm.

`src/` preserves the existing service, browser transport, MCP adapter, state-preserving activation, diagnostics and legacy agent modules. Solar config sets `agent: false`; legacy Codex runtime modules are retained for compatibility and tests, not started by Solar. `tests/` and the counter example preserve the library's validation resources.

From the Solar repository root, run `npm ci`, then `npm --prefix packages/companion run check` and `npm --prefix packages/companion test`. The example is development-only. No source license has yet been selected; inclusion permission is not a general redistribution license.
