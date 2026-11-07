# Phase 1 technical baseline

Date: 7 November 2026. Scope: consolidate the existing Solar System model; no catalog redesign, new blueprint schema, ChatGPT integration or scientific/rendering rewrite.

## Source and history

Authoritative checkout: `C:/dev/blu/solar-system`, origin `https://github.com/vizualmodel/solar-system.git`. Fetched remote main and original local HEAD both equal `e0597d8cd94d02c790e1b4edcedd3ac5e5915294`; there were no divergent commits. The newer implementation was uncommitted on `companion/local-pilot`. Phase 1 preserves it on `phase1/solar-system-baseline` for review without replacing main or rewriting history. The exact published commit is recorded in the pull request and final report rather than a self-referential SHA in this file.

Authenticated GitHub access to solar-system, vizualmodel.ai and blueprints.vizualmodel.ai was verified with ADMIN permission. Website repositories were not modified. `C:/dev/solar-system-validation` is a generated static copy, not an authoritative source repository.

## Implementation inventory

| Area | Existing source/resources | Reuse and limits |
| --- | --- | --- |
| Physical calculations | `src/lib/ephemeris.ts`, `rotation.ts`, `closest-approach.ts`, `catalog.ts` | Pure Kepler/rotation/distance functions are reusable. AU/day and J2000 contracts need to remain explicit; no N-body integrator. |
| Data | `public/data/ephemeris.json`, original Horizons responses, pck00011; `src/data/rotation.json`, satellite snapshots/population cache; Apollo 1969 vectors | Versioned source datasets work offline. Normal range 1990–2031; historical extension lacks complete raw-response provenance. Apollo context is separate. |
| Satellites | `satellites.ts`, `population.ts`, cached CelesTrak/ReTLEctor data | SGP4 near snapshot epoch, illustrative bounded two-body continuation beyond ±3 days; not historical/future telemetry. |
| State | `simulation-state.ts`, `store.ts`, `layout.ts`, compatibility `scenario.ts` | Version-1 JSON state, browser localStorage autosave and paused restoration; transient panel settings separate. No hosted per-user sessions. |
| Browser/rendering | Svelte components, `renderer.ts`, Earth/sky/satellite helpers, telescope/surface/landscape modules | WebGL visualization reusable as an optional view; positions and rendering scales remain separate. CPU/GPU memory and bundle size are substantial. |
| Missions | `mission*.ts`, Apollo vehicle/rendering modules, `src/data/apollo-11.json`, audio/models | Deterministic educational player; authored spacecraft paths and telemetry are illustrative. Not a general flight-dynamics solver. |
| Application MCP | `companion/config.ts`, tool schemas, browser/state/readiness adapters, scenario repository | Eleven application tools plus four development tools; browser acknowledgements required. |
| Companion transport | `packages/companion/src` | Existing stdio adapter, loopback HTTP/WebSocket, browser ownership, build activation/recovery, diagnostics and legacy agent modules. Owner authorized inclusion from the separate private local checkout; original checkout remains unchanged. Solar sets `agent: false`. |
| Tests | `tests/*.test.ts`, bundled library tests and counter example | Application invariants/assets/controls, state/activation failure handling and library transport integration. The counter is development-only. |
| Build/deployment | Vite/Svelte/TypeScript, npm lockfile, Git LFS, `vercel.json` | Static Vercel output plus separate optional local Node tool service. No container or hosted MCP service. |
| Documentation/assets | README, feature guides, scenario Markdown, workspace preview images, NASA models/audio, CC BY textures, Draco license | Existing resources preserved. Prior companion/architecture reviews are historical context; their external workspace references are not required startup paths. |

Other local integration resources inspected: `C:/dev/companion` is the source library now bundled here; `C:/dev/vmblu-mcp/integrations/solar-system` has a model-specific stdio launcher that reads the private local connection record. `C:/dev/artifacts/solar-companion-tool.mjs` is a local diagnostic. These are optional development/workspace integrations rather than required runtime dependencies. Existing `solar-system.blu.json` and `workspace/` resources are preserved as legacy discovery assets, not a new distribution contract. Removed original `bridge/` code remains in Git history; its local successor is `companion/`.

