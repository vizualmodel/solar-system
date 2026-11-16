import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {get} from 'svelte/store';
import {defaultSimulationState} from '../src/lib/simulation-state';

// Domain adapter tests only; these stubs do not establish browser acceptance.
Object.assign(globalThis,{localStorage:{getItem:()=>null,setItem:()=>{}},location:{search:''},window:{dispatchEvent:()=>true}});
const {simulationState}=await import('../src/lib/store');
const {renderedViews}=await import('../model-service/readiness');
const {executeModelControl}=await import('../src/model-integration/control-adapter');
const request=()=>({id:crypto.randomUUID(),expiresAt:Date.now()+30000});

test('grouped Bridge controls acknowledge actual state and preserve unrelated views and playback',async()=>{
 const before=defaultSimulationState();before.playing=true;simulationState.set(before);
 renderedViews.clear();for(const view of before.views)renderedViews.add(view.id);
 const result=await executeModelControl('timeline',{settings:{time:'2026-01-01T00:00:00Z'},detail:'full'},request());
 assert.equal(get(simulationState).time,Date.parse('2026-01-01T00:00:00Z'));
 assert.equal(get(simulationState).playing,true);assert.deepEqual(get(simulationState).views,before.views);
 assert.ok(result.state);assert.deepEqual(result.state.simulationState,get(simulationState));
 const unchanged=structuredClone(get(simulationState));
 await assert.rejects(executeModelControl('timeline',{settings:{playing:false}}, {...request(),expiresAt:Date.now()-1}),/expired/i);
 assert.deepEqual(get(simulationState),unchanged);
});

test('disconnect while camera data loads prevents the delayed mutation',async()=>{
 const before=defaultSimulationState();simulationState.set(before);
 const oldFetch=globalThis.fetch;let loaded!:(response:Response)=>void,active=true;
 globalThis.fetch=()=>new Promise<Response>(resolve=>loaded=resolve);
 try{
  const pending=executeModelControl('camera',{settings:{focus:'earth'}},request(),()=>{if(!active)throw Error('Disconnected');});
  active=false;loaded(new Response(readFileSync(new URL('../public/data/ephemeris.json',import.meta.url),'utf8')));
  await assert.rejects(pending,/Disconnected/);assert.deepEqual(get(simulationState),before);
 }finally{globalThis.fetch=oldFetch;}
});
