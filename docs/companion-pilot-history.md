# Solar Observatory local companion pilot

> Historical development notes preserved during Phase 1. Local paths, linked-library setup, runtime versions and independent-agent behavior below describe earlier work. For current setup use [Local service and MCP](../companion/README.md); the library is now bundled and Solar starts with `agent: false`.

## Workspace-agent migration

Solar now runs as an application-tools service without its own Codex runtime. Start `npm.cmd run application`, then register its MCP connection in vmblu Settings. The new contextual overlay uses vmblu's agent. Normal simulation controls remain independent. `companion` is a compatibility startup alias.

Simulation state, browser acknowledgements, MCP schemas, scenarios and candidate build/activation remain here. Sessions, model selection and runtime startup belong to vmblu. `.companion/connection.json` is a private local capability; do not publish it. One browser owns each service run; close/restart before transferring to a new tab. See `C:/dev/vmblu/docs/workspace-agent.md` for architecture and limitations.

Historical independent-agent setup notes below are superseded by this section. Shared legacy runtime/panel modules remain only for other consumers during migration.

One Windows command serves an accepted application build and starts one dedicated Codex app-server. The application panel can operate the simulation and request source changes. Codex owns the stdio MCP adapter; the companion owns the HTTP/WebSocket listener. VS Code need not remain open. Model inference is remote; source, tools and builds are local.

## Local library layout

The reusable implementation now lives in **C:/dev/companion**, a separate Git repository. This app links it through the private local dependency `@vizualmodel/companion` (`file:../../companion`). Nothing is published to npm. Run `npm.cmd install` in the library checkout first, then in this application.

- `config.ts`: application identity, repo/build commands, runtime instructions and linked source root.
- `tools.ts`: code-defined MCP schemas and acknowledgement validation.
- `client.ts`, `browser-adapter.ts`, `state.ts`, `simulation-protocol.ts`, `readiness.ts`: solar-specific commands, renderer readiness and complete scenario preservation.
- `server.ts`, `mcp.ts`, `doctor.ts`, `Panel.svelte`: small library entry points and application UI integration.

Conversation/build records stay in this application's `.companion` directory. Candidate validation now fingerprints both application and library source. Restart the backend after changing shared server code; activate a candidate for shared browser/panel code. See the library README for its contracts and counter example.

## Prerequisites and startup

Tested on Windows with Node **24.18.0**, Vite **7.3.6**, and Codex **0.155.0-alpha.16.3**, **0.160.1**, and **0.162.0-alpha.2**. The runtime version is checked against the tested versions in the library `src/runtime.ts`; another version leaves the simulation usable but disables the agent until its protocol is validated. An installed standalone Codex CLI on PATH is recommended. The tested executable was supplied by the installed VS Code extension; launching that executable does not require VS Code to remain open. The companion checks `CODEX_BIN`, then PATH, then the Windows VS Code OpenAI extension installation. `CODEX_BIN` can specify a full executable path (without surrounding quote characters in its value). This also applies to `companion:doctor`. A missing executable is separate from authentication; restarting after installing or updating Codex reruns discovery. Versions 0.160.1 and 0.162.0-alpha.2 were verified through initialization, account/config reads, thread creation and a real text turn; application operations remain covered by companion tests.

For 0.162.0-alpha.2, generated protocol types were compared with 0.160.1, including the companion's request/response types and their dependencies. The relevant change allows future string/object variants in `CodexErrorInfo`; the companion displays the error message without assuming a closed set of error codes. Startup and a completed streaming text turn were verified with the normal Windows account (the execution sandbox cannot see its credential store). Restart the companion after changing the tested-version list; the startup guard is loaded once per process.

In PowerShell:

```powershell
cd C:\dev\blu\solar-system
npm.cmd install
codex --version
codex login status
# Only if not authenticated:
codex login
npm.cmd run companion
```

Use the supported CLI login. The companion asks app-server for account status; it never reads/copies extension credentials, creates an API key, or silently changes billing routes. A sandbox may hide the Windows credential store even though a normal PowerShell login check succeeds.

