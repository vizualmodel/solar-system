# Hosted browser adapter (not activated)

Independent preparation for hosted agent access. The application does not import these files or connect automatically. Release is gated on the deployed authenticated transport slice in `C:/dev/connect.vizualmodel.ai` and the hosted-agent implementation brief.

`adapter.ts` validates versioned, narrowly allowlisted operations and per-tab read/control consent, rejects stale generations/deadlines, deduplicates request IDs within a tab incarnation and requires a fresh state revision for absolute setters. It calls the existing application dispatcher through ports. A manual change racing an action invalidates the expected revision. The future server must independently enforce identity, scopes, consent, revocation, registry compatibility, quotas, idempotency and ownership; browser validation alone is not authorization.

`browser-adapter.ts` binds the pure boundary to `simulationState` and `applyBrowserRequest`. `investigation.worker.ts` runs the existing `nextClosestApproach` function against the same bundled ephemeris, without moving calculation to a server. It is read-only and does not silently pause or overwrite the simulation. A timeout terminates the worker. State changes use existing validated setters.

Automated domain tests compare direct and adapted Earth–Mars calculations with exact equality because both call the same deterministic implementation and dataset. This is implementation consistency, not independent ephemeris validation. No browser, cross-instance relay, real OAuth or ChatGPT proof is implied.

The existing local companion service was unreachable (`ECONNREFUSED` at loopback port 5180), so live state/build activation was unavailable. No replacement application server was started, no `.companion` records were changed, and the accepted browser build remains unchanged. This adapter is deliberately not advertised or deployed as working access.
