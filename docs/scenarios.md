# Scenarios and simulation state

**SimulationState** is the current date, playback, range, view layout, display settings and camera positions. **Scenario** is a named reusable prompt asking the research companion to prepare a scene using application tools.

The scenario selector has three independent icon controls:

- **View prompt** (text): read the selected prompt without executing it. Guided missions show their description and chapters.
- **Set up scenario** (rocket): submit the selected prompt to the connected research companion. The companion opens for progress, questions, approvals and cancellation. Guided missions prepare locally and retain their existing Play mission control.
- **Add scenario** (plus): enter a title and reusable prompt, then save it. The new scenario is selected immediately; saving never runs it.

Selecting a scenario alone does not execute it. Setup configures the scene; **Play** on the timeline starts simulation playback. Finish or cancel an active research request before submitting another. Submission success waits for the native conversation acknowledgement. Connection failures and timeouts are reported without automatic replay; check the conversation before trying again.

The app owns `scenarios/*.md`. Each file contains a single `# Title` followed by the task prompt. The running app reads the live catalogue and prompt text, including changes saved through MCP; static builds bundle a read-only fallback. Static builds can prepare guided missions but require the local application connection to save or submit agent prompts.

You can also edit/add Markdown files directly, or tell the research companion “Please save this as a scenario.” Distill successful instructions and corrections rather than storing the conversation or a state snapshot. Scenario setup submissions, including their title, are limited to the research companion's 16,000-character message limit.

The grouped `scenarios` MCP tool lists/gets prompts and saves `{title,prompt}`. To replace an existing file, first read its revision and supply `{id,expectedRevision,title,prompt}`. Existing files cannot be overwritten accidentally. IDs are validated slugs; redirected directories and symlink files are rejected. The owning browser acknowledges MCP saves and updates its dropdown immediately.

The reusable companion library provides `ScenarioRepository` (`list`, `get`, `save`) and correlated browser catalogue requests. The solar app owns persistence and the selector. Setup is sent through the embedded vmblu research companion using a parent/source/origin-checked message bridge, then the existing native conversation transport and tool permissions. No application-owned agent runtime is started.

## Compatibility

Existing raw version-1 simulation JSON files still import. Browser storage retains `solar-observatory.scenario.v1` to recover previous sessions. New code and tool payloads use `SimulationState` / `simulationState`; legacy `scenario` snapshot envelopes and session-import arguments are accepted. Older companion processes receive their original envelope shape during activation. The compatibility `src/lib/scenario.ts` module remains for older imports. New exports are named `solar-simulation-state.json`; the UI calls them simulation state.
