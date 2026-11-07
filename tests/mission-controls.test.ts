import test from 'node:test';
import assert from 'node:assert/strict';
import {get} from 'svelte/store';
import {startMission,missionTime} from '../src/lib/mission';
import {defaultSimulationState} from '../src/lib/simulation-state';
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{}}});
Object.defineProperty(globalThis,'location',{configurable:true,value:{search:''}});
const {simulationState,command}=await import('../src/lib/store');
const {applyBrowserRequest}=await import('../companion/browser-adapter');

test('mission locks normal time/session controls and observations expose both clocks',()=>{
 const active=startMission(defaultSimulationState('earth'),'apollo-11');simulationState.set(active);
 const request=(method:string,params:object={})=>({method,id:'mission-test',expiresAt:Date.now()+10000,...params});
 const observed=applyBrowserRequest(request('get_simulation_state'));
 assert.equal(observed.time,new Date(active.time).toISOString());assert.equal(observed.mission!.time,new Date(missionTime(active.mission!)).toISOString());
 assert.throws(()=>applyBrowserRequest(request('timeline',{settings:{playing:true}})),/Stop the mission/);
 assert.throws(()=>applyBrowserRequest(request('session',{action:'new'})),/Stop the mission/);
 assert.throws(()=>command({type:'time',value:active.start}),/Stop the mission/);
 assert.deepEqual(get(simulationState),active);
 const exported=applyBrowserRequest(request('session',{action:'export'}));assert.deepEqual(exported.simulationState,active);
});
