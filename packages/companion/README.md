# Bridge-owned Companion snapshot

This independently installable snapshot of `@vizualmodel/companion` is maintained from `vizualmodel-bridge/packages/companion`. The standalone Companion checkout was retired on 16 November 2026. The package is private and is not published to npm.

From the Bridge checkout, run `node scripts/sync-companion.mjs` to refresh this snapshot and `node scripts/sync-companion.mjs --check` to detect drift. Solar remains installable without access to the private Bridge repository. Run this package's check/tests and Solar's check/tests after shared changes.

The library preserves model loopback transport, browser acknowledgement, MCP, state restoration and candidate activation. Solar sets `agent: false`; desktop connection and supported runtime behavior belong to Bridge. Application-specific tools and scientific state stay in Solar.
