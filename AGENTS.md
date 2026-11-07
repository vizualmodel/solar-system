# Solar Observatory companion workspace

`npm.cmd run application` starts this application's tool/state service without an application-owned LLM runtime. Its optional contextual overlay currently uses vmblu; MCP controls, browser ownership and build activation remain here and work without that overlay. Preserve normal simulation operation when the agent is offline. See `companion/README.md` for current setup and boundaries.

This repository includes the companion library in `packages/companion` through a local `@vizualmodel/companion` dependency. Its source was included with explicit owner permission in Phase 1. `companion/` contains solar-specific configuration, tool definitions, state/browser adapters and small launch/UI entry points. See `packages/companion/README.md` for provenance and validation. The source checkout and accepted browser build are deliberately separate.

## Development environment

- Windows PowerShell, Node.js and `npm.cmd` are available. Python is not a prerequisite; use Node for a scripting fallback rather than assuming `python` exists.
- Prefer the normal patch tool. If a sandbox helper fails during setup, report the actual error and preserve runtime approvals. Do not repeatedly retry a failing helper, disable the sandbox, or change ownership/ACLs automatically. `npm.cmd run companion:doctor` provides read-only workspace diagnostics.
- Use `rg --files` and existing imports to find files. Use targeted reads/searches; avoid guessing filenames and dumping whole documentation or minified CSS into the conversation.
- Use explicit UTF-8 for PowerShell file reads/writes. Check `$LASTEXITCODE` after external commands before continuing dependent steps; a failed Python/Node command must not silently fall through to the next edit.

## Live application

- Use `solar_companion.get_simulation_state` for live observations; its default summary covers date, playback and workspace/build identity. Request `detail: "full"` only to inspect all simulation-state settings/cameras. Never infer the displayed date from system time or source defaults.
- Use `solar_companion.set_simulation_time` with an ISO timestamp and timezone. The existing command boundary validates the supported/current interval and preserves playback.
- Existing UI controls are exposed through `timeline`, `camera`, `scene`, `satellites`, `views`, `session`, `workspace` and `charts`; use their structured settings payloads before browser automation or source changes. See `docs/mcp-controls.md`. Implement source changes only for missing capabilities.
- Tool results require browser acknowledgement. On timeout, read fresh state before retrying. Never silently replay a feature request or operation.
- Verify workspace/build identity from a state read before source work. One browser owns each companion run.

## Feature development

1. Inspect source and confirm the feature is absent. Agree observable behavior when not already specified.
2. Preserve existing work. Use a named personal branch or isolated checkout, never main/master. Do not reset Git, remove edits, push, deploy, or publish.
3. Implement in this checkout with normal permitted tools. Do not start another app server or coordinating agent.
4. Add meaningful tests for changed behavior. Run focused tests while developing as needed.
5. For shared library edits, run its check/tests first; sourceRoots includes the library so candidate identity covers bundled source too. Call `solar_companion.build_candidate` once the change is ready. It already runs the full Svelte check, test suite and companion build. Do not duplicate these or run a preliminary `npm.cmd run build` unless investigating a failure or validating a separate production-only change. Do not overwrite `.companion` records/builds manually.
6. Call `solar_companion.activate_candidate`. Only this companion-owned operation captures state, switches the served build, waits for readiness, restores state, and verifies acknowledgement. Automatic development reload is not activation.
7. Read the live state again and report results in the current conversation. If activation fails, preserve source edits, inspect the error, fix and build again. `rollback_build` restores the previous served build without rolling back source.

Preserve every simulation-state field: date, playback, speed, range, name, view configuration, camera/target, layout and active view. State envelopes carry schema version 1; unsupported schemas must fail explicitly. Never call a silent reset a successful restoration.

## Pilot acceptance feature

The user approved and successfully tested “−1 day” and “+1 day” timeline buttons through the embedded panel. They now exist; do not recreate them. Each moves exactly 24 hours, clamps to the current FROM/TO range, and preserves playback and views. Recovery from a deliberately failed candidate is a separate acceptance check.

## Reusable scenario prompts

Scenarios are Markdown task prompts owned by this app under `scenarios/`; SimulationState is the saved scene. Use the `scenarios` MCP tool to save a distilled tested prompt when the user requests it, and preserve browser/runtime approval checks. See `docs/scenarios.md`.
