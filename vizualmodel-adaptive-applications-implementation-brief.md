# Vizualmodel: local companion pilot

**Implementation brief for VS Code Codex — revised 30 September 2026**\
**Application:** `vizualmodel/solar-system`\
**Existing hosted version:** https://solar-system-ashen-one.vercel.app/

## 1. Objective and decision

Prove a simple proposition: **the user can ask an agent inside an application to use it and add a missing feature, then continue using the changed application.**

Build one coherent local workspace for this experiment. A small companion program starts the browser application and a dedicated Codex agent session. That session has both the application's live tools and its source/build environment. The user talks to it through a panel inside the application.

This replaces the earlier plan to discover and coordinate whichever agents, credentials, and development environments happen to be available. For the pilot, choose one application and one runtime explicitly. Establish the complete experience before adding adaptive provider selection.

## 2. Scope of the implementation

Implement the companion pilot in the current solar-system repository, but keep it in a separate folder. Deliver it in two sequential checkpoints:

1. **Operate:** Start everything with one command and use the embedded panel to read and change live simulation state.
2. **Modify:** From that same panel and agent session, request a small missing feature, edit source, validate it, activate the changed application, and restore simulation state.

Both checkpoints are part of this task. Complete the first before implementing the second, so connection problems can be isolated. A chat panel that only exchanges text is not a completed pilot.

Use an existing local checkout and installed development tools initially. A terminal startup command is sufficient. An installer, tray icon, automatic repository download, and support for arbitrary blueprints are outside this task.

## 3. What already works

The user has successfully tested:

- Companion-owned MCP tools and a browser connection that read simulation state and control time.
- Development of the next closest approach feature through Codex.
- Preservation of date, cameras, and views during a development reload.

Inspect and reuse these implementations. Do not assume the repository still matches an earlier conversation or patch.

The embedded panel and companion-managed agent session have not yet been demonstrated. Neither has a reliable full change/activation/recovery loop from that panel.

An earlier ChatGPT MCP App prototype was prepared but not confirmed applied or validated. It is not a dependency of this pilot. The application runs in the user's ordinary browser, not inside ChatGPT. Do not introduce a vmblu dependency.

## 4. Components and responsibilities

| Component | Responsibility |
|---|---|
| Browser application | Own simulation state, render the scene, provide ordinary controls and the embedded agent panel. |
| Local companion | Manage startup/shutdown, browser connection, workspace identity, and controlled build/activation/recovery operations. |
| Codex app-server | Maintain one agent conversation, coordinate model calls and tools, and emit progress and approval events. |
| Companion application tools | Expose live application operations to that Codex session through MCP. |
| Local working copy | Hold matching source, dependencies, personal edits, and build outputs. |

The companion is ordinary software, not another LLM. Do not add a second agent to coordinate the first.

The model's inference runs remotely. Codex's runtime, application tool execution, source editing, and builds run locally in the selected workspace. This is not an offline solution.

VS Code is the tool used to implement and inspect the pilot. It must not be required to stay open to use the resulting companion. Do not attempt to attach to an undocumented socket or take over an existing VS Code agent conversation.

## 5. Agent runtime and connections

Use **Codex app-server** as the integration candidate. It has a documented interface for embedding Codex into a product, including conversation, streamed events, and approvals. Verify the installed Codex version and current official interfaces before coding against them. Generate version-matched protocol types if useful. [1]

The companion should launch `codex app-server` as a child process and communicate using its default **stdio** transport. Implement the initialization handshake, thread start/resume, turn submission, event streaming, cancellation, errors, and any approval requests needed by the selected version.

The app-server documentation currently identifies its direct WebSocket transport as experimental/unsupported and includes a production-support caveat. Treat this as a pilot integration, pin the tested version, and document the limitation. Do not make the browser directly depend on that experimental transport. [1]

For browser-to-companion communication, use the smallest appropriate local HTTP/WebSocket interface owned by the companion. Prefer a stable browser origin and same-origin routing where practical. Keep agent protocol details behind the companion.

Configure this dedicated Codex session to use the companion application MCP tools. MCP and app-server serve different roles: MCP exposes application tools; app-server connects our panel to the agent conversation. Reuse the application command/state implementation and companion authentication. [2]

Give processes a single clear owner: the companion owns app-server and the local app server; if Codex starts the MCP stdio adapter, let Codex own that process. Do not start duplicate application listeners. Detect an occupied port and report the conflict without terminating unrelated processes.

Verify and document a working authentication route for the installed runtime. Use supported Codex authentication mechanisms; do not copy credentials from the VS Code extension or expose them to the browser. Missing authentication should produce actionable setup instructions, not silent fallback to another billing route. A real successful turn is required to establish connectivity.

## 6. Startup, workspace, and UI

After documented prerequisites and initial authentication, provide one command, for example `npm run companion` (choose the actual name during implementation), that:

1. Checks the selected workspace and required tools.
2. Starts the companion, local application server, and Codex runtime in a defined order.
3. Configures the application tools for that session and verifies readiness.
4. Opens the local application, or prints a usable local URL if browser opening fails.

Target the user's Windows environment; document PowerShell-compatible commands. If tested elsewhere, state that explicitly. On shutdown, clean up owned processes. A failed agent connection must not prevent ordinary simulation use.

Persist a small workspace record with application/repository identity, base source revision, working-copy identity, active build identity, and Codex thread ID. A dirty working copy needs an identity beyond its base commit; do not label it as an unchanged upstream revision.

Keep conversation history in Codex's supported storage and resume via its documented interface. Persist workspace/thread mapping outside the frontend build so reloading a changed app does not lose the agent session. Do not implement a second conversation-history engine unless required.

The panel needs only:

