# Solar Observatory

Browser-based Solar System model built with Svelte 5, TypeScript and Three.js. It uses approximate Keplerian calculations derived from reference ephemeris data, not numerical N-body integration. The browser model and MCP service work without vmblu; the optional embedded conversation panel currently expects a separate vmblu workspace. See the [Phase 1 baseline](docs/phase1-baseline.md) for inventory, verification and remaining gaps.

## Run

Requires Node.js 22.12+ (developed with Node 24) and Git LFS for the bundled 8K star map. To clone:

```sh
git lfs install
git clone https://github.com/vizualmodel/solar-system.git
cd solar-system
git lfs pull
```

From this folder:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

```sh
npm run check
npm test
npm run build
npm run preview
```

## Deployment

For existing MCP controls, run `npm run application` and open http://127.0.0.1:5180/. See [Local service and MCP](companion/README.md). Its library is bundled in `packages/companion`; no sibling checkout or LLM login is required. The service serves an accepted build independently of source edits.

The application is hosted in the `solar-system` Vercel project under the `vizualmodel-projects` team. Its public address is https://solar-system-ashen-one.vercel.app. Use this address for the catalogue's live application link. Each blueprint can use its own Vercel project address without additional DNS setup.

The repository includes `vercel.json` for a Vite deployment using `npm ci`, `npm run build`, and the `dist` output directory. Connect `vizualmodel/solar-system` to its own Vercel project, with `main` as the production branch. Git-connected branches and pull requests can use preview deployments.

**Git LFS** was documented as enabled in the existing Vercel project; the live account setting was not independently checked in Phase 1. Enable it for deployments: `public/textures/sky/starmap_2020_8k.exr` must contain the actual star map, not an LFS pointer. Enable this setting when creating another deployment project for this repository.

If downloading the source as a ZIP instead of cloning with Git LFS, run `npm run sky-data` after extracting to restore the full star map before running the application.

## Current capabilities

- Sun, eight planets, twelve moons; local texture maps for the Sun, planets and Earth's Moon.
- Shared forward/reverse clock, adjustable start/end, date input, day stepping and fine scrubber. Model timestamps use UTC; the timeline also shows browser-local time including DST.
- Up to six recursive horizontal/vertical views. Removing a view promotes its sibling.
- Per-view body visibility, orbit paths, labels, stars, body enlargement and moon-distance scaling.
- Orbit/pan/zoom cameras, tracking or fixed origin, system/portrait/top-down presets.
- Physical distance chart, independent of presentation scales.
- Browser autosave every 15 seconds and on page exit; explicit Save and JSON import/export. Restored sessions are paused at their saved instant. New session exports the previous scenario first.
- `?preset=overview`, `?preset=inner`, or `?preset=earth` controls startup when no saved session exists.

Drag to orbit, right-drag to pan, scroll/pinch to zoom. Click a body label or use Camera settings to focus. Click inside a view to select which view the settings affect. Overlay panels can be toggled from the top-right menu.

## Architecture

### Next closest approach

Open **Distance charts** in the top toolbar, choose two different planets in the Distance explorer selectors, then click **Next closest approach**. The simulation jumps to the first future local minimum in physical separation and pauses there. Cameras, views, and layout are unchanged. Sun/moon selections and identical planets disable the button. If no event occurs before the selected TO date, the app explains this and leaves the simulation unchanged.

The search uses the same approximate orbital model as the simulation, scans distance slopes every six hours, and refines a minimum to about one second numerically. It skips the current event using a one-minute tolerance so successive clicks advance. These are model-derived minima, not independently verified astronomical predictions. The chart's existing 100-sample minimum is a separate coarse overview and may differ.

`src/lib/ephemeris.ts` is the pure physical model (AU, days, J2000 ecliptic). `catalog.ts` describes bodies. `simulation-state.ts` owns serializable configuration and validation; `scenario.ts` retains compatibility exports. `store.ts` manages the shared clock, persistence, layouts and the command boundary. `renderer.ts` owns each view's Three.js resources, floating origin, presentation scaling and camera controls. Svelte components own the UI. The rendering layer never feeds magnified positions back into physics.

`Command` / `command()` and the browser adapter expose validated operations through eleven application MCP tools plus four development tools. A ready browser and local Node service are required. See [MCP controls](docs/mcp-controls.md). Solar config sets `agent: false`; legacy Codex modules are preserved but no application-owned LLM starts. The Agent panel reports that VizualModel Bridge is not available yet. Manual operation requires no agent. Transport-independent model actions live in `src/model-integration`; the retired cloud relay is absent.

