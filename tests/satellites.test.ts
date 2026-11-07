import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { get } from 'svelte/store';
import { AU } from '../src/lib/catalog';
import { DAY,type Vec3 } from '../src/lib/ephemeris';
import { hubbleEpoch,hubblePeriod,hubbleState,hubbleRelativePosition,hubbleOrbitPath,satelliteAvailable,SATELLITE_WINDOW,withSatellitePositions,temeToEcliptic } from '../src/lib/satellites';
import { createHubbleMesh } from '../src/lib/hubble-mesh';
import { displayPosition,changeTracking } from '../src/lib/presentation';
import { defaultSimulationState,validateSimulationState,splitLayout,newView } from '../src/lib/simulation-state';
import { exploreHubble } from '../src/lib/satellite-demo';
import { MINUTE_PER_SECOND } from '../src/lib/playback';

test('bundled Hubble elements produce a plausible low Earth orbit and continuous motion',()=>{
 assert.ok(hubblePeriod/60000>90&&hubblePeriod/60000<100);
 for(let i=0;i<=24;i++){
  const time=hubbleEpoch+(i/24-0.5)*2*SATELLITE_WINDOW,state=hubbleState(time)!;
  assert.ok(state);
  const radius=Math.hypot(...Object.values(state.position));
  assert.ok(radius>6700&&radius<7100);
  assert.ok(Math.hypot(...Object.values(state.velocity))>7&&Math.hypot(...Object.values(state.velocity))<8);
  const latitude=Math.asin(state.position.z/radius)*180/Math.PI;
  assert.ok(Math.abs(latitude)<29);
  const a=hubbleRelativePosition(time)!,b=hubbleRelativePosition(time+100)!;
  if(b)assert.ok(Math.hypot(...a.map((v,j)=>v-b[j]))*AU<1);
 }
});
test('satellite remains visible beyond snapshot without unbounded SGP4 extrapolation',()=>{
 for(const sign of [-1,1]){
  assert.equal(satelliteAvailable(hubbleEpoch+sign*SATELLITE_WINDOW),true);
  assert.equal(satelliteAvailable(hubbleEpoch+sign*(SATELLITE_WINDOW+1)),true);
 }
 assert.ok(hubbleRelativePosition(hubbleEpoch+365*DAY));
 assert.equal(satelliteAvailable(NaN),false);
 const earth={earth:[1,2,3] as Vec3};
 assert.ok(withSatellitePositions(earth,hubbleEpoch+365*DAY).hubble);
});
test('TEME conversion preserves distance; Earth translation and moon spread do not alter satellite altitude',()=>{
 const state=hubbleState(hubbleEpoch)!,p=temeToEcliptic(state.position,hubbleEpoch);
 assert.ok(Math.abs(Math.hypot(...p)*AU-Math.hypot(...Object.values(state.position)))<1e-9);
 const positions=withSatellitePositions({earth:[1,2,3]},hubbleEpoch);
 const before=structuredClone(positions),a=displayPosition('hubble',positions,1),b=displayPosition('hubble',positions,100);
 assert.deepEqual(a,b);assert.deepEqual(positions,before);
 const r=positions.hubble.map((v,i)=>v-positions.earth[i]);
 assert.ok(Math.abs(Math.hypot(...r)*AU-Math.hypot(...Object.values(state.position)))<1e-7);
 assert.ok(displayPosition('hubble',{earth:[1,2,3]},100).every(Number.isFinite));
});
test('SGP4 orbit trail meets the satellite exactly and reverse scrubbing is deterministic',()=>{
 const time=hubbleEpoch+10000,before=hubbleRelativePosition(time)!;
 const path=hubbleOrbitPath(time,[0,0.0001,0.00015],0.001);
 assert.ok(path.length>64&&path.length<10000);
 assert.ok(path.some(p=>p.every(v=>v===0)));
 assert.ok(path.every(p=>p.every(Number.isFinite)));
 assert.ok(Math.hypot(...path[0].map((v,i)=>v-path.at(-1)![i]))>1e-12,'precession keeps the trail open');
 hubbleRelativePosition(time+DAY);hubbleRelativePosition(time-DAY);
 assert.deepEqual(hubbleRelativePosition(time),before);
});
test('simplified Hubble mesh has telescope and solar panels in metre-scale dimensions',()=>{
 const mesh=createHubbleMesh(),box=new Box3().setFromObject(mesh);
 assert.ok(mesh.children.length>10);
 assert.ok(Math.abs(box.max.y-box.min.y-13.2)<0.02);
 assert.ok(Math.abs(box.max.x-box.min.x-20)<0.05);
 assert.ok(box.max.z-box.min.z>=4.19);
 mesh.traverse(object=>{const part=object as import('three').Mesh;part.geometry?.dispose();if(part.material)for(const material of Array.isArray(part.material)?part.material:[part.material])material.dispose();});
});
test('Hubble demo changes the shared epoch and selected view while preserving other views and layout',()=>{
 const s=defaultSimulationState();s.views.push(newView('other'));s.layout=splitLayout(s.layout,'primary','other','row');
 const before=structuredClone(s),demo=exploreHubble(s,'primary');
 assert.deepEqual(s,before);assert.deepEqual(demo.views[1],s.views[1]);assert.deepEqual(demo.layout,s.layout);
 assert.equal(demo.time,hubbleEpoch);assert.equal(demo.playing,false);assert.equal(demo.speed,MINUTE_PER_SECOND);
 assert.equal(demo.views[0].size,1);assert.ok(demo.views[0].satellites?.includes('hubble'));
 assert.deepEqual(validateSimulationState(JSON.parse(JSON.stringify(demo))),demo);
 assert.throws(()=>exploreHubble({...s,start:hubbleEpoch+DAY,end:hubbleEpoch+2*DAY},'primary'),/outside/);
});
test('satellite options validate without expanding old simulationState receipts; tracking uses satellite origin',()=>{
 const s=defaultSimulationState();assert.equal(Object.hasOwn(validateSimulationState(s).views[0],'satellites'),false);
 const view=s.views[0];view.satellites=['hubble'];view.satelliteSize=10000;view.satelliteFocus='hubble';
 assert.deepEqual(validateSimulationState(s),s);
 const positions=withSatellitePositions({earth:[1,2,3]},hubbleEpoch);
 const result=changeTracking(view,positions),origin=displayPosition('hubble',positions,view.moonScale);
 assert.deepEqual(result.camera,view.camera.map((v,i)=>v+origin[i]));
 for(const patch of [{satellites:['unknown']},{satelliteSize:NaN},{satelliteSize:0},{satelliteFocus:'unknown'}]){
  const invalid=structuredClone(s);Object.assign(invalid.views[0],patch);assert.throws(()=>validateSimulationState(invalid));
 }
});

Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
Object.defineProperty(globalThis,'location',{configurable:true,value:{search:''}});
const {simulationState}=await import('../src/lib/store');
const {focus}=await import('../src/lib/focus');
test('satellite close-up uses Earth as its persistent parent and planet focus clears satellite tracking',()=>{
 simulationState.set(exploreHubble(defaultSimulationState(),'primary'));focus('primary','hubble');
 const selected=get(simulationState).views[0];
 assert.equal(selected.focus,'earth');assert.equal(selected.satelliteFocus,'hubble');assert.ok(selected.satellites?.includes('hubble'));
 assert.ok(Math.hypot(...selected.camera)>1e-7);
 focus('primary','iss');assert.equal(get(simulationState).views[0].satelliteFocus,'iss');
 assert.deepEqual(get(simulationState).views[0].satellites,['hubble','iss']);
 focus('primary','mars');assert.equal(get(simulationState).views[0].satelliteFocus,null);
});
