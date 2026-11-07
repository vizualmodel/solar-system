import test from 'node:test';
import assert from 'node:assert/strict';
import { Runtime } from '../src/runtime';

test('missing saved history creates one replacement without replaying messages', async () => {
 const saved: string[] = [], calls: string[] = [];
 const runtime = new Runtime('.', 'unused', 'unused', async id => { saved.push(id); });
 (runtime as any).configured = true;
 runtime.rpc = { request: async (method: string) => { calls.push(method); if(method==='thread/resume') throw Error('no rollout found for thread id missing'); return {thread:{id:'replacement',turns:[]}}; } } as any;
 await runtime.conversation('missing');
 assert.deepEqual(calls,['thread/resume','thread/start']);
 assert.deepEqual(saved,['replacement']);
 assert.equal(runtime.snapshot().status,'Ready');
 assert.equal(runtime.snapshot().busy,false);
 assert.match(runtime.snapshot().notice!,/not been recovered or replayed/);
 await runtime.conversation('replacement');
 assert.deepEqual(calls,['thread/resume','thread/start']);
});

test('unrelated resume errors preserve history identity and release panel busy state', async () => {
 const runtime = new Runtime('.', 'unused', 'unused', async () => { assert.fail('must not replace saved ID'); });
 (runtime as any).configured = true;
 runtime.threadId='existing';runtime.status='Disconnected';
 const states: any[]=[];runtime.on('change',s=>states.push(s));
 runtime.rpc = {request:async()=>{throw Error('permission denied')}} as any;
 await assert.rejects(runtime.conversation('existing'),/permission denied/);
 assert.equal(runtime.threadId,'existing');assert.equal(states.at(-1).busy,false);
 assert.equal(runtime.notice,null);
});

test('replacement failure does not persist a replacement ID', async () => {
 const runtime = new Runtime('.', 'unused', 'unused', async()=>assert.fail('must not save'));
 (runtime as any).configured=true;
 runtime.rpc={request:async(method:string)=>{throw Error(method==='thread/resume'?'no rollout found for thread id missing':'startup failed')}} as any;
 await assert.rejects(runtime.conversation('missing'),/startup failed/);
 assert.equal(runtime.snapshot().busy,false);assert.equal(runtime.threadId,undefined);
});