The default address is **http://127.0.0.1:5180/**. Startup opens your normal browser; if opening fails, use the printed URL. `npm.cmd run companion -- --no-open` suppresses opening. `$env:COMPANION_PORT='5181'` selects another port; that changes browser storage origin. An occupied port or active workspace lock fails clearly without killing unrelated processes. Stop with **Ctrl+C**. The companion closes its owned runtime, MCP transport, sockets and build processes.

The companion claims one browser tab per run and retains its session-storage identity across reloads. A different tab is rejected even after the original disconnects. To transfer control, close the original and restart the companion. Ordinary simulation controls work if the agent fails. After a companion restart, the updated client obtains a fresh same-origin connection token and reconnects automatically. Older clients need a refresh.

## Storage and identity

- `companion/`: solar-specific library integration; small integration points are in App and Viewport.
- `.companion/workspace.json`: application identity, absolute checkout, unique working-copy identity, base revision, branch, content digest, active/previous/candidate build identities and Codex thread ID. A content digest includes tracked and nonignored untracked source, so dirty source is not mislabeled as the base commit.
- `.companion/builds/<id>/`: retained immutable build outputs, separate from edits and normal `dist/`.
- `.companion/companion.lock`: owner PID; a stale lock is reclaimed only if the owner process no longer exists.
- Codex's supported local storage: conversation history. The companion resumes by thread ID and reconstructs the panel from returned items; it does not persist another chat history.
- Browser local/session storage: ordinary save slot, reload receipt and browser claim. Reload preservation includes playback.
- Personal source edits: the current named development branch, initially `companion/local-pilot`. Builds refuse main/master. No automatic commit, push, PR or deployment.

`.companion` is ignored by Git and Vercel. Do not publish it. The random per-run local capability is injected into served HTML, never baked into static build files or printed. Privileged HTTP calls require it; browser sockets require the exact origin and capability. Services bind only to loopback. This is a single-user local pilot, not a hostile multi-user isolation boundary.

## Change and recovery workflow

Durable agent instructions are in `AGENTS.md`. Live tools reuse the existing browser request handler and command boundary. `get_simulation_state` returns an acknowledged date, playback status, view count and active workspace/build identity. Both date tools accept `detail: "full"` when all scenario settings and cameras are needed. Capture and restoration always use the complete state. Commands have correlated IDs/deadlines and are never queued for reconnection.

`build_candidate` runs Svelte checks and the test suite, then a companion-mode Vite build. This is the single full validation step: use focused tests during editing and avoid a duplicate preliminary production build unless checking a distinct production path. The existing Three.js bundle-size warning is advisory; it does not mean the build failed. A before/after content digest rejects concurrent edits. It does not change the served version. `activate_candidate` requires that validated digest, captures state immediately before switching, waits up to 25 seconds for renderer readiness, then up to 18 seconds for restoration acknowledgement. The version-1 envelope includes every scenario field. Unsupported versions, missing views or mismatched readback fail instead of silently resetting state.

On activation failure the previous accepted build is selected and restored. A small script injected by the companion detects a changed build even if application JavaScript cannot start; this allows a failed candidate page to return to the previous build. Source edits and candidate files remain available for repair. `rollback_build` explicitly returns to the prior accepted build while preserving current state. Build rollback does not roll back source.

If the companion exits mid-activation, its persisted transaction selects the prior build at next startup and restores the captured state after readiness. If recovery itself fails, the record retains that state and reports the failure; fix the runtime/browser problem and restart. Inspect `.companion/workspace.json`, the retained candidate directory, panel tool results and build output. Never use a Git reset as build recovery.

`verify_recovery` is an explicit acceptance-test tool: it briefly serves a deliberately unloadable candidate and verifies return to the prior build with state. It does not edit application source. Ask for this test only when ready for the roughly 25-second interruption.

