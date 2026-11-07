// Local diagnostic CLI for the application's existing MCP adapter. Never prints capabilities.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const origin = process.env.COMPANION_URL ?? 'http://127.0.0.1:5180';
const response = await fetch(origin + '/companion/bootstrap', { signal: AbortSignal.timeout(5000) });
if (!response.ok) throw new Error('Application service unavailable.');
const bootstrap = await response.json();
const client = new Client({ name: 'solar-local-diagnostics', version: '1' });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'companion/mcp.ts'], cwd, env: { ...process.env, COMPANION_URL: origin, COMPANION_TOKEN: bootstrap.token } as Record<string, string> }));
  const name = process.argv[2] ?? 'get_simulation_state';
  const result = await client.callTool({ name, arguments: JSON.parse(process.argv[3] ?? '{}') }, undefined, { timeout: 240000 });
  if (result.isError) throw new Error(JSON.stringify(result.content));
  console.log(JSON.stringify(result.structuredContent ?? result.content));
} finally { await client.close(); }
