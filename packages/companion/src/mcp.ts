import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ApplicationTool } from './contracts';
export async function startMcp(options: { name: string; tools: ApplicationTool[]; url?: string; token?: string }) {
 const server = new McpServer({ name: options.name, version: '0.0.0' });
 const reserved = ['build_candidate','activate_candidate','rollback_build','verify_recovery'];
 const tools = [...options.tools, ...reserved.map(name => ({ name, description: ({ build_candidate: 'Run configured validation and build a candidate without activation.', activate_candidate: 'Activate the validated candidate, preserving and verifying application state.', rollback_build: 'Restore the previous build preserving application state. Source is retained.', verify_recovery: 'Only on explicit user request: test a failed candidate load and verify recovery.' } as Record<string,string>)[name], inputSchema: {}, validateResult: (v: unknown) => v }))];
 if (new Set(tools.map(t => t.name)).size !== tools.length) throw new Error('Duplicate or reserved tool name.');
 for (const tool of tools) server.registerTool(tool.name, { description: tool.description, inputSchema: tool.inputSchema, annotations: 'annotations' in tool ? tool.annotations : { destructiveHint: false, openWorldHint: false } }, async (params: any) => {
  try {
   const response = await fetch((options.url ?? process.env.COMPANION_URL) + '/internal/tool', { method: 'POST', headers: { authorization: 'Bearer ' + (options.token ?? process.env.COMPANION_TOKEN), 'content-type': 'application/json' }, body: JSON.stringify({ method: tool.name, params }), signal: AbortSignal.timeout(240000) });
   const result = await response.json(); if (!response.ok) throw new Error(result.error);
   return { content: [{ type: 'text' as const, text: ('summarize' in tool && tool.summarize ? tool.summarize(result) : tool.name + ' completed.') }], structuredContent: result };
  } catch(error) { return { isError: true, content: [{ type: 'text' as const, text: String(error) }] }; }
 });
 await server.connect(new StdioServerTransport());
 process.stdin.on('end', () => { void server.close(); });
 return server;
}