## Runtime and MCP architecture

MCP host → stdio `companion/mcp.ts` → capability-authenticated loopback HTTP → application service → owning browser WebSocket → validated command boundary/renderer → checked acknowledgement. Tools cover observations/time, timeline, camera, scene, satellites, views, session, scenarios, workspace and charts; development tools build/activate/rollback/test recovery. The live browser owns simulation state; the service is not an independent headless computational runtime.

Static browser operation needs Node only for building/serving and a WebGL browser for execution. Local MCP additionally needs a running Node service, a ready browser and per-run capability configuration. Embedded conversation/scenario prompting currently expects vmblu registration. It is optional for model operation and external MCP control. Direct ChatGPT cannot reach arbitrary local stdio/loopback services through this repository alone; host connection, remote transport/authentication, session isolation and lifecycle design remain future work.

## Verification and limits

- `npm ci --ignore-scripts`: passed using the bundled dependency; lockfile no longer refers to the sibling checkout.
- Application `npm run check`: zero errors/warnings. `npm test`: 168 passed, zero skipped/failed.
- `npm run build`: passed. Existing large-chunk and third-party annotation warnings remain; main JS about 8.13 MB before gzip.
- Bundled library check: zero errors/warnings. Library tests: 17 passed. Initially the counter integration failed because its compiler path assumed a local node_modules; resolving the installed TypeScript executable fixes the bundled layout without changing runtime/scientific behavior.
- `git lfs fsck`: passed. Star map is 130,530,278 bytes; source and production output SHA-256 both `dc6c4f413e85707a29a25a9451148154554ecca2c996f84fa8f47b65ef9ff7c4`. Vercel must fetch LFS objects and include dev dependencies for builds. Live Vercel settings/deployment were not changed or independently verified.
- Live stdio MCP observation succeeded against the existing browser. User explicitly confirmed the app works at http://127.0.0.1:5180/. Automated visual verification was unavailable because Computer Use could not confidently determine the browser URL; user confirmation is recorded separately from automated tests.
- The companion `build_candidate` operation also passed checks, all application tests and its production-mode build. Live activation was attempted but safely refused because the owning browser tab was hidden; no served build changed. The visible browser therefore remained on its previously accepted local build. Final documentation-only edits followed candidate creation; activate only after rebuilding the final source. No successful live activation is claimed for this baseline.
- Initial sandbox runs encountered process-spawn EPERM/config-loading errors; approved subprocess-capable reruns produced the results above.
- `npm audit`: 11 advisories (3 low, 3 moderate, 5 high), including MCP SDK, Vite and Zod chains. No automatic dependency upgrades were applied in this consolidation. Review exploitability and compatible fixes before public hosted service exposure.
- Independent reference-ephemeris accuracy comparisons, external glslang shader compilation, full ChatGPT connection, live Vercel deployment and deliberate live failed-candidate recovery were not performed. Automated activation/recovery tests are not substitutes for those checks.

## Distribution issues and next decisions

No top-level source license exists; owner permission to include companion source does not create a general open-source grant. Texture CC BY attribution, Draco Apache license, NASA/DigitalSpace model credits, audio credits and image source records are retained. A complete source-specific redistribution rights review remains open. Historical UTC/TT offset approximation, raw-response provenance gaps, satellite epoch limits and illustrative Apollo flight reconstruction must remain explicit.

For Phase 2, first choose one supported agent connection/runtime path and its authentication/session boundaries, select a source license and review asset rights, then design accurate catalog/discovery metadata around the existing Kepler model. Prioritize dependency advisory remediation and reference-data validation. Keep reusable calculations distinct from browser presentation conceptually; no distribution refactoring or generic composition engine was introduced here. Begin Phase 2 only with user approval.