## Data and accuracy

Bundled data covers **1990-01-01 through 2031-01-01 UTC**. `npm run data` regenerates local data and textures and requires network access. The script queries [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) through the [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html). Original responses and their source ephemeris identifiers are retained in `public/data/*-source.txt`, but these files cover 2025-2031 and predate the historical extension. Raw responses for prepended historical samples were not retained; the extension records retrieval metadata and accepted elements. Most heliocentric planet responses use DE441; satellite models are identified in their individual responses.

Osculating elements are sampled every eight days for planets and daily for moons, in parent-relative J2000 ecliptic coordinates. We solve Kepler's equation at each bracketing epoch and smoothly blend the propagated Cartesian positions. This avoids position jumps at source boundaries, but is an approximation, not a numerical N-body integration or an exact Horizons reproduction. Orbital paths use the blended osculating model. Reference-ephemeris error analysis is intentionally deferred. Unit tests check mathematical invariants, dataset coverage, continuity and basic distance sanity, **not positional accuracy against reference ephemerides**.

Model timestamps are UTC; the timeline also presents browser-local time. UTC-to-TT conversion assumes TAI−UTC = 37 seconds across the supported interval, including historical dates when it differed. The small periodic TT-to-TDB correction and future leap-second changes are omitted. This needs revision for precision timing. Sun-centered geometric positions omit light-time effects. Axial rotation and pole orientation use approximate IAU models; eclipse shadows use geometric sphere/cone approximations rather than a validated prediction model. Saturn's illustrative rings follow its equatorial plane. Untextured moons use solid representative colors. Star directions use a fixed J2000 map; proper motion and stellar parallax are not modeled. Point markers keep subpixel bodies discoverable even at true size.

Planetary and moon radii are approximate mean radii used for rendering; dynamics use the downloaded elements. Display magnification does not alter physical distances. High playback rates can visually alias short-period moon orbits; reduce speed when inspecting them.

## Axial rotation

`rotation.ts` evaluates JPL/NAIF [pck00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) polynomial pole and prime-meridian terms for the Sun, eight planets and twelve moons. The original kernel is bundled, with extracted coefficients in `src/data/rotation.json`; regenerate with `npm run rotation-data`. Orientation is computed directly from simulation time, so all views, reverse playback, scrubbing and save/resume agree. Negative spin rates are retained for retrograde bodies. Saturn's rings lie in its rotating body's equatorial plane.

This is an approximate rigid-body model: periodic libration/nutation corrections, solar differential rotation and atmospheric winds are omitted. The Venus cloud texture follows the body rate, not atmospheric super-rotation. Map longitude registration is approximate and unverified. Solid-color moons have no surface features that reveal their rotation. Choose Camera ? Close-up and 1 hour / sec to inspect Earth's rotation; high playback rates can alias fast rotation.

## Asset attribution

The ten 2K equirectangular maps in `public/textures` are from [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/), distributed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Original texture files are unmodified; the application adds lighting, ring geometry and display scaling. Map gaps and color adjustments are described by the source. Attribution also appears in the app's About dialog.

## Star field and constellations

In **View settings → Display → Scene layers**, **Star field** and **Constellation lines** are independent switches for the selected view. Both persist with saved scenarios. Older scenarios retain their settings and start with constellation lines disabled.

