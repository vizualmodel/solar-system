# Scenarios and simulation state

**SimulationState** is the current date, playback, range, view layout, display settings and camera positions. A **scenario** is a named reusable prompt asking the model's Bridge agent to prepare a scene using its declared tools.

The scenario selector has three independent icon controls:

- **View prompt** (text): read the selected prompt without executing it. Guided missions show their description and chapters.
- **Set up scenario** (rocket): send the selected prompt through the model's already connected, ready Bridge conversation. The same Agent panel opens for progress and cancellation; action approvals appear in Bridge. Guided missions prepare locally and retain their existing Play mission control.
- **Add scenario** (plus): enter a title and reusable prompt, then save it. The new scenario is selected immediately. Saving requires no agent and never runs the prompt.

Selecting a scenario alone does not execute it. Setup configures the scene; **Play** on the timeline starts simulation playback. Finish or cancel an active agent request before submitting another. Successful submission means the prompt was sent, not that scene preparation has finished. Connection failures are reported without automatic replay; inspect the conversation before retrying an uncertain submission.

The model owns bundled `scenarios/*.md`. Each file contains a single `# Title` followed by the task prompt. Hosted/static builds and normal Vite development combine these with user prompts saved in this browser under `solar.scenario-prompts.v1`. They can save prompts with Bridge disconnected. Development-service builds use the live file catalogue and acknowledged saves; a disconnected service reports an error rather than claiming a browser-only save succeeded.

You can edit/add Markdown files directly, or ask the Bridge agent to save a distilled, tested scenario through the `scenarios` tool. Avoid storing a conversation or state snapshot as a prompt. Saving does not authorize later execution. Scenario setup submissions, including their title, are bounded by the Bridge conversation message limit.

The grouped `scenarios` tool lists/gets prompts and saves `{title,prompt}`. To replace an existing prompt, first read its revision and supply `{id,expectedRevision,title,prompt}`. IDs are validated slugs and stale replacements fail. The file repository also rejects redirected directories and symlink files. The owning browser acknowledges developer MCP saves and updates its selector.

Shared `@vizualmodel/model-development/scenarios` supplies validation and repository operations; Solar owns persistence and UI. All inference goes through `@vizualmodel/bridge-model-client` and desktop Bridge. There is no embedded Workspace agent, model-owned runtime or parent-window prompt handoff.

## Compatibility

Existing raw version-1 simulation JSON files still import. Browser storage retains `solar-observatory.scenario.v1` for simulation-state recovery; it is separate from saved scenario prompts. New code and tool payloads use `SimulationState` / `simulationState`; legacy `scenario` snapshot envelopes and session-import arguments remain accepted. Existing `.companion` development records and wire names remain compatible. The `src/lib/scenario.ts` module remains for older imports. Exports are named `solar-simulation-state.json`.
