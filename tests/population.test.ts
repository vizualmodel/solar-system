import test from 'node:test';
import assert from 'node:assert/strict';
import {population,populationCounts,populationGroups,populationMatches,populationState,populationOrbit,populationIllustrative,classifyPopulation} from '../src/lib/population';
import {defaultSimulationState,validateSimulationState} from '../src/lib/simulation-state';
import {SATELLITE_WINDOW} from '../src/lib/satellites';
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{}}});
Object.defineProperty(globalThis,'location',{configurable:true,value:{search:''}});
const {applyControl}=await import('../companion/controls');
const {parseControl}=await import('../companion/control-schema');

test('cached populations contain genuine distinct GEO, LEO, Starlink and MEO/GPS records',()=>{
 assert.equal(new Set(population.map(row=>row.id)).size,population.length);
 for(const group of populationGroups)assert.ok(populationCounts[group]>20,group);
 for(const row of population){
  assert.ok(Number.isFinite(row.epoch));
  if(row.groups.includes('starlink'))assert.ok(row.groups.includes('leo'));
  if(row.groups.includes('gps'))assert.ok(row.groups.includes('navigation'));
 }
 assert.equal(population.filter(r=>populationMatches(r,['leo','starlink'])).length,populationCounts.leo);
 assert.equal(population.filter(r=>populationMatches(r,['gps','navigation'])).length,populationCounts.navigation);
 const geo=population.find(r=>r.groups.includes('geo'))!;
 assert.deepEqual(classifyPopulation({...geo.elements,MEAN_MOTION:2,ECCENTRICITY:0},['gnss']),['navigation']);
});

test('SGP4 and far-date illustrative states stay finite at physical orbital radii',()=>{
 for(const group of ['geo','leo','gps'] as const){
  const row=population.find(r=>r.groups.includes(group))!;
  for(const time of [row.epoch,row.epoch+86400000,Date.parse('1990-01-01Z'),Date.parse('2031-01-01Z')]){
   const state=populationState(row,time)!;
   assert.ok(state&&state.position.every(Number.isFinite));assert.ok(state.altitude>0);assert.ok(state.speed>0&&state.speed<12);
  }
  assert.equal(populationIllustrative(row,row.epoch+SATELLITE_WINDOW),false);
  assert.equal(populationIllustrative(row,row.epoch+SATELLITE_WINDOW+1),true);
  const path=populationOrbit(row,row.epoch);assert.equal(path.length,193);assert.ok(path.flat().every(Number.isFinite));
 }
});

test('population settings preserve all scene state and validate atomically across save/import',()=>{
 const s=defaultSimulationState('earth');s.playing=true;s.views[0].satellites=['iss'];
 const before=structuredClone(s),row=population.find(r=>r.groups.includes('gps'))!;
 const params=parseControl('satellites',{settings:{populationGroups:['gps'],populationSelection:row.id}});
 const next=applyControl(s,'satellites',params);
 assert.deepEqual(s,before);
 assert.deepEqual(next,{...before,views:[{...before.views[0],populationGroups:['gps'],populationSelection:row.id}]});
 assert.deepEqual(validateSimulationState(JSON.parse(JSON.stringify(next))),next);
 assert.throws(()=>applyControl(s,'satellites',{settings:{populationGroups:['gps'],populationSelection:1}}),/enabled/);
 assert.throws(()=>validateSimulationState({...s,views:[{...s.views[0],populationGroups:['invalid']}]}));
 assert.throws(()=>parseControl('satellites',{settings:{populationSelection:NaN}}));
 const filtered=applyControl(next,'satellites',{settings:{populationGroups:[]}});assert.equal(filtered.views[0].populationSelection,null);
 assert.deepEqual(validateSimulationState(before),before);
});
