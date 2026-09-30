# Solar Observatory

Browser-based solar system simulation built with Svelte 5, TypeScript and Three.js. No vmblu dependency or workflow.

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
npm install
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

The repository includes `vercel.json` for a Vite deployment using `npm ci`, `npm run build`, and the `dist` output directory. Connect `vizualmodel/solar-system` to its own Vercel project, with `main` as the production branch. Git-connected branches and pull requests can use preview deployments.

Enable **Git LFS** in the Vercel project's Git settings before deploying: `public/textures/sky/starmap_2020_8k.exr` must contain the actual star map, not an LFS pointer. The intended production domain is `solar-system.vizualmodel.ai`; add it to the project and use the DNS record Vercel provides.

If downloading the source as a ZIP instead of cloning with Git LFS, run `npm run sky-data` after extracting to restore the full star map before running the application.

## First milestone

- Sun, eight planets, twelve moons; local texture maps for the Sun, planets and Earth's Moon.
- Shared forward/reverse clock, adjustable start/end, date input and scrubber (UTC).
- Up to six recursive horizontal/vertical views. Removing a view promotes its sibling.
- Per-view body visibility, orbit paths, labels, stars, body enlargement and moon-distance scaling.
- Orbit/pan/zoom cameras, tracking or fixed origin, system/portrait/top-down presets.
- Physical distance chart, independent of presentation scales.
- Browser autosave every 15 seconds and on page exit; explicit Save and JSON import/export. Restored sessions are paused at their saved instant. New session exports the previous scenario first.
- `?preset=overview`, `?preset=inner`, or `?preset=earth` controls startup when no saved session exists.

Drag to orbit, right-drag to pan, scroll/pinch to zoom. Click a body label or use Camera settings to focus. Click inside a view to select which view the settings affect. Overlay panels can be toggled from the top-right menu.

## Architecture

`src/lib/ephemeris.ts` is the pure physical model (AU, days, J2000 ecliptic). `catalog.ts` describes bodies. `scenario.ts` owns serializable configuration and validation. `store.ts` manages the shared clock, persistence, layouts and the command boundary. `renderer.ts` owns each view's Three.js resources, floating origin, presentation scaling and camera controls. Svelte components own the UI. The rendering layer never feeds magnified positions back into physics.

`Command` / `command()` provides an initial validated seam for future natural-language control. The LLM proxy and provider settings are **not implemented in this milestone**. A later localhost server should own credentials and the configurable provider connection, translating validated commands rather than executing arbitrary model-generated code.

## Data and accuracy

Bundled data covers **2025-01-01 through 2031-01-01 UTC**. `npm run data` regenerates local data and textures and requires network access. The script queries [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) through the [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html). Original responses and their source ephemeris identifiers are retained in `public/data/*-source.txt`. Most heliocentric planet responses use DE441; satellite models are identified in their individual responses.

Osculating elements are sampled every eight days for planets and daily for moons, in parent-relative J2000 ecliptic coordinates. We solve Kepler's equation at each bracketing epoch and smoothly blend the propagated Cartesian positions. This avoids position jumps at source boundaries, but is an approximation, not a numerical N-body integration or an exact Horizons reproduction. Orbital paths show the osculating ellipse from the current daily snapshot. Reference-ephemeris error analysis is intentionally deferred. Unit tests check mathematical invariants, dataset coverage, continuity and basic distance sanity, **not positional accuracy against reference ephemerides**.

UI time is UTC. UTC-to-TT conversion assumes TAI−UTC = 37 seconds across the supported interval. The small periodic TT-to-TDB correction and future leap-second changes are omitted. This needs revision for precision timing. Sun-centered geometric positions omit light-time effects. Axial rotation and pole orientation use approximate IAU models; eclipses and shadows are not yet modeled. Saturn's illustrative rings follow its equatorial plane. Untextured moons use solid representative colors. Star directions use a fixed J2000 map; proper motion and stellar parallax are not modeled. Point markers keep subpixel bodies discoverable even at true size.

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

## Next milestones

Real rocket dynamics (gravity, thrust, fuel and events); asteroids and spacecraft; Earth-location observations sampled at local clock time, including time-zone/DST choices and trace/animation modes; configurable LLM proxy and richer camera commands. Scientific validation against reference ephemerides remains a separate future check.
