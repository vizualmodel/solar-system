import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalSummary,sessionApprovalAvailable,confirmationElicitationAvailable } from '../src/approvals';
import { Runtime } from '../src/runtime';
test('readable summaries and scoped session decisions',()=>{
 const request={id:1,method:'item/commandExecution/requestApproval',params:{reason:'Read\n camera settings',command:'node script.js'}};
 assert.equal(approvalSummary(request),'Read camera settings');
 assert.equal(sessionApprovalAvailable(request),true);
 assert.equal(sessionApprovalAvailable({...request,params:{availableDecisions:['accept','decline']}}),false);
 assert.equal(sessionApprovalAvailable({method:'mcpServer/elicitation/request'}),false);
 assert.equal(approvalSummary({...request,params:{networkApprovalContext:{host:'example.com'}}}),'Allow network access to example.com?');
 const sent:any[]=[];const runtime=new Runtime(process.cwd(),'','',async()=>{});
 runtime.rpc={send:(value:any)=>sent.push(value)} as any;
 runtime.approvals.set('1',request);runtime.answer('1','acceptForSession');
 assert.deepEqual(sent,[{id:1,result:{decision:'acceptForSession'}}]);
 assert.equal(runtime.approvals.size,0);
 assert.throws(()=>runtime.answer('1','acceptForSession'),/no longer pending/);
 runtime.approvals.set('2',{...request,id:2,params:{availableDecisions:['accept']}});
 assert.throws(()=>runtime.answer('2','acceptForSession'),/Invalid/);
 assert.equal(runtime.approvals.size,1);
});

const browserRequest = (id = 42) => ({
 id, method: 'mcpServer/elicitation/request', params: {
  threadId: 'browser-thread', turnId: 'browser-turn', serverName: 'cua_repl', mode: 'form',
  message: 'Allow Browser use to access http://127.0.0.1:5190?',
  requestedSchema: { type: 'object', properties: {} },
  _meta: { codex_approval_kind: 'mcp_tool_call', tool_name: 'access_browser_origin', origin: 'http://127.0.0.1:5190', persist: 'always' }
 }
});

test('browser confirmation sends an explicit MCP decision with the original request ID', () => {
 for (const answer of ['accept', 'decline', 'cancel']) {
  const sent: any[] = [];
  const runtime = new Runtime(process.cwd(), '', '', async () => {});
  runtime.rpc = { send: (message: any) => sent.push(message) } as any;
  const request = browserRequest();
  runtime.approvals.set(String(request.id), request);
  assert.equal(confirmationElicitationAvailable(request), true);
  assert.equal(sent.length, 0, 'receiving a request must not approve it');
  runtime.answer(String(request.id), answer);
  assert.deepEqual(sent, [{ id: 42, result: { action: answer, content: answer === 'accept' ? {} : null, _meta: answer === 'accept' ? { persist: 'always' } : null } }]);
  assert.equal(runtime.approvals.size, 0);
  assert.throws(() => runtime.answer('42', answer), /no longer pending/);
 }
});

test('unsupported forms and invalid decisions cannot grant empty-content approval', () => {
 const request = browserRequest();
 const unsupported = [
  { ...request, params: { ...request.params, mode: 'url', url: 'https://example.com' } },
  ...[undefined, {}, { type: 'object' }, { type: 'object', properties: [] },
   { type: 'object', properties: { name: { type: 'string' } } },
   { type: 'object', properties: {}, required: ['name'] },
   { type: 'object', properties: {}, minProperties: 1 },
   { type: 'object', properties: {}, additionalProperties: { type: 'string' } },
  ].map(requestedSchema => ({ ...request, params: { ...request.params, requestedSchema } }))
 ];
 const runtime = new Runtime(process.cwd(), '', '', async () => {});
 const sent: any[] = [];
 runtime.rpc = { send: (message: any) => sent.push(message) } as any;
 for (const form of unsupported) {
  assert.equal(confirmationElicitationAvailable(form), false);
  runtime.approvals.set('42', form);
  assert.throws(() => runtime.answer('42', 'accept'), /does not support/);
  assert.equal(runtime.approvals.size, 1);
  runtime.answer('42', 'decline');
  assert.equal(sent.at(-1).result.action, 'decline');
 }
 runtime.approvals.set('42', request);
 for (const answer of ['acceptForSession', {}, null, 'anything']) {
  assert.throws(() => runtime.answer('42', answer), /Invalid form decision/);
  assert.equal(runtime.approvals.size, 1);
 }
});

test('resolved and completed browser requests cannot be answered later', () => {
 const runtime = new Runtime(process.cwd(), '', '', async () => {});
 runtime.threadId = 'browser-thread';
 runtime.approvals.set('42', browserRequest());
 (runtime as any).notification({ method: 'serverRequest/resolved', params: { threadId: runtime.threadId, requestId: 42 } });
 assert.throws(() => runtime.answer('42', 'accept'), /no longer pending/);
 runtime.approvals.set('42', browserRequest());
 (runtime as any).notification({ method: 'turn/completed', params: { threadId: runtime.threadId, turn: { status: 'completed' } } });
 assert.throws(() => runtime.answer('42', 'accept'), /no longer pending/);
});
