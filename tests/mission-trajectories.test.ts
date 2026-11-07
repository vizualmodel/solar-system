import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startMission,seekMission,missionById,elapsedSeconds} from '../src/lib/mission';
import {defaultSimulationState,validateSimulationState} from '../src/lib/simulation-state';
import {validateMissionContext,historicalVector,transferPoint,METRES_PER_AU} from '../src/lib/mission-flight';
import {moonMissionTrajectory,spacecraftMissionTrajectory,missionTrajectoriesVisible} from '../src/lib/mission-trajectories';
const context=validateMissionContext(JSON.parse(readFileSync('public/data/missions/apollo-11.json','utf8')));
const initial=()=>startMission(defaultSimulationState('earth'),'apollo-11');

test('Moon arc covers the mission once in fixed Earth-relative axes, independently of chapter or playback',()=>{
 const m=initial().mission!,doc=missionById.get(m.id)!,points=moonMissionTrajectory(context,m);
 const launch=Date.parse(doc.launch),end=launch+elapsedSeconds(doc.chapters.at(-1)!.end)*1000;
 assert.equal(points.length,257);
 assert.deepEqual(points[0],historicalVector(context,'moon',launch));assert.deepEqual(points.at(-1),historicalVector(context,'moon',end));
 assert.ok(points[0].angleTo(points.at(-1)!)>1.5);assert.ok(points[0].angleTo(points.at(-1)!)<2.5);
 for(const p of points)assert.ok(p.length()*METRES_PER_AU>340e6&&p.length()*METRES_PER_AU<420e6);
 assert.deepEqual(moonMissionTrajectory(context,{...seekMission(m,14),playing:true,rate:2}),points);
 assert.ok(context.bodies.moon.sourceUrl.includes('500%40399'), 'JPL Moon vectors are relative to Earth');
});

test('spacecraft path switches transfer legs on lunar departure and retains a complete parking orbit',()=>{
 const m=initial().mission!,out=spacecraftMissionTrajectory(context,seekMission(m,6)),home=spacecraftMissionTrajectory(context,seekMission(m,14));
 assert.deepEqual(out[0],transferPoint(context,2*3600+50*60));assert.deepEqual(out.at(-1),transferPoint(context,75*3600+50*60));
 assert.deepEqual(home[0],transferPoint(context,135*3600+23*60+42,true));assert.deepEqual(home.at(-1),transferPoint(context,195*3600+3*60,true));
 assert.deepEqual(spacecraftMissionTrajectory(context,seekMission(m,13)),home);
 const parking=spacecraftMissionTrajectory(context,seekMission(m,3));assert.ok(parking[0].distanceTo(parking.at(-1)!)<1e-12);
});

test('one persisted trajectory switch applies to every wide view and legacy saves default to visible',()=>{
 const state=initial(),m=seekMission(state.mission!,6);
 assert.equal(missionTrajectoriesVisible(m,{id:'story',mode:'guided'}),true);
 for(const mode of ['overview','earth','moon'] as const){assert.equal(missionTrajectoriesVisible(m,{id:mode,mode}),true);assert.equal(missionTrajectoriesVisible({...m,trajectoriesVisible:false},{id:mode,mode}),false);}
 for(const mode of ['spacecraft','pad'] as const)assert.equal(missionTrajectoriesVisible(m,{id:mode,mode}),false);
 assert.equal(missionTrajectoriesVisible(seekMission(m,0),{id:'story',mode:'guided'}),false);
 const saved={...state,mission:{...m,trajectoriesVisible:false}};assert.equal(validateSimulationState(JSON.parse(JSON.stringify(saved))).mission!.trajectoriesVisible,false);
 assert.throws(()=>validateSimulationState({...state,mission:{...m,trajectoriesVisible:'no'}}));
 assert.deepEqual(saved.mission.returnState,state.mission!.returnState);
});
