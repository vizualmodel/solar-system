import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY} from '../src/lib/ephemeris';
import {AU} from '../src/lib/catalog';
import {satelliteAvailable,satelliteState,satelliteSnapshots,satelliteLaunchDates,satelliteAccuracy,SATELLITE_WINDOW,satelliteOrbitPath} from '../src/lib/satellites';
import {issCloseUp} from '../src/lib/satellite-demo';
import {REAL_TIME,playbackSpeeds,speedLabel} from '../src/lib/playback';
import {defaultSimulationState,newView,splitLayout,validateSimulationState} from '../src/lib/simulation-state';
for(const id of ['iss','hubble'] as const){
 test(`${id} visibility starts at orbital date and stays finite across decades`,()=>{
  const start=satelliteLaunchDates[id];assert.equal(satelliteAvailable(start-1,id),false);assert.equal(satelliteState(id,start-1),null);
  assert.equal(satelliteAvailable(start,id),true);assert.equal(satelliteAvailable(Infinity,id),false);
  for(let time=start;time<=Date.parse('2031-01-01T00:00:00Z');time+=137*DAY){
   const state=satelliteState(id,time)!;assert.ok(state);const r=Math.hypot(...Object.values(state.position));
   assert.ok(r>6600&&r<7200);assert.ok(Object.values(state.velocity).every(Number.isFinite));
  }
 });
 test(`${id} continuation meets SGP4 at both boundaries and reverses deterministically`,()=>{
  for(const sign of [-1,1]){
   const edge=satelliteSnapshots[id].epoch+sign*SATELLITE_WINDOW,a=satelliteState(id,edge)!,b=satelliteState(id,edge+sign)!;
   assert.equal(satelliteAccuracy(edge,id),'snapshot');assert.equal(satelliteAccuracy(edge+sign,id),'illustrative');
   assert.ok(Math.hypot(...Object.keys(a.position).map(k=>a.position[k as 'x']-b.position[k as 'x']))<0.009);
   assert.ok(Math.hypot(...Object.keys(a.velocity).map(k=>a.velocity[k as 'x']-b.velocity[k as 'x']))<0.00002);
  }
  const time=satelliteLaunchDates[id]+DAY,a=satelliteState(id,time);satelliteState(id,time+100*DAY);assert.deepEqual(satelliteState(id,time),a);
  assert.ok(satelliteOrbitPath(id,time,[0,1e-4,1e-4],0.001).every(p=>p.every(Number.isFinite)));
 });
}
test('ISS close-up preserves date/range/layout/other views and tracks at true scale and real time',()=>{
 const s=defaultSimulationState();s.playing=true;s.views.push(newView('other'));s.layout=splitLayout(s.layout,s.active,'other','row');
 s.views[0].cameraMode='surface';s.views[0].observer={latitude:0,longitude:0,altitude:0};
 const before=structuredClone(s),result=issCloseUp(s,s.active),v=result.views[0];
 assert.deepEqual(s,before);assert.deepEqual(result.views[1],s.views[1]);assert.deepEqual(result.layout,s.layout);
 for(const key of ['time','start','end','name','active'] as const)assert.equal(result[key],s[key]);
 assert.equal(result.speed*DAY,1000);assert.ok(playbackSpeeds.includes(REAL_TIME));assert.equal(speedLabel(REAL_TIME),'Real time');assert.equal(result.playing,false);
 assert.equal(v.satelliteFocus,'iss');assert.equal(v.focus,'earth');assert.equal(v.follow,true);assert.equal(v.cameraMode,'orbit');
 assert.deepEqual(v.target,[0,0,0]);assert.equal(v.satelliteSizes?.iss,1);assert.equal(v.size,1);assert.equal(v.moonScale,1);
 assert.ok(Math.hypot(...v.camera)*AU*1000>250&&Math.hypot(...v.camera)*AU*1000<350);
 assert.deepEqual(validateSimulationState(JSON.parse(JSON.stringify(result))),JSON.parse(JSON.stringify(result)));
 assert.throws(()=>issCloseUp({...s,time:Date.parse('1990-01-01T00:00:00Z')},s.active),/1998/);
});
