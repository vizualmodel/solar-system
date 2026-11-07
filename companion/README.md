# Local service and MCP

Run `npm ci`, then `npm run application` at the repository root. Open http://127.0.0.1:5180/ in one browser tab. `npm run companion` also opens a browser; `-- --no-open` suppresses opening. `COMPANION_PORT` selects another loopback port. Stop with Ctrl+C. Node.js 22.12+ is required; verification used Node 24.18.0 on Windows. Use `npm.cmd` in PowerShell if needed.

The implementation is bundled in `packages/companion`; no sibling checkout, vmblu installation, Codex executable or LLM login is required to serve the model and expose its tools. `config.ts` sets `agent: false`. The embedded conversation panel needs an independently running vmblu workspace and registration; it does not embed ChatGPT. Normal simulation and externally connected MCP tools work without that panel.

## Connect an existing local MCP host

The stdio entry point is `node --import tsx companion/mcp.ts`, with this repository as working directory. Set `COMPANION_URL` to the service origin (normally `http://127.0.0.1:5180`) and `COMPANION_TOKEN` to the current token from `.companion/connection.json`. `SOLAR_COMPANION_URL` and `SOLAR_COMPANION_TOKEN` are compatibility aliases. The adapter itself does not infer the URL or read that file. Configure tokens through the host's local environment or model-specific launcher, never a committed token-bearing configuration. Restart changes the token. Keep all connection records private.

For a local read-only diagnostic, this helper obtains the capability in-process without printing it:

```sh
node --import tsx scripts/companion-tool.ts get_simulation_state
```

See [MCP controls](../docs/mcp-controls.md) for eleven application tools and four development tools. Simulation commands and observations need a connected, ready browser. The stdio adapter forwards tools over authenticated loopback HTTP; the service uses correlated, expiring browser WebSocket requests and checks acknowledgements. This is not a headless simulation service. A live owner is protected; a disconnected tab can be replaced. Read fresh state before retrying any timed-out mutation.

## State and build lifecycle

The service serves accepted immutable builds from ignored `.companion/builds`, separately from source and `dist/`. `build_candidate` runs checks/tests and creates a candidate; `activate_candidate` captures complete version-1 state, switches builds, waits for readiness and verifies restoration. `rollback_build` selects the previous build without discarding source. `verify_recovery` deliberately breaks a candidate and is only for an explicitly requested interruption test.

`config.ts`, `tools.ts` and `control-schema.ts` define application capabilities; browser/state/readiness adapters preserve the simulation contract. Markdown scenario prompts are separate from saved JSON simulation state. Services bind to loopback. This is a single-user development bridge, not a hosted multi-user boundary; do not expose it publicly. Source builds require a named branch. `npm run companion:doctor` reports diagnostics without changing security settings.

Keep `.companion`, `.env*`, `.codex`, caches, dependencies and build output out of Git. Historical independent-agent notes are preserved in [pilot history](../docs/companion-pilot-history.md); they are not current startup instructions.