The panel shows conversation text and concise activity summaries with expandable diagnostics. Structured MCP results appear once; large command output is capped at its last 16,000 characters. Initial connection and explicit resynchronization transfer history; subsequent notifications transfer revisioned item updates or text deltas. Older browser clients retain full-snapshot compatibility. This reduces local browser traffic, not the model context already stored in a conversation. The panel supports cancellation and new/resumed conversations, and presents command/file approval requests with a readable one-line summary and expandable technical details, plus **Allow once**, **Approve for session** (when supported), or **Decline**. Requests for arbitrary permission-profile expansion and MCP forms are shown but can only be declined in this pilot; the agent must use a supported path or report the limitation. Existing runtime policy is not replaced with blanket permission. Reconnecting displays the running turn; it never resubmits the last request.

## Windows diagnostics

Run `npm.cmd run companion:doctor` from your normal PowerShell account. It checks the installed runtime's Windows sandbox readiness, workspace metadata owners and matching recent sandbox setup failures. It does not start a model turn, read credentials, modify ACLs or disable approvals. The panel exposes the same diagnostic warning. Python is not a dependency; use Node.js for scripting.

On this checkout, diagnostics found `.git` and `.codex` owned by `ODYSSEUS\CodexSandboxOffline`, together with logged failures to update their deny ACLs. General sandbox readiness reported `ready`, so readiness alone does not prove this workspace can execute sandboxed edits. These are recorded failures and ownership evidence, not a fresh failing edit probe.

Use the supported [Windows sandbox setup](https://learn.chatgpt.com/docs/windows/windows-sandbox) from the normal Windows account. If setup still cannot update these two directories, an administrator should review and repair their ownership/access specifically. The companion deliberately does not take ownership, grant blanket access or bypass the sandbox. Runtime approval requests remain explicit.

## Verification and remaining acceptance tests

Automated tests cover RPC correlation, timeout/exit behavior, approval forwarding, browser ownership, no replay, complete state readback, activation/recovery failures, consecutive-turn session reset, revision ordering/resynchronization, incremental traffic, readable tool failures and compact/full observations. Use `build_candidate` for the full check/test/build workflow. Protocol types for the pinned executable were inspected; regenerate with `codex app-server generate-ts --out <temporary-directory>` when upgrading.

The user confirmed live date read/set/read through the real panel and successful implementation of the approved minus/plus one-day buttons. The transcript recorded candidate validation, activation and restored state. Those controls now exist; do not repeat the feature-addition request. Their tests verify 24-hour stepping, range clamping and preservation of playback/views.

Remaining manual acceptance checks:

1. Confirm readable activity summaries, expandable diagnostics and a second request after completion in the updated panel.
2. Refresh during a running turn and verify history/status return without replay. Stop/restart the companion and verify automatic reconnection to the same conversation.
3. Check visible date, playback, split views and camera positions after activation.
4. When ready for a roughly 25-second interruption, request `verify_recovery` to demonstrate a deliberately failed candidate returning to the previous application and captured state. This fault-injection acceptance check remains unverified.

The implementation session has no controllable browser, so automated checks and application acknowledgements do not constitute visual verification. The optional `node --import tsx companion/probe.ts` probe sends real model requests through a browser stand-in; run only against an unused companion, then restart to release its browser claim.

## Integration status

This is a pilot against a pinned alpha Codex executable. Official app-server documentation carries integration/production-support caveats and identifies its direct WebSocket transport as experimental. This companion uses **stdio** for app-server and owns its separate browser WebSocket protocol. Future runtime upgrades require protocol and real-turn verification.

References: [Codex app-server](https://learn.chatgpt.com/docs/app-server), [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp). No vmblu dependency, ChatGPT embedding, second coordinating agent, VS Code socket takeover, hosted deployment or automatic upstream contribution is included.


## Grouped application controls

See [MCP controls](../docs/mcp-controls.md) for the ten application tools (14 including development tools), structured camera/scene/timeline payloads, UI mapping, and recurring Windows sandbox diagnosis. Session approval uses the runtime’s scoped decision and does not bypass sandbox setup.


## Scenarios

[App-owned scenario prompts](../docs/scenarios.md) can run from the application dropdown while the panel is hidden. Simulation state is now named `SimulationState`; older saved sessions remain compatible.
