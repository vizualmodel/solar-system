import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BrowserConnection } from './browser-connection';
import type { BridgeOperation } from '../src/dev/bridge-protocol';

try { loadEnvFile(fileURLToPath(new URL('../.env.bridge.local', import.meta.url))); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }

const log = (message: string) => console.error(`[Solar bridge] ${message}`);
let browser: BrowserConnection | undefined;
try {
  browser = new BrowserConnection(process.env.SOLAR_BRIDGE_TOKEN ?? '', 3000, 5174, log);
  await browser.ready;
  const server = new McpServer({ name: 'solar-system-local', version: '0.1.0' });
  const call = async (operation: BridgeOperation) => {
    try {
      const state = await browser!.request(operation);
      return { content: [{ type: 'text' as const, text: JSON.stringify(state) }], structuredContent: { ...state } };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Bridge request failed.' }] };
    }
  };
  server.registerTool('get_simulation_state', {
    description: 'Read the actual connected browser simulation time (ISO UTC) and playing state. Does not return cached state.',
    inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: false },
  }, () => call({ method: 'get_simulation_state' }));
  server.registerTool('set_simulation_time', {
    description: 'Set simulation time through the browser command boundary, then return acknowledged actual state. Preserves playing/paused state. Requires an explicit timezone and the supported/current scenario interval.',
    inputSchema: { time: z.string() }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, ({ time }) => call({ method: 'set_simulation_time', time }));
  const transport = new StdioServerTransport();
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await browser!.close();
    await server.close();
  };
  server.server.onclose = () => { void shutdown(); };
  process.stdin.on('end', () => { void shutdown(); });
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  await server.connect(transport);
  log('Listening on ws://127.0.0.1:5174/bridge; awaiting one browser at http://127.0.0.1:5173.');
} catch {
  log('Could not start. Run npm run bridge:init and ensure port 5174 is free (only one Codex bridge process).');
  await browser?.close();
  process.exitCode = 1;
}
