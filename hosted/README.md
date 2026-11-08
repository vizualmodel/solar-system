# Hosted browser access

The required deployed transport gate passed on 8 November 2026: actual ChatGPT request `5099449b-6182-4d76-b0d4-c46603d7904a` received the authenticated browser's visibility/time result. The model integration is now prepared for private production acceptance. `HOSTED_AGENT_ENABLED=true` at build time exposes the Agent access panel. It never signs in or grants access automatically.

`adapter.ts` validates narrowly allowlisted operations, per-tab consent, generations and deadlines, and deduplicates request IDs. It calls the existing dispatcher through ports. Absolute setters preserve unrelated state and playback; manual/agent changes apply in browser event order. Optional `expectedRevision` rejects an intervening change; receipts report the revision/state actually used. The service independently enforces identity, scopes, consent, revocation, immutable build/data allowlists, quotas, idempotency and ownership.

`browser-adapter.ts` binds the pure boundary to `simulationState` and `applyBrowserRequest`. `investigation.worker.ts` runs the existing `nextClosestApproach` function against the same bundled ephemeris, without moving calculation to a server. It is read-only and does not silently pause or overwrite the simulation. A timeout terminates the worker. State changes use existing validated setters.

Automated domain tests compare direct and adapted Earth–Mars calculations with exact equality because both call the same deterministic implementation and dataset. This is implementation consistency, not independent ephemeris validation. No browser, cross-instance relay, real OAuth or ChatGPT proof is implied.

`transport.ts` uses an explicit popup with exact source/origin/state validation and a 30-second one-use handoff. Browser credentials stay only in memory. WSS authenticates with a one-use ticket and renews via bounded, jittered reconnects. Before execution, an HTTP start transition rechecks current consent/generation/deadline atomically. Disconnect revokes remote access and terminates investigation workers, preserving manual model state. Reload creates a new incarnation; uncertain controls are never replayed.

Vite emits `build-info.json` containing the source commit, immutable build ID, dataset SHA-256 and protocol. The relay accepts only approved IDs. This public provenance contains no credentials. OAuth, Redis and all secrets remain in the separate Connect service.

The local companion remains unavailable. No replacement application server was started, no `.companion` records changed, and no local build activation/restoration is claimed. This is the separately authorized production release workflow.
