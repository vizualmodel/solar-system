# Local Codex bridge

A development-only experiment for one Codex process and one browser tab. Codex launches a Node MCP stdio server; that process listens for the application's WebSocket adapter on loopback. Both the adapter and the UI use the existing `scenario` store and `command()` boundary. No hosted application can connect.

## Setup (Windows / VS Code)

Requires Node.js 22.12+ and the dependencies from this checkout. In PowerShell:

```powershell
cd C:\dev\blu\solar-system
npm.cmd install
npm.cmd run bridge:init
```

The initializer creates `.env.bridge.local` with a random `SOLAR_BRIDGE_TOKEN`. It does not print the token or replace an existing file. The file is ignored by Git and Vercel. Both Vite bridge mode and the Node bridge read this same file; do not copy the token into the MCP configuration. An existing `SOLAR_BRIDGE_TOKEN` environment variable overrides the file in both processes, so unset it if troubleshooting mismatches. To rotate the token, remove this one local file, rerun the initializer, and restart both processes.

Merge [codex-config.example.toml](codex-config.example.toml) into `%USERPROFILE%\.codex\config.toml`, or into `.codex/config.toml` in this trusted project. Adjust paths if your checkout differs:

```toml
[mcp_servers.solar_system]
command = "node"
args = ["--import", "tsx", "C:/dev/blu/solar-system/bridge/server.ts"]
cwd = "C:/dev/blu/solar-system"
startup_timeout_sec = 15
tool_timeout_sec = 10
```

Restart the VS Code Codex extension after saving. If VS Code cannot find Node, replace `command` with the absolute path shown by `Get-Command node`. This example runs on Windows with the browser on that same machine; WSL/remote extension hosts are outside this experiment.