The star field uses the **8192 ? 4096 OpenEXR** from [NASA SVS Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/), in J2000 equatorial coordinates. Gaia DR2 credit: ESA/Gaia/DPAC. The constellation figures retain the aligned [2012 SVS map](https://svs.gsfc.nasa.gov/3895/). Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio (Ernie Wright); constellation figures based on designs for the IAU by Alan MacRobert, Sky and Telescope (Roger Sinnott and Rick Fienberg). Figure lines represent conventional patterns, not official constellation boundaries.

Run `npm run sky-data` to restore the two bundled maps. URLs and credits are also recorded in `public/textures/sky/sources.json`. The 8K figure mask is resampled to 4K at runtime to bound per-view GPU memory. The star map stays at full 8K resolution, in linear half-float format. A near-black background, contrast curve with hue-preserving highlight compression, and mild bounded sharpening make the sky crisper without changing its coordinates. It is not downsampled to 4K or converted to JPEG. The roughly 125 MiB asset takes a few seconds to load and decode initially; simultaneous views share one decoded CPU texture. Each WebGL view still requires its own GPU copy (about 256 MiB for the star map).

`sky.ts` renders an independent background pass using camera orientation, without camera translation or depth writes. `sky-coordinates.ts` aligns equatorial maps with the simulation's ecliptic frame using J2000 obliquity. Planets are rendered afterward and occlude the sky. This replaces the original sparse, subpixel random points. Tests cover coordinate orientation, both independent switches and migration of old saved sessions.

## Earth satellite prototypes

Earth now has adaptive close-range geometry, sharper surface imagery, animated clouds with ground shadows, sunlight-driven atmospheric scattering, ocean reflections and night lights. Details load on approach and are shared across views. Weather and city lights are illustrative rather than date-specific. See [Earth rendering](docs/earth-rendering.md) for quality tiers, asset credits and validation.

Use the **ISS close-up — travel alongside the station** scenario to prepare a true-size camera about 300 m away that follows the station. Setup pauses at exactly real-time speed; press Play. Close-range views automatically load bundled NASA models; distant views retain the procedural silhouettes. Model credits, refresh steps and an optional Blender workflow are in [Satellite models](docs/satellite-models.md).

Open **View settings / Display / Satellites** and select Hubble or the International Space Station. Each camera icon follows its satellite for a close-up; use Scenarios for scene setup. The shared slider sets both satellites' magnification in the selected view, independently of body scale. Existing unequal values show “Mixed” until adjusted. Moon orbit spread never changes satellite distances. Every object has an information dialog with imagery, facts and reference links; see [Object information](docs/object-information.md). Mesh attitude is illustrative, not pointing telemetry.

The snapshots in `src/data/hubble.json` and `src/data/iss.json` come from [CelesTrak GP data](https://celestrak.org/NORAD/documentation/gp-data-formats.php), NORAD 20580 and 25544, and are propagated with [satellite.js / SGP4](https://github.com/shashwatak/satellite-js). Satellites are visible from Hubble deployment on 25 April 1990 and the first ISS module launch on 20 November 1998. SGP4 is used within three days of each snapshot; outside that window a two-body orbit anchored at the boundary preserves continuous motion without extrapolating atmospheric drag for decades. These historical and future positions are illustrative. TEME positions are converted through GMST and our IAU Earth orientation, omitting polar motion and nutation. Current orbital elements do not supply accurate historical or multi-year future satellite trajectories.

Run `npm run satellite-data` to refresh both bundled snapshots, then build and activate a candidate through the companion. The browser runs from the snapshots without polling an external service. Hubble's procedural mesh uses [NASA spacecraft dimensions](https://science.nasa.gov/mission/hubble/observatory/design/) and [solar-array dimensions](https://science.nasa.gov/mission/hubble/observatory/design/electrical-power/). The ISS silhouette includes a truss, module cluster, radiators and eight large solar-array wings, approximately [109 by 73 metres](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/).

## Additional current features

Earth surface/alignment observers, telescope controls, illustrative local landscape and geometric lunar umbra/penumbra views are implemented. See [local landscape](docs/local-landscape.md). Cached satellite population filters and object cards are documented in [satellite populations](docs/satellite-populations.md).

The [Apollo 11 educational mission](docs/mission-scenarios.md) has an independent timeline, split views, dashboard and opt-in archival audio. Its separate 1969 context uses hourly Horizons vectors with Hermite interpolation and no extrapolation. Spacecraft paths, staging, attitudes and telemetry are authored illustrations, not flight solutions or navigation data. Deterministic mission playback works without an agent. Markdown scenario prompts require the optional workspace integration for execution and are separate from saved simulation state.

## Licensing and operational limits

No top-level source-code license has been selected. Owner permission to include the companion source does not establish an open-source license. NASA distribution is not a blanket license for all third-party material; source-specific rights review remains open. ISS/Hubble and Apollo model credits, transformations and media references are retained in the feature documents. Apollo audio credits are in `public/audio/apollo-11/credits.json`; object-image provenance is in `src/data/object-images.json`. The bundled Draco decoder retains its Apache 2.0 license in `public/models/draco/LICENSE.txt`.

Static hosting serves the browser app only; it does not run the local Node/MCP bridge or workspace agent. Include dev dependencies during Vercel installation, since Vite and companion imports are build requirements. Large JavaScript chunks and per-view GPU memory remain operational costs. `.companion`, `.env*`, `.codex`, caches and generated builds must remain private and untracked.

## Future work

Numerical N-body dynamics, quantified ephemeris validation, new blueprint distribution, ChatGPT integration and generic composition remain future work. Phase 1 does not implement them.
