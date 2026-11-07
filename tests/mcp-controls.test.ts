import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { defaultSimulationState } from '../src/lib/simulation-state';
import { z } from 'zod';
import { controlSchemas, parseControl } from '../companion/control-schema';
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{}}});
Object.defineProperty(globalThis,'location',{configurable:true,value:{search:''}});
const {simulationState}=await import('../src/lib/store');
const {applyBrowserRequest}=await import('../companion/browser-adapter');
const {workspaceUi}=await import('../src/lib/workspace-ui');
const {settingsSections}=await import('../src/lib/settings-sections');
const {tools}=await import('../companion/tools');
const request={id:'test',expiresAt:Date.now()+60000};
const call=(method:string,params:any={})=>applyBrowserRequest({...request,method,...params});

test('camera vectors expose portable numeric array schemas and require exactly three finite coordinates',()=>{
 const schema:any=z.toJSONSchema(z.object(controlSchemas.camera));
 for(const field of ['camera','target']){
  const vector=schema.properties.settings.properties[field];
  assert.equal(vector.type,'array');assert.equal(vector.items.type,'number');
  assert.equal(vector.minItems,3);assert.equal(vector.maxItems,3);assert.equal(vector.prefixItems,undefined);
 }
 assert.doesNotThrow(()=>parseControl('camera',{settings:{camera:[0,1,2],target:[0,0,0]}}));
 for(const camera of [[1,2],[1,2,3,4],[1,2,Infinity]])assert.throws(()=>parseControl('camera',{settings:{camera}}));
});

