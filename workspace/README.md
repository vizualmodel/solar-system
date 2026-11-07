# Solar model workspace descriptor

The model-owned entry point is **`../solar-system.blu.json`**. It declares Solar Observatory's launch URL, companion/MCP metadata, references, and curated tiles. Real application screenshots live in `previews/` as JPEG files. The root descriptor, model documentation and assets stay with this project; vmblu discovers them without copying them.

Start the existing application companion from the model root:

```powershell
npm.cmd run companion -- --no-open
```

Alternatively `node --import tsx workspace/start-companion.mjs` is the model-owned convenience launcher; append `--no-agent` to use the existing agent-disabled configuration. It imports this project's companion configuration and the shared companion library, with no dependency on the vmblu checkout.

In vmblu choose Open model and enter the absolute location of `solar-system.blu.json`. The application's default URL is `http://127.0.0.1:5180/`. If choosing another companion port, set the application's `COMPANION_PORT` and update the URL in the descriptor. Relative resource paths and metadata working directories resolve from the descriptor directory.

Tile and Area modes retain one browser application. Preview images are static. Jupiter's Moons additionally declares a reusable `setup.prompt`: vmblu opens the embedded application, verifies that frame's identity against the controlled browser, and submits the prompt as an ordinary companion turn. Each click explicitly requests setup again; prompts are never replayed after errors or reconnects. Existing runtime approvals still apply. A separate tab cannot receive an embedded tile's setup; close any separate tab that owns the connection before using setup tiles. vmblu must be restarted and reloaded after installing tile-setup support.

`observe.mjs` is a model-specific diagnostic helper using the existing authenticated companion operation boundary. Its save/compare/restore options use `validation/solar-before.json`; restoring is an explicit simulation-state mutation. The initial validation report is archived in `validation/`. It records the original prototype and is historical; current descriptor/assets now live in this project. These artifacts are excluded from source control. No scientific calculations or accepted application builds were changed by relocating discovery metadata and previews.
