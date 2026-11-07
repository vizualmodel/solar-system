import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { positions as orbitalPositions,type Ephemeris } from '../src/lib/ephemeris';
import { PerspectiveCamera,Vector3 } from 'three';
import { SolarRenderer } from '../src/lib/renderer';
import { interactiveEclipsePose,manualCameraPatch,surfaceCamera,alignmentCamera,OVIEDO,SPAIN_ECLIPSE_TIME,spainEclipseState,solarContactGap } from '../src/lib/eclipse-camera';
import { defaultSimulationState,validateSimulationState } from '../src/lib/simulation-state';
import { snapshot,assertRestored } from '../companion/state';
const positions={earth:[1,0,0],moon:[0.998,0,0],sun:[0,0,0]} as Record<string,[number,number,number]>;

test('Spain preset starts at first external contact with a wider Sun-centred view',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/data/ephemeris.json',import.meta.url),'utf8')) as Ephemeris;
 const gap=(time:number)=>solarContactGap(OVIEDO,time,orbitalPositions(data,time));
 // This is the entering limb crossing, not maximum eclipse or the final contact.
 for(let time=Date.parse('2026-08-12T14:00:00Z');time<SPAIN_ECLIPSE_TIME-1000;time+=60000)assert.ok(gap(time)>0);
 assert.ok(gap(SPAIN_ECLIPSE_TIME-1000)>0);
 assert.ok(gap(SPAIN_ECLIPSE_TIME+1000)<0);
 assert.ok(Math.abs(gap(SPAIN_ECLIPSE_TIME))<3e-9);
 const input=defaultSimulationState(),state=spainEclipseState(input);
 assert.equal(state.time,SPAIN_ECLIPSE_TIME);assert.equal(state.views.length,input.views.length+1);
 const pose=surfaceCamera(OVIEDO,state.time,orbitalPositions(data,state.time));
 assert.equal(pose.fov,8);assert.deepEqual(state.views.find(v=>v.id===state.active)!.observer,OVIEDO);
 const direction=new Vector3(...pose.target).sub(new Vector3(...pose.camera)).normalize();
 const earth=orbitalPositions(data,state.time).earth;
 const sunDirection=new Vector3(-earth[0],-earth[2],earth[1]).sub(new Vector3(...pose.camera)).normalize();
 assert.ok(direction.distanceTo(sunDirection)<1e-12);
});

for(const mode of ['surface','alignment'] as const){
 test(`${mode}: local gesture pivot preserves the initial framing`,()=>{
  const original=mode==='surface'?surfaceCamera(OVIEDO,SPAIN_ECLIPSE_TIME,positions):alignmentCamera(positions);
  const interactive=interactiveEclipsePose(original,mode);
  const before=new Vector3(...original.target).sub(new Vector3(...original.camera)).normalize();
  const after=new Vector3(...interactive.target).sub(new Vector3(...interactive.camera)).normalize();
  assert.ok(before.distanceTo(after)<1e-12);assert.deepEqual(interactive.camera,original.camera);
  assert.deepEqual(interactive.up,original.up);assert.equal(interactive.fov,original.fov);
  assert.ok(new Vector3(...interactive.target).distanceTo(new Vector3(...interactive.camera))<0.002);
 });
 test(`${mode}: capture skips automatic poses, then persists gestures and restoration`,()=>{
  const s=spainEclipseState(defaultSimulationState());const view=s.views.find(v=>v.cameraMode===mode)!;
  const pose=interactiveEclipsePose(mode==='surface'?surfaceCamera(OVIEDO,s.time,positions):alignmentCamera(positions),mode);
  const camera=new PerspectiveCamera(pose.fov);camera.position.fromArray(pose.camera);camera.up.fromArray(pose.up);
  const target=new Vector3(...pose.target);let captures=0;
  // Exercise the renderer's real event/capture boundary without constructing a WebGL context.
  const renderer=Object.assign(Object.create(SolarRenderer.prototype),{config:view,camera,frameTime:s.time,controls:{target},onCamera:(p:any,t:any,patch:any)=>{captures++;Object.assign(view,{camera:p,target:t,...patch});}});
  renderer.captureCamera();assert.equal(captures,0);assert.equal(view.manualCamera,undefined);
  renderer.captureCamera(true);assert.equal(captures,1);assert.deepEqual(view.manualCamera!.up,pose.up);assert.equal(view.manualCamera!.fov,pose.fov);
  camera.position.x+=1e-6;target.z+=2e-6;renderer.captureCamera(false,true);assert.equal(captures,2);
  assert.equal(view.camera[0],camera.position.x);assert.equal(view.target[2],target.z);
  const expected=snapshot(JSON.parse(JSON.stringify({schema:1,simulationState:s})));assertRestored(expected,JSON.parse(JSON.stringify(expected)));
  assert.deepEqual(validateSimulationState(JSON.parse(JSON.stringify(s))),expected.simulationState);
  const reset=spainEclipseState(s);assert.equal(reset.views.find(v=>v.id===s.active)!.manualCamera,undefined);
 });
}
test('manual camera validation rejects invalid lens/up data and preserves old scenarios',()=>{
 const s=defaultSimulationState();assert.deepEqual(validateSimulationState(s),s);
 for(const manualCamera of [{up:[0,0,0],fov:2},{up:[0,1,0],fov:NaN},{up:[0,1,0],fov:180}]){
  (s.views[0] as any).manualCamera=manualCamera;assert.throws(()=>validateSimulationState(s),/manual camera/);
 }
 const pose={camera:[0,0,0.001],target:[0,0,0],up:[0,1,0],fov:2} as const;
 const patch=manualCameraPatch({camera:[...pose.camera],target:[...pose.target],up:[...pose.up],fov:pose.fov});
 assert.equal(patch.manualCamera!.fov,2);
});
