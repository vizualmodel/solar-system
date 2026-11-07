import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { build } from 'esbuild';

test('approval UI displays the browser origin, persistence and explicit decisions', async () => {
 const source = await readFile(new URL('../src/ElicitationApproval.svelte', import.meta.url), 'utf8');
 const compiled = compile(source, { generate: 'server', filename: 'ElicitationApproval.svelte', name: 'ElicitationApproval' });
 const bundle = await build({
  stdin: { contents: compiled.js.code + "\nimport {render} from 'svelte/server'; export const html = props => render(ElicitationApproval, {props}).body;", resolveDir: fileURLToPath(new URL('../src/', import.meta.url)) },
  bundle: true, write: false, platform: 'node', format: 'esm'
 });
 const { html } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 const request = { method: 'mcpServer/elicitation/request', params: {
  mode: 'form', requestedSchema: { type: 'object', properties: {} },
  _meta: { tool_name: 'access_browser_origin', origin: 'http://127.0.0.1:5190', persist: 'always' }
 }};
 const props = { request, onanswer: () => assert.fail('Rendering must not answer the request') };
 const confirmation = html(props);
 assert.match(confirmation, /http:\/\/127\.0\.0\.1:5190/);
 assert.match(confirmation, /remembered for future requests/);
 assert.match(confirmation, />Allow and remember<\/button>/);
 assert.match(confirmation, />Decline<\/button>/);
 assert.match(confirmation, />Cancel<\/button>/);
 assert.doesNotMatch(confirmation, /does not support/);
 request.params._meta.persist = 'once';
 assert.match(html(props), />Allow<\/button>/);
 assert.doesNotMatch(html(props), /remembered for future requests/);
 const unsupported = html({ ...props, request: { ...request, params: { ...request.params, requestedSchema: { type: 'object', properties: { name: { type: 'string' } } } } } });
 assert.match(unsupported, /does not support/);
 assert.doesNotMatch(unsupported, />Allow/);
 assert.match(unsupported, />Decline<\/button>/);
});