test('ISS close-up tool prepares an acknowledged true-size tracking view at real-time speed',()=>{
 const s=defaultSimulationState();s.playing=true;simulationState.set(s);
 call('satellites',{settings:{closeUp:'iss'}});const result=get(simulationState);
 assert.equal(result.time,s.time);assert.equal(result.speed,1/86400);assert.equal(result.playing,false);
 assert.equal(result.views[0].satelliteFocus,'iss');assert.equal(result.views[0].satelliteSizes?.iss,1);
 assert.equal(result.views[0].follow,true);assert.ok(Math.hypot(...result.views[0].camera)<1e-8);
});
test('compact tools expose strict nested schemas and atomic settings',()=>{
 assert.equal(tools.length+4,15);
 simulationState.set({...defaultSimulationState('earth'),playing:true});const before=get(simulationState);
 assert.throws(()=>call('scene',{settings:{size:0,stars:false}}));
 assert.throws(()=>call('scene',{settings:{unknown:true}}));
 assert.throws(()=>call('scene',{viewId:'missing',settings:{stars:false}}));
 assert.deepEqual(get(simulationState),before);
 call('scene',{settings:{stars:false,moonUmbra:true,visible:['earth','moon','sun']}});
 assert.equal(get(simulationState).playing,true);assert.equal(get(simulationState).time,before.time);
 assert.equal(get(simulationState).views[0].moonUmbra,true);
 call('camera',{settings:{mode:'surface',observer:{latitude:43,longitude:-5,altitude:200}}});
 assert.equal(get(simulationState).views[0].cameraMode,'surface');assert.equal(get(simulationState).views[0].size,1);
 const surface=get(simulationState);assert.throws(()=>call('scene',{settings:{size:50}}));assert.deepEqual(get(simulationState),surface);
 call('camera',{settings:{mode:'orbit',focus:'saturn',preset:'portrait',camera:[0,1,2],target:[0,0,0]}});
 assert.equal(get(simulationState).views[0].focus,'saturn');assert.deepEqual(get(simulationState).views[0].camera,[0,1,2]);
});
test('timeline clamping, import validation and view limits preserve unrelated state',()=>{
 simulationState.set({...defaultSimulationState('earth'),playing:true});const before=get(simulationState);
 call('timeline',{settings:{start:'2027-01-01T00:00:00Z',end:'2028-01-01T00:00:00Z',speed:-1}});
 assert.equal(get(simulationState).time,get(simulationState).start);assert.equal(get(simulationState).playing,true);
 assert.deepEqual(get(simulationState).views,before.views);
 call('timeline',{settings:{jump:'end'}});assert.equal(get(simulationState).time,get(simulationState).end);
 call('timeline',{settings:{stepSeconds:86400}});assert.equal(get(simulationState).time,get(simulationState).end);
 for(let i=0;i<5;i++)call('views',{action:'split',direction:i%2?'row':'column'});
 assert.equal(get(simulationState).views.length,6);const six=get(simulationState);
 assert.throws(()=>call('views',{action:'split'}));assert.deepEqual(get(simulationState),six);
 assert.throws(()=>call('views',{action:'layout',layout:{kind:'view',id:'bogus'}}));assert.deepEqual(get(simulationState),six);
 const exported=call('session',{action:'export'}) as any;assert.deepEqual(exported.simulationState,six);
 assert.throws(()=>call('session',{action:'import',simulationState:{version:9}}));assert.deepEqual(get(simulationState),six);
 call('session',{action:'import',simulationState:exported.simulationState});assert.equal(get(simulationState).playing,false);
 call('session',{action:'new',preset:'earth'});assert.equal(get(simulationState).views.length,1);
 assert.throws(()=>call('views',{action:'close'}));
});
test('workspace and chart settings reach UI stores and full observations',()=>{
 simulationState.set(defaultSimulationState());
 call('workspace',{settings:{charts:true,settings:false,tab:'camera',sections:{layers:false}}});
 call('charts',{settings:{from:'venus',to:'earth'}});
 assert.equal(get(workspaceUi).charts,true);assert.equal(get(workspaceUi).tab,'camera');assert.equal(get(settingsSections).layers,false);
 const full=call('get_simulation_state',{detail:'full'}) as any;assert.equal(full.ui.from,'venus');assert.equal(full.ui.to,'earth');
 const before=get(workspaceUi);assert.throws(()=>call('charts',{settings:{from:'unknown'}}));assert.deepEqual(get(workspaceUi),before);
});
test('tracking changes preserve world pose, and expired requests cannot change UI',()=>{
 simulationState.set(defaultSimulationState('earth'));const before=get(simulationState);
 const positions:any={earth:[1,2,3]};
 applyBrowserRequest({...request,method:'camera',settings:{follow:false}},{positions});
 const fixed=get(simulationState).views[0];
 assert.deepEqual(fixed.camera,before.views[0].camera.map((v,i)=>v+[1,3,-2][i]));
 applyBrowserRequest({...request,method:'camera',settings:{follow:true}},{positions});
 get(simulationState).views[0].camera.forEach((v,i)=>assert.ok(Math.abs(v-before.views[0].camera[i])<1e-12));
 const ui=get(workspaceUi);
 assert.throws(()=>applyBrowserRequest({...request,expiresAt:Date.now()-1,method:'workspace',settings:{about:true}}),/expired/);
 assert.deepEqual(get(workspaceUi),ui);
});
test('storage failure rejects session import before replacing the live scene',()=>{
 simulationState.set(defaultSimulationState('earth'));const before=get(simulationState);
 const storage=globalThis.localStorage;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:()=>{throw new Error('Blocked');}}});
 try{assert.throws(()=>call('session',{action:'import',simulationState:defaultSimulationState('inner')}),/storage unavailable/);assert.deepEqual(get(simulationState),before);}
 finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});}
});
test('closest-approach action uses chart pair and pauses at a computed result',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {nextClosestApproach}=await import('../src/lib/closest-approach');
 const data=JSON.parse(await readFile(new URL('../public/data/ephemeris.json',import.meta.url),'utf8'));
 simulationState.set({...defaultSimulationState(),time:Date.parse('2026-01-01T00:00:00Z'),playing:true});
 workspaceUi.update(v=>({...v,from:'earth',to:'mars'}));
 const before=get(simulationState);const expected=nextClosestApproach(data,'earth','mars',before.time,before.end)!;
 applyBrowserRequest({...request,method:'charts',settings:{nextClosestApproach:true}},{data});
 assert.equal(get(simulationState).time,expected.time);assert.equal(get(simulationState).playing,false);
 assert.deepEqual(get(simulationState).views,before.views);
 const initial=get(simulationState),ui=get(workspaceUi);
 assert.throws(()=>applyBrowserRequest({...request,method:'charts',settings:{from:'earth',to:'earth',nextClosestApproach:true}},{data}));
 assert.deepEqual(get(simulationState),initial);assert.deepEqual(get(workspaceUi),ui);
});
