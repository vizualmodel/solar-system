# Solar Observatory architecture — vmblu3 source review

> Historical source review. Referenced vmblu architecture-editor files/tools are not required model runtime resources and are not bundled in this baseline. Current source inventory and limitations are in [Phase 1 baseline](phase1-baseline.md).

The root `solar-system.blu` opens the current software model in the vmblu3 editor. Its semantic blueprint is `.vmblu/solar-system.blu.json`; presentation is `.vmblu/solar-system.viz.json`. Both use the local `0.1.0-draft` definitions. This review was authored on 14 October 2026 from the working files on `companion/local-pilot`, including existing uncommitted changes. It describes the working tree rather than claiming correspondence to the last Git commit or the currently accepted companion build.

The model contains 7 actors, 33 components, 76 interactions, 10 architectural walkthroughs and 9 initial graphics views. Names and descriptions are authored explanations grounded in the inspected implementation. `status: existing` means source-observed behavior, not independent verification. All identifiers are stable architectural identities; display teams and routes are presentation only.

## What the model explains

- **Application UI:** entry/App composition, timeline, keyed recursive view tree, per-view lifecycle, settings/satellites, distance charts, prompt picker and companion panel.
- **Application state:** saved `SimulationState`, state validation/default/layout helpers and separate transient workspace/section stores. The store owns shared time, playback, views, layout and active id; the view renderer does not own a competing simulation clock.
- **Simulation services:** Kepler-based blended planet/moon positions, SGP4 satellite propagation and validity windows, timestamp-derived body rotation and numerical closest-approach search.
- **View rendering:** a separate scene/camera/WebGL renderer for each mounted Viewport, display-only coordinate/scaling helpers, mounted telescope controls, shared sky-texture caching, orbit vertices and shadow/mesh helpers.
- **Companion integration:** solar Node/MCP configuration, shared-client adaptation, expiring strict requests, pure reduction and explicit commit, renderer readiness, schema-1 state capture/restoration and versioned Markdown prompt persistence. The reusable library is an external participant, not an invented import between blueprints.
- **Data maintenance:** developer-invoked fetch scripts versus locally served bundled assets. The running browser does not continuously download live Horizons/CelesTrak data.

The walkthroughs cover opening the app, splitting a view and the six-view alternative, shared time/playback, camera interaction, closest-approach success/no-result, an agent timeline day step and reusable-prompt setup. They explain the source; viewing them in vmblu3 does not execute the simulation, agent, prompt or branch conditions.

## Source-specific details that matter

`store.split()` clones the selected **ViewConfig**, gives it a new UUID, appends it, updates the recursive Layout and makes it active. The keyed Svelte leaf then mounts a Viewport, whose constructor creates its own `SolarRenderer`, scene and camera. There is no copied scene-list API and no pair of camera/renderer factories to invent. Views share time and physical positions while graphics and view settings remain independent.

State propagation is explicit. Svelte `$simulationState` observation and derived/prop updates connect the store, App calculations and view tree. RAF clock callbacks advance time only while playing; separate viewport RAF callbacks continue drawing while paused. Callback delivery and subscriber/render order are not replaced with an invented synchronous total order.

The model distinguishes UI pathways. Time/play/speed generally use `command()`, which clones and validates. `Settings` uses `updateView`, range edits use guarded updates, and some other controls mutate stores directly. The complete source does **not** support the claim that every human UI change passes one centralized validator. The companion path does strictly parse/reduce/validate before commit, and session persistence must succeed before its state is committed.

Physical positions and chart distances remain distinct from Y-up display transforms, body magnification and moon orbit spread. The scientific code has approximations: blended Kepler states, fixed UTC/TT offset, polynomial rotation, an approximate TEME conversion and satellite epoch windows. A successful model validation or data load does not establish positional or eclipse accuracy.

The application's `scenarios/*.md` are reusable **agent task prompts**. Selecting one does nothing; Setup requests an ordinary Codex turn through the existing companion, with approval/cancellation rules. It is separate from saved SimulationState and from the vmblu3 architectural walkthrough registry. Setup does not automatically start playback.

The current `AGENTS.md` says dedicated −1/+1-day timeline buttons were accepted. The inspected `src/components/Timeline.svelte` has date/scrub/start/play/end/speed/range controls, but no such dedicated button handlers. The grouped companion `timeline` reducer does support `stepSeconds`, including ±86400. The model therefore explains the real tool day-step and does not invent absent UI buttons. This is a documentation/source discrepancy, not a change made during modelling.

## Review and verification limits

The model's `source-review/snapshot` extension inventories SHA-256 hashes of 57 source-hint paths, including data and prompt dependencies. Detailed inspection focused on the runtime paths above; hashing a file is not evidence that every line or scientific value was independently validated. Source hints are locators, not checker findings.

No `.prf.json` was fabricated or copied from the editor fixtures. There is no production implementation checker here. No live simulation time, accepted build identity, GPU rendering result, agent task outcome or security guarantee was inferred from source defaults. The available session has no callable `solar_companion.get_simulation_state` tool, so this exercise remains a static working-tree review. The linked companion's platform permissions and external scientific data remain explicit boundaries and limitations.

Blueprint/visualisation/descriptor validity is checked using vmblu3's real local schemas and semantic-reference/graph validator. Editor inspection is checked separately by loading these actual artifacts. These are model/editor checks, not an assertion that the solar application has passed all implementation tests. Application source, existing edits, scenarios, data and accepted companion builds were preserved; no solar app server was started, no candidate was activated and no changes were published.

## Open it

In VS Code, run **vmblu3: Open architecture** and choose `C:/dev/blu/solar-system/solar-system.blu`. Source hints are relative to this workspace and can open the existing files/symbols through the extension host.

In the browser editor, use **Open folder** for this project and select `solar-system.blu` from the entries. Alternatively select the two JSON artifacts together with **Open files**; same-basename loading associates their layouts. Browser source navigation remains a readable-locator fallback.

Start with **Solar Observatory — software overview**, then expand the relevant group or inspect a composite interaction's refinement. The pre-authored focused views and walkthroughs retain the same semantic identities. Some views are deliberately partial; an absent diagram occurrence does not mean the software entity is absent.
