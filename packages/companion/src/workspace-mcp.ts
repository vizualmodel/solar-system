import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/** Local workspace retrieval adapter. Application tools remain in their own MCP servers. */
export async function startWorkspaceMcp() {
  const server = new McpServer({ name: 'vmblu-workspace', version: '0.2.0' });
  for (const [name, description, inputSchema] of [
    ['workspace_catalog', 'Discover the active blueprint, applications and their MCP connection status, references, experiments and saved results.', {}],
    ['workspace_resource', 'Read a declared local reference or an experiment by its catalogue id. Remote references return their URL for retrieval.', { kind: z.enum(['reference', 'experiment']), id: z.string() }],
  ] as const) server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } }, async (params: any) => {
    try {
      const response = await fetch(process.env.VMBLU_URL + '/internal/workspace', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.VMBLU_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ method: name, params, projectId: process.env.VMBLU_PROJECT }), signal: AbortSignal.timeout(10000) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    } catch (error) { return { isError: true, content: [{ type: 'text' as const, text: String(error) }] }; }
  });
  await server.connect(new StdioServerTransport());
  process.stdin.on('end', () => void server.close());
}
