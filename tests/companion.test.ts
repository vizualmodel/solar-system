import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { Rpc } from '@vizualmodel/companion/rpc';
import { BrowserSession } from '@vizualmodel/companion/browser-session';
import { activate as activateCore, type ActivationHost } from '@vizualmodel/companion/activation';
const activate = (host: ActivationHost, candidate: any, previous: any) => activateCore(host, candidate, previous, { snapshot, assertRestored });
import { snapshot, assertRestored,restorationReceipt } from '../companion/state';
import { defaultSimulationState } from '../src/lib/simulation-state';
import { Runtime } from '@vizualmodel/companion/runtime';
import { mergePanelSession } from '@vizualmodel/companion/panel-session';

test('serialized runtime completion clears panel turn state and permits a second message', async () => {
  const runtime = new Runtime('.', 'http://127.0.0.1:5180', 'unused', async () => {});
  runtime.threadId = 'conversation';
  let count = 0;
  runtime.rpc = { request: async () => ({ turn: { id: `turn-${++count}`, status: 'inProgress' } }) } as any;
  let panel: Record<string, any> = { connected: true, buildProgress: 'retained local display' };
  runtime.on('change', snapshot => { panel = mergePanelSession(panel, JSON.parse(JSON.stringify(snapshot))); });
  await runtime.submit('First message');
  assert.equal(panel.turnId, 'turn-1');
  (runtime as any).notification({ method: 'turn/completed', params: { threadId: 'conversation', turn: { id: 'turn-1', status: 'completed' } } });
  assert.equal(panel.status, 'Ready');
  assert.equal(panel.turnId, null);
  assert.equal(panel.buildProgress, 'retained local display');
  await runtime.submit('Second message');
  assert.equal(panel.turnId, 'turn-2');
  for (const status of ['interrupted', 'failed']) {
    (runtime as any).notification({ method: 'turn/completed', params: { threadId: 'conversation', turn: { id: runtime.turnId, status } } });
    assert.equal(panel.turnId, null);
    assert.equal(JSON.parse(JSON.stringify(runtime.snapshot())).turnId, null);
    if (status === 'interrupted') await runtime.submit('Third message');
  }
});

test('a snapshot from an older runtime also clears the previous turn after completion or reconnect', () => {
  const waiting = { status: 'Working', turnId: 'old-turn', threadId: 'conversation', connected: false };
  const wire = JSON.parse(JSON.stringify({ status: 'Ready', turnId: undefined, threadId: 'conversation' }));
  const ready = mergePanelSession(waiting, wire);
  assert.equal(ready.turnId, null);
  assert.equal(ready.connected, true);
  assert.equal(ready.threadId, 'conversation');
});

