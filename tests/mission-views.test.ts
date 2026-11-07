import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import {defaultSimulationState,validateSimulationState} from '../src/lib/simulation-state';
import {startMission,seekMission,advanceMission,missionById} from '../src/lib/mission';
import {splitMissionView,closeMissionView,updateMissionView,missionViews,missionLayout} from '../src/lib/mission-views';
import {missionCameraFrame} from '../src/lib/mission-camera';
import {missionTelemetry} from '../src/lib/mission-telemetry';
import {validateMissionContext,earthFlight,surfaceDirection,METRES_PER_AU} from '../src/lib/mission-flight';
import {ApolloExhaust,LaunchSmoke,createLaunchPad,engineConfiguration} from '../src/lib/apollo-launch';
import {disposeApolloObjects} from '../src/lib/apollo-mesh';
const context=validateMissionContext(JSON.parse(readFileSync('public/data/missions/apollo-11.json','utf8')));
const initial=()=>startMission(defaultSimulationState('earth'),'apollo-11');
test('mission splits, closes and saves independent cameras without touching the suspended workspace',()=>{
 const s=initial(),before=structuredClone(s.mission!.returnState);let m=s.mission!;
 m=splitMissionView(m,'mission-primary','overview','row');m=splitMissionView(m,'overview','craft','column');
 m=updateMissionView(m,'craft',{camera:{position:[1e-8,2e-8,3e-8],target:[0,0,0],up:[0,1,0]}});
 assert.equal(m.views!.length,3);assert.equal(m.active,'craft');assert.equal(m.views![1].mode,'overview');assert.equal(m.views![2].mode,'spacecraft');
 const sought=seekMission(m,6);assert.deepEqual(sought.views![2].camera,m.views![2].camera);assert.equal(sought.views![0].camera,undefined);
 assert.deepEqual(validateSimulationState(JSON.parse(JSON.stringify({...s,mission:sought}))).mission,JSON.parse(JSON.stringify(sought)));
 assert.deepEqual(sought.returnState,before);m=closeMissionView(closeMissionView(m,'overview'),'mission-primary');assert.deepEqual(missionLayout(m),{kind:'view',id:'craft'});assert.throws(()=>closeMissionView(m,'craft'));
 while(missionViews(m).length<6)m=splitMissionView(m,'craft',`v${missionViews(m).length}`,'row');assert.throws(()=>splitMissionView(m,'craft','seventh','row'));
});
test('legacy single-camera saves remain valid and malformed layouts/settings fail',()=>{
 const s=initial(),m=s.mission!;delete m.views;delete m.layout;delete m.active;m.camera={position:[1e-8,2e-8,3e-8],target:[0,0,0]};
 assert.deepEqual(validateSimulationState(s),s);assert.equal(missionViews(m).length,1);assert.equal(m.views,undefined);
 for(const patch of [{audioVolume:2},{dashboardVisible:'yes'},{views:[{id:'x',mode:'guided'}],active:'x',layout:{kind:'view',id:'missing'}}])assert.throws(()=>validateSimulationState({...s,mission:{...m,...patch}}));
});
test('all mission camera viewpoints have finite physical frames at each chapter',()=>{
 const m=initial().mission!;
 for(let chapter=0;chapter<16;chapter++)for(const mode of ['guided','spacecraft','overview','earth','moon','pad'] as const){const f=missionCameraFrame(context,seekMission(m,chapter),{id:'test',mode});assert.ok(f.origin.toArray().every(Number.isFinite));assert.ok(f.distance>0);assert.ok(Math.abs(f.up.length()-1)<1e-9);}
 const pad=missionCameraFrame(context,m,{id:'test',mode:'pad'});assert.ok(pad.origin.distanceTo(earthFlight(0))*METRES_PER_AU<10);
});
test('telemetry measures historical motion independently of presentation speed and pause',()=>{
 const m={...initial().mission!,elapsed:20},a=missionTelemetry(context,m),b=missionTelemetry(context,{...m,rate:2,playing:true});assert.deepEqual(a,b);assert.ok(a.speed>0&&a.speed<15);assert.ok(a.earthAltitude>0);
 for(let chapter=0;chapter<16;chapter++){const state=seekMission(m,chapter);for(const elapsed of [0,missionById.get(m.id)!.chapters[chapter].duration])assert.ok(Object.values(missionTelemetry(context,{...state,elapsed})).every(n=>Number.isFinite(n)&&n>=0));}
 const up=surfaceDirection('earth',Date.parse('1969-07-16T13:32:10Z'),28.608,-80.604);assert.ok(earthFlight(10).clone().normalize().angleTo(up)<.001);
});
test('staged engine plumes and launch smoke reconstruct identically after seeking',()=>{
 assert.equal(engineConfiguration('launch',150,0)!.count,5);assert.equal(engineConfiguration('launch',600,0)!.count,1);assert.equal(engineConfiguration('parking',800,0),null);assert.equal(engineConfiguration('surface',370000,0),null);
 const e=new ApolloExhaust(),smoke=new LaunchSmoke(),pad=createLaunchPad();e.update('launch',10,.1);smoke.update(10);const first=smoke.group.children.map(c=>c.position.toArray());smoke.update(40);smoke.update(10);assert.deepEqual(smoke.group.children.map(c=>c.position.toArray()),first);smoke.update(200);assert.equal(smoke.group.visible,false);e.update('surface',370000,0);assert.equal(e.group.visible,false);assert.ok(pad.children.length>50);disposeApolloObjects([e.group,smoke.group,pad]);
});
