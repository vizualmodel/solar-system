# Local Bridge Agent acceptance — 10 November 2026

## Actual HTTPS follow-up on Bridge 0.2.3

The same Solar implementation was subsequently built cleanly from source `dd8b24aa1210bc8016135d7a87f984592abc566b` and deployed, with separate owner approval, as an isolated authenticated HTTPS acceptance preview. Production was not deployed. All 89 deployed source assets match the prepared hashes.

The owner confirmed Chrome cold launch from a stopped Bridge, real hosted conversation, labels inversion/readback and Earth–Mars investigation on installed 0.2.3: “Everything worked ok - latency was reasonable.” The approximate four or five approvals were accepted by the owner; no exact duration or approval count was measured. The agent independently observed the exact HTTPS origin with model-control permission in the native 0.2.3 window.

No new raw numerical reply was pasted, so the exact local-folder numerical result below is not relabeled as the HTTPS result. Denied action, Stop, reconnect and two concurrent real tabs are tracked separately in the [0.2.3 acceptance record](https://github.com/vizualmodel/bridge/blob/bridge/connection-proof/docs/acceptance-0.2.3.md).

## Reconnect and feedback follow-up

The owner confirmed two-tab isolation, including rejection of B's read-only mutation. An initial attempt displayed only “Error · Read only”; a later retest gave a genuine Codex reply explaining that labels were hidden and the connected tools could only read. The first error was not reproduced in a separate real-Codex fixture; that test also returned a normal read-only explanation without executing a control. The UI now adds a clearly labeled Bridge explanation in the conversation when a request ends in an error, preserving genuine Codex replies and avoiding duplicate failure notices. One actual read is also shown once rather than counting both its runtime wrapper and browser action.

The owner reported that disconnect succeeded, while reconnect required a second attempt. A real-socket fixture reproduced a timing failure in the original shipped client: an already-running listener rejected the hello before the OS launch activation arrived. The revised client retries only that unauthenticated hello within the original pairing deadline. Failed identity proofs, denied consent, chat and model actions are never automatically retried. This matches the reported symptoms but does not establish the exact cause of the owner's first attempt.

The browser now starts the Codex conversation immediately after native model consent, using Bridge 0.2.3's existing New conversation capability, and waits for conversation acknowledgement before showing Ready. Reconnection explicitly starts a new conversation without replaying actions. The changes require only updated model assets; the accepted installer remains unchanged. Updated graphical feedback/reconnect acceptance is still required. Denied-action and Stop outcomes have not yet been individually confirmed.

## Earlier local-folder acceptance on Bridge 0.2.1

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
