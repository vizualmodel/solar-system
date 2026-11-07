import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedSatelliteSize,satelliteSizePatch} from '../src/lib/satellite-settings';
import {satelliteMagnification} from '../src/lib/satellites';
import {defaultSimulationState,validateSimulationState} from '../src/lib/simulation-state';

test('one magnification control changes both satellites and preserves all unrelated view state',()=>{
 const s=defaultSimulationState(),view=s.views[0];view.satelliteSizes={iss:1,hubble:5012};
 const before=structuredClone(view);assert.equal(sharedSatelliteSize(view),null);
 for(const value of [1,100,100000]){
  const patch=satelliteSizePatch(view,value),result={...view,...patch};
  assert.equal(satelliteMagnification(result,'iss'),value);assert.equal(satelliteMagnification(result,'hubble'),value);
  assert.equal(sharedSatelliteSize(result),value);
  const {satelliteSizes,satelliteSize,...rest}=result;const {satelliteSizes:oldSizes,satelliteSize:oldSize,...oldRest}=before;
  assert.deepEqual(rest,oldRest);assert.deepEqual(view,before);
  assert.deepEqual(validateSimulationState({...s,views:[result]}).views[0],result);
 }
 for(const value of [0,NaN,Infinity,100001])assert.throws(()=>satelliteSizePatch(view,value),/Invalid/);
});

test('legacy individual values are displayed as mixed without silently changing saved views',()=>{
 const s=defaultSimulationState(),view=s.views[0],before=structuredClone(view);
 assert.equal(sharedSatelliteSize(view),null);assert.deepEqual(view,before);
 view.satelliteSize=1000;assert.equal(sharedSatelliteSize(view),1000);
 view.satelliteSizes={iss:1};assert.equal(sharedSatelliteSize(view),null);
 view.satelliteSizes={iss:1,hubble:1};assert.equal(sharedSatelliteSize(view),1);
});
