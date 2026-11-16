> Current connection: all model agent controls use VizualModel Bridge. Local MCP is developer tooling supplied by the runtime-free model service. Historical wire names and .companion storage are retained for compatibility.

# Solar Observatory MCP controls

The runtime-free model service exposes eleven application tools and four development tools (15 total). Bridge exposes those eleven application controls plus four browser convenience tools; it does not expose developer build/activation tools. Existing controls use the acknowledged browser command boundary. `detail: "full"` returns simulation state, all view IDs, workspace panels, chart selection and expanded sections. Requests expire and validate before mutation. Developer operations require the owning browser to acknowledge the current build. On timeout, read fresh state; do not silently replay the command.

| Tool | UI interactions / payload |
| --- | --- |
| `get_simulation_state` | Read date, playback, view count, build/workspace identity; full settings on demand. |
| `set_simulation_time` | ISO timestamp with explicit timezone. Compatibility tool. |
| `timeline` | `settings`: time, playing, speed (days/real second), start/end, stepSeconds, jump=start/end, resetRange. Covers scrubbing, day steps and playback. |
| `camera` | Optional viewId; `settings`: focus, preset=system/portrait/top/inclined, follow, camera/target vectors, mode=orbit/alignment/surface, observer={latitude,longitude,altitude}. Covers orbit/zoom/pan through position/target rather than pointer gestures. AU, Y-up; positions are relative to focus when tracking, Sun-relative otherwise. Observer altitude is metres. Surface/alignment enforce Earth tracking and true physical scale. |
| `scene` | Optional viewId; `settings`: visible body IDs, orbits, labels, stars, constellations, localLandscape, moonUmbra, moonPenumbra, size, moonScale. Local landscape defaults on for surface observers and has no effect in orbital views. |
| `satellites` | Optional viewId; `settings`: visible ISS/Hubble IDs, magnification={iss,hubble}, explore data epoch, focus, closeUp=iss (true-size tracking, real-time speed, paused). Unavailable focus is rejected. |
| `views` | action=select/split/close/layout; optional viewId, direction=row/column or validated recursive layout. Side by side=row. Six-view maximum; final view cannot close. |
| `session` | action=rename/save/export/import/new/preset; name, simulationState or preset=overview/earth/inner/spain-eclipse. Import accepts JSON and pauses, export returns JSON instead of a file chooser/download. New returns previousSimulationState as a backup and saves the new session. Legacy scenario import argument remains accepted. |
| `scenarios` | action=list/get/save; id, title, prompt, expectedRevision. Model-owned reusable task prompts. See [Scenarios](scenarios.md). Saving updates the dropdown; setup uses the app UI and its ready Bridge conversation. |
| `workspace` | `settings`: settings/charts/companion/about panel visibility, tab=scene/camera, sections={satellites,eclipse,layers,scale,bodies,interest,perspective}. The legacy companion key remains for compatibility. |
| `charts` | `settings`: from/to body IDs, open, nextClosestApproach. Search uses the current simulation range, pauses at the result, and fails explicitly if no next event exists. |

Examples:

```json
{"viewId":"primary","settings":{"mode":"surface","observer":{"latitude":43.3619,"longitude":-5.8494,"altitude":232}}}
```

```json
{"settings":{"start":"2026-08-12T00:00:00Z","end":"2026-08-13T00:00:00Z","time":"2026-08-12T17:31:37.472Z","playing":false}}
```

```json
{"action":"preset","preset":"spain-eclipse"}
```

Panel navigation is separate from saved simulation scenarios. `workspace` cannot approve Codex actions, grant permissions, or transfer browser ownership. Companion conversation/approval controls remain user-owned. Links to external data sources and browser file dialogs are represented by their semantic data operations, not automated clicks.

Shared development-server changes require a backend restart. To update an accepted development view, use `build_candidate` and `activate_candidate`; activation preserves full simulation state and requires browser acknowledgement. Static/hosted builds use their normal reviewed release workflow. Package changes require exact dependency/lockfile updates.

## Recurring Windows sandbox setup error

On 2026-10-08, ordinary command execution again failed with `helper_unknown_error: setup refresh had errors`. `companion:doctor` reports recorded deny-ACL update failures for workspace `.git`/`.codex`, owned by `ODYSSEUS\CodexSandboxOffline`. Global readiness=`ready` does not prove this workspace works. This evidence suggests a protection-rule/permissions setup problem; it is not a solar rendering failure.

Use Codex's [supported Windows sandbox setup and troubleshooting](https://learn.chatgpt.com/docs/windows/windows-sandbox) from the normal Windows account: restart Codex and retry administrator-approved elevated sandbox setup. If it still cannot update these directories, have an administrator review their ownership and ACLs specifically, with the sandbox log. Do not disable sandbox protections or grant blanket access. The companion does not alter ownership/ACLs automatically. Session approval reduces prompts within Codex's supported scope; it does not repair a failing sandbox.