- Message history and input.
- Connection and task status.
- Streamed responses and understandable tool/build results.
- Cancel and required runtime approval controls.
- A way to start a new conversation or resume the workspace conversation.

Keep the panel visually consistent with the existing app and collapsible. Reconnection should recover a running turn's status where possible; it must not resubmit a feature request automatically. Scope the pilot to one controlled browser instance and make that constraint explicit rather than sending commands to whichever tab responds first.

## 7. Live tools and source access

Use structured tools for simulation observations and commands. Reuse existing date/state operations rather than introducing broad new controls. Tool results must reflect acknowledged application state, with correlated requests, timeouts, and useful failures.

The Codex session's working directory must be the selected source checkout. It should be able to inspect relevant files, edit them, and run project checks through its normal permitted development tools.

Provide durable repository instructions describing application tools, build commands, state-preservation requirements, and the activation workflow. Future feature requests should not need this entire brief pasted into every conversation.

Do not send the entire repository with every message. The local runtime can inspect source as needed. Verify that the running app corresponds to the selected workspace/build before modifying it.

## 8. Controlled change and activation loop

The critical workflow is:

1. Agent checks whether the requested function already exists and inspects relevant source.
2. Agent implements the requested feature in the local working copy.
3. Run the checks appropriate to that change and build a candidate version.
4. Capture the current simulation state immediately before activation.
5. Activate the candidate version through a companion-owned operation.
6. Reconnect the app, restore compatible state, and verify readiness and restored values.
7. Report the result in the same panel; retain a way to return to the previous working build.

Expose build/activation operations as defined tools available to the agent, using the smallest integration consistent with the companion application tools. The companion should execute project-configured operations; the browser must not become an arbitrary shell-command endpoint.

Separate source editing from the served version so automatic development reload does not activate incomplete edits before validation. Choose the smallest reliable approach, such as serving an accepted build from a stable local origin and building candidates separately. Reuse existing state capture/restore code; adapt it only where required.

State should cover the existing date, playback state, scenario, camera/view, and other settings already supported by reload preservation. Record a state schema version. Do not silently reset unsupported state and call restoration successful.

Activation must wait for explicit app readiness and a restoration acknowledgement, with bounded timeouts. If a candidate cannot load or restore state, keep or reactivate the previous build and explain what failed. Retain both the prior build and the source edits so the agent can fix the candidate. Do not erase edits, reset Git, or overwrite existing user work as a recovery technique.

Store personal development changes on a clearly identified branch or isolated working copy. Do not automatically push, open PRs, or update upstream main. Build rollback and source rollback are different operations; the pilot's recovery must at least restore a usable served build.

## 9. Acceptance criteria

### Checkpoint A: application control

- One documented command starts the system after prerequisite setup.
- VS Code can be closed while the pilot runs.
- From the panel, “What date is the simulation showing?” produces a live tool-backed answer.
- Asking for a specific valid date changes the visible simulation and agrees with a fresh state read.
- Closing/reopening the panel and refreshing the app preserve the intended workspace conversation and simulation state.
- Disconnection or runtime failure produces a clear status; ordinary app controls continue working.

### Checkpoint B: feature modification

Choose one small feature confirmed absent in the current repository. Agree its observable behavior before the test. For example, a useful preset or comparison control could qualify, but do not recreate the already implemented closest-approach feature.

- Submit the request through the embedded panel to the same agent session used for application control.
- The runtime edits real source and performs appropriate validation.
- The changed application loads and the requested behavior can be demonstrated.
- Date, cameras/views, and other captured state survive activation, verified by state readback and visual inspection.
- The panel reconnects to the same conversation and reports the completed result.
- Demonstrate recovery from a failed candidate load or restoration without destructive Git operations.

Mocks can support development, but they do not prove either checkpoint. If runtime credentials or a user-browser step prevent an end-to-end test, deliver the working implementation and precise remaining test steps, and label that checkpoint unverified.

## 10. Implementation and handoff

Inspect the current repository and relevant project instructions first. State the smallest design, then implement Checkpoint A and validate it before proceeding to B. Do not stop at a plan or a UI mockup.

Use meaningful automated tests for request correlation, lifecycle/error handling, activation, and restoration where practical. Run existing project checks. Include a short real-runtime manual test procedure; avoid exhaustive tests that merely mirror UI markup.

Document:

- Prerequisites, tested versions, authentication, startup, and shutdown.
- Where workspace records, conversations, builds, and personal edits live.
- How to recover the previous build and inspect a failed candidate.
- The real-runtime/browser tests performed and anything still unverified.

Do not modify unrelated user configuration, publish changes, or deploy to Vercel as part of this task. Keep credentials out of frontend assets and logs. Bind local services to loopback, validate browser origins, and authenticate privileged requests using the existing mechanisms or an appropriate extension. Preserve runtime approval semantics rather than granting blanket access for convenience.

## 11. Deferred work

After the complete pilot works, consider packaging as an installed companion, easier startup, repository acquisition, multiple application workspaces, API-backed providers, hosted-app connections, and authorized GitHub contributions.

Continuity with the user's main ChatGPT projects or other agent interfaces remains an open integration question. This pilot owns a dedicated Codex thread and makes no promise of automatic access to ChatGPT history or memory.

An independent enforcer remains a future idea. It is not required to test the core workflow. Installer/tray UI, universal environment discovery, remote development, and ChatGPT MCP App embedding are also deferred.

## 12. Official references

Verify these against the installed runtime during implementation. The companion architecture and acceptance criteria above are project decisions, not existing OpenAI product features.

1. **Codex app-server:** https://learn.chatgpt.com/docs/app-server — integration protocol, stdio, initialization, threads, events, approvals, and experimental transport caveats.
2. **Codex MCP integration:** https://learn.chatgpt.com/docs/extend/mcp — local process and HTTP tool-server configuration.
