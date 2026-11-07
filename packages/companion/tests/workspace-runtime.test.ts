import test from 'node:test';
import assert from 'node:assert/strict';
import { Runtime } from '../src/runtime';

test('workspace mode configures native development policy, model and only workspace-approved MCP servers',async()=>{
 const runtime=new Runtime(process.cwd(),'','',async()=>{}, {workspace:true,mcpName:'unused',mcpEntry:'',instructions:'',name:'Workspace'});
 (runtime as any).configured=true;
 (runtime as any).disabledServers={'mcp_servers.personal.enabled':false,'mcp_servers.application.enabled':false};
 const calls:any[]=[];runtime.rpc={request:async(method:string,params:any)=>{calls.push({method,params});return {thread:{id:'workspace-thread',turns:[]}};}} as any;
 runtime.configureWorkspace(process.cwd(),'Workspace context',{application:{command:'node',args:['tools.js']}},'chosen-model');
 await runtime.conversation();await runtime.conversation('workspace-thread');
 assert.equal(calls[0].params.sandbox,'workspace-write');assert.equal(calls[0].params.approvalPolicy,'on-request');assert.equal(calls[0].params.model,'chosen-model');
 assert.equal(calls[0].params.config['mcp_servers.personal.enabled'],false);assert.equal(calls[0].params.config['mcp_servers.application.enabled'],undefined);
 assert.deepEqual(calls[0].params.config['mcp_servers.application'],{command:'node',args:['tools.js']});
 assert.equal(calls[1].method,'thread/resume');assert.equal(calls[1].params.threadId,'workspace-thread');
 runtime.turnId='running';assert.throws(()=>runtime.configureWorkspace(process.cwd(),'',{}),/current turn/);
});