function child() { return Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), kill() {} }); }
test('app-server correlates out-of-order responses, propagates errors, and fails pending calls on exit', async () => {
  const process = child(); const rpc = new Rpc(process as any);
  const a = rpc.request('a'), b = rpc.request('b');
  process.stdout.write('{"id":2,"result":"second"}\n{"id":1,"result":"first"}\n');
  assert.deepEqual(await Promise.all([a,b]), ['first','second']);
  const error = assert.rejects(rpc.request('error'), /denied/);
  process.stdout.write('{"id":3,"error":{"message":"denied"}}\n'); await error;
  const pending = assert.rejects(rpc.request('pending'), /stopped/); process.emit('exit', 1); await pending;
  await assert.rejects(rpc.request('later'), /disconnected/);
});
test('app-server timeout ignores a late response and forwards runtime approval requests', async () => {
  const process = child(); const rpc = new Rpc(process as any);
  await assert.rejects(rpc.request('slow', {}, 10), /timed out/);
  process.stdout.write('{"id":1,"result":true}\n');
  let approval: any; rpc.on('request', request => approval = request);
  process.stdout.write('{"id":7,"method":"item/fileChange/requestApproval","params":{}}\n');
  assert.equal(approval.id, 7); rpc.close();
});
function socket() { return Object.assign(new EventEmitter(), { readyState: 1, sent: [] as any[], send(raw:string) { this.sent.push(JSON.parse(raw)); } }); }
test('browser requests require readiness and acknowledgement; disconnected views can transfer control', async () => {
  const browser = new BrowserSession(), first = socket(); browser.claim(first as any, 'owner', 'build');
  await assert.rejects(browser.request('get'), /not ready/); browser.ready = true;
  const request = browser.request('get'); browser.reply({ id: 'wrong', result: 'wrong' });
  browser.reply({ id: first.sent[0].id, result: 'actual' }); assert.equal(await request, 'actual');
  assert.throws(()=>browser.claim(socket() as any,'other','build'), /Another view/);
  const pending = assert.rejects(browser.request('get'), /disconnected/); first.emit('close'); await pending;
  const replacement = socket(); browser.claim(replacement as any,'other','build'); assert.equal(replacement.sent.length, 0);
  assert.equal(browser.owner,'other');assert.equal(browser.ready,false);
  assert.throws(()=>browser.claim(socket() as any,'owner','build'), /Another view/);
});
test('browser timeout never replays a request', async () => {
  const browser = new BrowserSession(), ws = socket(); browser.claim(ws as any,'owner','build'); browser.ready=true;
  await assert.rejects(browser.request('set',{},10), /timed out/); browser.reply({ id: ws.sent[0].id, result: true });
  assert.equal(ws.sent.length,1);
});
test('activation captures immediately before selection and verifies all state', async () => {
  const saved = snapshot({ schema:1, simulationState:{...defaultSimulationState(),playing:true} });
  const events:string[]=[];
  const result=await activate({capture:async()=>{events.push('capture');return saved;}, select:async b=>{events.push(`select:${b.id}`);}, reload:()=>{events.push('reload');}, restore:async()=>structuredClone(saved),commit:async()=>{events.push('commit');}}, {id:'new'}, {id:'old'});
  assert.deepEqual(events,['capture','select:new','reload','commit']); assert.equal(result.restored,true);
});
test('failed restoration restores prior build and state without source operations', async () => {
  const saved = snapshot({schema:1,simulationState:defaultSimulationState()}); const selected:string[]=[];
  await assert.rejects(activate({ capture:async()=>saved, select:async b=>{selected.push(b.id);},reload:()=>{},restore:async b=>b.id==='bad'?{...saved,simulationState:{...saved.simulationState,speed:99}}:saved,commit:async()=>{} },{id:'bad'},{id:'old'}),/Previous build restored/);
  assert.deepEqual(selected,['bad','old']);
});
test('failed load and failed recovery remain explicit; unsupported schema cannot activate', async () => {
  const saved = snapshot({schema:1,simulationState:defaultSimulationState()}); let selected=0;
  const host={capture:async()=>saved,select:async()=>{selected++;},reload:()=>{},restore:async()=>{throw new Error('load timeout');},commit:async()=>{}};
  await assert.rejects(activate(host,{id:'bad'},{id:'old'}),/recovery needs attention/); assert.equal(selected,2);
  await assert.rejects(activate({...host,capture:async()=>({schema:2})},{id:'bad'},{id:'old'}),/Unsupported/); assert.equal(selected,2);
});
test('restored camera readback tolerates floating-point rounding but not a changed pose or time', () => {
  const before = snapshot({schema:1,simulationState:defaultSimulationState()});
  const after = structuredClone(before); after.simulationState.views[0].camera[0] += 1e-13;
  assert.doesNotThrow(()=>assertRestored(before,after));
  after.simulationState.views[0].camera[0] += 0.001;
  assert.throws(()=>assertRestored(before,after),/differs/);
  const wrongTime=structuredClone(before);wrongTime.simulationState.time+=1;
  assert.throws(()=>assertRestored(before,wrongTime),/differs/);
});
test('older companion gets its captured field set back without dropping the new UI default',()=>{
 const captured=snapshot({schema:1,simulationState:defaultSimulationState()});
 delete (captured.simulationState.views[0] as Partial<typeof captured.simulationState.views[0]>).moonPenumbra;
 const actual=snapshot(captured),receipt=restorationReceipt(captured,actual);
 assert.deepEqual(receipt,captured);assert.equal(actual.simulationState.views[0].moonPenumbra,false);
 actual.simulationState.views[0].moonPenumbra=true;
 assert.equal(restorationReceipt(captured,actual).simulationState.views[0].moonPenumbra,true);
 const modern=snapshot(captured);
 assert.deepEqual(restorationReceipt(modern,modern),modern);
});