Codex launches the bridge. Do **not** launch a separate `npm run bridge` process alongside it; only one process can bind port 5174. The example uses Node directly so npm output cannot interfere with MCP stdout. All bridge diagnostics use stderr. See [official Codex MCP configuration](https://developers.openai.com/codex/mcp).

Start the application in a separate VS Code terminal:

```powershell
npm.cmd run dev:bridge
```

Open exactly **http://127.0.0.1:5173/** in one browser tab. `localhost`, other ports, HTTPS, and hosted origins are deliberately rejected. Vite uses `strictPort` rather than silently choosing a different port. Stop an existing Vite process first if it occupies 5173.

Open browser developer tools, select Console, and look for `[Local bridge] Connected`. Connection errors also use the application's existing status store; they never block normal simulation use. If Codex starts later, the adapter retries every 1.5 seconds. A second tab gets an explicit rejection; close the original tab and reload the second to transfer control. Browser reloads can briefly overlap the old connection; reload again if rejected. After browser back/forward-cache restoration, reload the page to reconnect.

The token is supplied to the local browser in development mode and sent in WebSocket protocol headers, not in the URL. It is a local development credential, not a multi-user authentication system. The WebSocket server accepts only `http://127.0.0.1:5173` and binds only `127.0.0.1:5174`.

## Tools

Only these two MCP tools are registered:

- `get_simulation_state()` returns `{ "time": "2027-01-01T00:00:00.000Z", "playing": false }` from the connected browser, never a cache. `playing: false` means paused.
- `set_simulation_time({ "time": "2027-01-01T00:00:00Z" })` validates the timestamp, sends a request, calls `command({type: 'time', value})` in the browser, and reads the actual store back after scenario validation. It preserves playing/paused state.

Accepted timestamps have the form `YYYY-MM-DDTHH:mm:ss[.SSS]Z` or an explicit `+HH:mm` / `-HH:mm` offset; optional fractions contain one to three digits. Impossible dates, leap seconds, missing timezones, and times outside **2025-01-01T00:00:00Z through 2031-01-01T00:00:00Z inclusive** are rejected. Offsets are converted before checking the interval. If the UI's FROM/TO range is narrower, requests outside it are rejected instead of silently clamped.

Every request has a unique ID and a three-second deadline. A matching browser acknowledgement is required for success. Disconnection fails immediately; no requests are queued for reconnection. An unresponsive browser causes a tool error after three seconds. Expired requests are rejected in the browser before mutation. A timeout can also mean the command applied but its reply was lost: read state again before retrying. Playback can advance time after the acknowledged snapshot; pause in the UI for exact visual comparisons.

### Preserving state during development reloads

The adapter saves the existing validated scenario immediately before Vite full reloads and page exit, after asking each rendered view to capture its actual camera and target. Reloads restore paused at that saved date, using the existing save slot. A one-use session-storage receipt checks the restored date, cameras, view settings, layout and active view against the pre-reload values. Subsequent `get_simulation_state` responses include a `reload` result with `datePreserved`, `camerasAndViewsPreserved`, saved `time`, and view count. No additional MCP operations or server restart are needed; Vite supplies the reload mechanism.

During closest-approach implementation, the live browser acknowledged a completed reload with both preservation flags true, one view, and saved date `2028-10-01T03:36:48.800Z`. This verifies the actual browser's scenario restoration; it does not replace visual inspection of the new button.

## Production isolation

`npm run dev` is normal development without the adapter. Only `npm run dev:bridge` enables it. `src/main.ts` gates the dynamic import on both Vite's `DEV` flag and bridge mode. Vite injects the token only when serving in bridge mode. `npm run build` excludes the adapter, bridge endpoint, and token from browser output, even if the local token file exists. The MCP SDK and WebSocket dependencies are development dependencies.

## Verification

Automated checks completed during implementation:

- `npm run check`: zero errors or warnings.
- `npm test`: existing tests plus timestamp, interval, request correlation, acknowledgement, bad origin/token, second-session rejection, disconnect, timeout, no replay, and real-store integration tests.
- `npm run build`: passed; the existing Three.js bundle-size warning remains. Production output was checked for adapter markers and the actual local token; none were present.
- A separate SDK client launched the real stdio server and verified the two tools, set/readback through a WebSocket stand-in using the real scenario store, invalid dates, timeout, and disconnect. This is **not** a browser UI test.
- Vite bridge mode started successfully and served the app and adapter.

**Still manual:** no controllable browser was available in the implementation session, so neither the visible UI nor the VS Code Codex extension was exercised end-to-end. The MCP entry is installed in the user's `%USERPROFILE%\.codex\config.toml`, preserving existing settings and a backup. It was moved from the project-local configuration so it also loads when VS Code opens the parent `C:\dev` workspace. Restart Codex to load it. Run only one Codex client using this bridge at a time; another client will fail to bind port 5174.

Run this acceptance test after setup:

1. Open the local app, confirm `[Local bridge] Connected`, pause playback, and reset the FROM/TO range if previously narrowed.
2. Ask VS Code Codex: **“Use solar_system.get_simulation_state to read the current Solar System simulation time and playing state.”** Confirm it actually invokes the MCP tool; compare the result with the UTC date field. The UI displays minutes; the tool includes seconds and milliseconds.
3. Ask: **“Use solar_system.set_simulation_time to set the time to 2027-01-01T00:00:00Z.”** Expect `2027-01-01T00:00:00.000Z` and `playing: false`. Verify the browser's simulation date is **1 January 2027, 00:00 UTC**.
4. Manually set **15 June 2028, 12:34** in the simulation date field and commit the edit (Tab or click outside it). Ask for the state again; expect `2028-06-15T12:34:00.000Z`. This proves UI and tool share the same store.
5. Close the application tab. Ask for the state again; expect a **Browser disconnected** tool error, not the previous value.
6. Optional: open two tabs to check the second is rejected. Stop the bridge and confirm the simulation still works normally while reporting the connection error.

Nothing in this setup deploys, pushes, edits source through MCP, or controls another browser session.
