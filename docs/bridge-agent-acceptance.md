# Local Bridge Agent acceptance — 10 November 2026

The owner tested real Codex conversation and model control in Solar's Agent panel using the installed Bridge 0.2.1 and its selected-folder server. This is owner-observed real browser evidence, not a synthetic runtime fixture.

The labels request passed after genuine Codex action approval. The owner reported an immediate Bridge connection prompt followed by a long wait for Codex's action prompt. No exact latency or independent full before/after state snapshot was captured.

The same conversation successfully ran the existing Earth–Mars investigation:

| Field | Reported result |
| --- | --- |
| FROM / TO | 1990-01-01T00:00:00.000Z / 2031-01-01T00:00:00.000Z |
| Next local minimum | 1990-11-20T04:10:33.596Z |
| Distance | 0.5169142299632358 AU |
| State | Unchanged, revision 3 |
| Model build | solar-1-6d9822092feb |
| Data SHA-256 | 7ceaea34c6b43e2e5f7a239cbfca79fa9a19cff12c7afd17cf46d8747083176e |

Direct invocation of the existing calculation with identical range and dataset returned the exact same timestamp and distance. This verifies consistency with that implementation, **not independent astronomical accuracy**. It uses approximate Keplerian ephemeris, six-hour brackets and one-second refinement, and finds the next future local minimum rather than the absolute minimum across the range.

The accepted private bundle was built from the implementation working tree before its panel commit; its embedded source ID identifies the base commit. New local builds now mark a dirty working tree explicitly. No immutable release claim is made for that first acceptance build.

Bridge's follow-up uses the selected model's advertised reasoning effort by default instead of inheriting the developer's high effort. Trusted settings expose supported effort choices; global Codex configuration is unchanged. The panel shows effort, elapsed time and where action approval appears. Attribution of the earlier delay to effort is a plausible inference, not a controlled causal finding. No approval is bypassed.

Structured owner evidence and exact runtime restrictions: https://github.com/vizualmodel/bridge/blob/bridge/connection-proof/docs/solar-panel-acceptance.json and https://github.com/vizualmodel/bridge/blob/bridge/connection-proof/docs/codex-runtime.md .

Review source only. No merge, model deployment or public installer release. Remaining broad acceptance includes concurrent real tabs, graphical Stop/resume/failure/offline flows, denied browser permissions and keyboard/narrow-window checks.
