import test from 'node:test';
import assert from 'node:assert/strict';
import {Runtime} from '../src/runtime';
import {scenarioOperation} from '../src/scenarios';
const definition={id:'eclipse',title:'Spain eclipse',prompt:'Read state; use two cameras.',revision:'r1'};
test('scenario prompts become ordinary turns, with progress and approval state retained',async()=>{
 const runtime=new Runtime(process.cwd(),'','',async()=>{});runtime.threadId='thread';const calls:any[]=[];
 runtime.rpc={request:async(method:string,params:any)=>{calls.push({method,params});(runtime as any).notification({method:'turn/started',params:{threadId:'thread',turn:{id:'turn'}}});return {turn:{id:'turn',status:'inProgress'}};}} as any;
 await runtime.runScenario(definition);
 assert.equal(calls[0].method,'turn/start');assert.equal(calls[0].params.input[0].text,'# Spain eclipse\n\nRead state; use two cameras.');
 assert.equal(runtime.snapshot().scenarioRun?.status,'inProgress');
 runtime.approvals.set('pending',{id:'pending',method:'item/fileChange/requestApproval'});
 assert.equal(runtime.snapshot().approvals.length,1);
 await assert.rejects(runtime.runScenario(definition),/already running/);assert.equal(calls.length,1);
 (runtime as any).notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 assert.equal(runtime.snapshot().scenarioRun?.status,'completed');assert.equal(runtime.snapshot().approvals.length,0);
});
test('scenario save validates before invoking app persistence and never executes the prompt',async()=>{
 let saved:any;const repository={list:async()=>[{id:definition.id,title:definition.title,revision:definition.revision}],get:async()=>definition,save:async(value:any)=>{saved=value;return definition;}};
 await assert.rejects(scenarioOperation(repository,{action:'save',title:' ',prompt:'Task'}),/title/);assert.equal(saved,undefined);
 await assert.rejects(scenarioOperation(repository,{action:'save',title:'Title',prompt:'Task',path:'../escape'}));assert.equal(saved,undefined);
 const result=await scenarioOperation(repository,{action:'save',title:definition.title,prompt:definition.prompt});assert.equal(result.scenario?.id,'eclipse');assert.equal((saved as any).prompt,definition.prompt);
 assert.equal((await scenarioOperation(repository,{action:'get',id:'eclipse'})).scenario?.prompt,definition.prompt);
});
