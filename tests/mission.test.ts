import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {missions,missionById,missionDuration,startMission,stopMission,seekMission,advanceMission,missionTime,missionElapsed,elapsedSeconds,validateMissionDocument,missionCaption} from '../src/lib/mission';
import {defaultSimulationState,validateSimulationState} from '../src/lib/simulation-state';
import {missionPose,validateMissionContext,historicalVector,METRES_PER_AU} from '../src/lib/mission-flight';
import {snapshot,assertRestored} from '../companion/state';
const doc=missions[0],context=validateMissionContext(JSON.parse(readFileSync('public/data/missions/apollo-11.json','utf8')));

test('Apollo document is a short authored mission with valid historical windows and captions',()=>{
 assert.equal(missionDuration(doc),855);assert.equal(doc.chapters.length,16);
 assert.equal(doc.launch,'1969-07-16T13:32:00Z');
 for(const bad of ['000:60:00','abc','0:0:0'])assert.throws(()=>elapsedSeconds(bad));
 const invalid=structuredClone(doc);invalid.chapters[1].start='000:00:00';assert.throws(()=>validateMissionDocument(invalid));
 const invalidMap=structuredClone(doc);invalidMap.chapters[5].timeMap![1].at=2;assert.throws(()=>validateMissionDocument(invalidMap));
});

test('mission start, seek, save/restore and stop preserve the entire previous workspace',()=>{
 const original=defaultSimulationState('earth');original.playing=true;original.speed=-1;original.views[0].populationGroups=['geo'];
 const before=structuredClone(original),active=startMission(original,'apollo-11');
 assert.deepEqual(original,before);assert.equal(active.playing,false);assert.deepEqual(active.mission!.returnState,before);
 const m=seekMission(active.mission!,5);m.elapsed=30;m.camera={position:[1e-8,2e-8,3e-8],target:[0,0,0]};
 active.mission=m;assert.deepEqual(validateSimulationState(JSON.parse(JSON.stringify(active))),active);
 const envelope=snapshot({schema:1,simulationState:active});assertRestored(envelope,structuredClone(envelope));
 const stopped=stopMission(active);assert.deepEqual(stopped,{...before,playing:false});
 assert.throws(()=>startMission(active,'apollo-11'),/Stop/);
 assert.throws(()=>validateSimulationState({...active,mission:{...m,returnState:active}}));
 assert.throws(()=>validateSimulationState({...active,mission:{...m,elapsed:Infinity}}));
 assert.throws(()=>seekMission(m,100));
});

test('playback advances authored chapters, jumps historical gaps, pauses, changes speed and completes',()=>{
 const initial=startMission(defaultSimulationState(),'apollo-11').mission!;
 assert.equal(advanceMission(initial,10),initial);
 const playing={...initial,playing:true,camera:{position:[1e-8,2e-8,3e-8] as [number,number,number],target:[0,0,0] as [number,number,number]}};
 const next=advanceMission(playing,doc.chapters[0].duration+10);assert.equal(next.chapter,1);assert.equal(next.elapsed,10);assert.equal(next.camera,undefined);
 const second=advanceMission({...playing,rate:2},5);assert.equal(second.elapsed,10);
 const jump=seekMission(next,5);assert.equal(jump.playing,false);assert.equal(missionElapsed(jump),elapsedSeconds(doc.chapters[5].start));
 const map={...jump,elapsed:doc.chapters[5].duration*.8};assert.equal(missionElapsed(map),elapsedSeconds('003:24:03'));assert.match(missionCaption(map),/docking/i);
 const finish=advanceMission(playing,missionDuration(doc)+20);assert.equal(finish.playing,false);assert.equal(finish.chapter,15);assert.equal(missionTime(finish),Date.parse('1969-07-24T16:50:35Z'));
 const again=seekMission(finish,0);assert.equal(again.elapsed,0);assert.equal(missionElapsed(again),0);
});

test('historical context covers the mission and reproduces stored JPL vectors without extrapolation',()=>{
 for(const row of context.bodies.moon.rows){const t=(row[0]-2440587.5)*86400000,p=historicalVector(context,'moon',t);assert.ok(Math.abs(p.length()*METRES_PER_AU/1000-Math.hypot(...row.slice(1,4)))<.01);}
 for(const seconds of [0,100000,400000,703115]){const t=Date.parse(doc.launch)+seconds*1000,r=historicalVector(context,'moon',t).length()*METRES_PER_AU;assert.ok(r>340000000&&r<420000000);}
 assert.throws(()=>historicalVector(context,'moon',Date.parse('2026-01-01Z')),/Outside/);
});

test('every chapter reconstructs finite physical scenes on direct seek, including reverse order',()=>{
 const initial=startMission(defaultSimulationState(),'apollo-11').mission!;
 for(let index=doc.chapters.length-1;index>=0;index--)for(const fraction of [0,.25,.5,.95,1]){
  const m={...seekMission(initial,index),elapsed:doc.chapters[index].duration*fraction},p=missionPose(context,m);
  for(const vector of [p.position,p.up,p.forward,p.moon,p.sun])assert.ok(vector.toArray().every(Number.isFinite),`${index} at ${fraction}`);
  assert.ok(Math.abs(p.up.length()-1)<1e-10);
  assert.ok(p.position.length()*METRES_PER_AU>=6371000-1,`Above Earth: ${index}`);
  assert.ok(p.position.distanceTo(p.moon)*METRES_PER_AU>=1737400-1,`Above Moon: ${index}`);
 }
 assert.equal(missionById.get(doc.id),doc);
});
