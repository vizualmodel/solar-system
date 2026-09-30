import test from 'node:test';
import assert from 'node:assert/strict';
import { displayPosition,changeTracking } from '../src/lib/presentation';
import { newView } from '../src/lib/scenario';
import type { Vec3 } from '../src/lib/ephemeris';
test('display scale changes moon separation without mutating physical state',()=>{const positions:Record<string,Vec3>={earth:[1,2,3],moon:[1.001,2,3]};const before=JSON.stringify(positions);assert.deepEqual(displayPosition('earth',positions,100),[1,3,-2]);assert.ok(Math.abs(displayPosition('moon',positions,100)[0]-1.1)<1e-12);assert.equal(JSON.stringify(positions),before);});
test('switching between fixed and tracking preserves the camera world position',()=>{const v=newView();v.focus='earth';const positions:Record<string,Vec3>={earth:[1,2,3]};const fixed={...v,...changeTracking(v,positions)};assert.equal(fixed.follow,false);assert.deepEqual(fixed.camera,[1,25,30]);const restored={...fixed,...changeTracking(fixed,positions)};assert.deepEqual(restored.camera,v.camera);assert.deepEqual(restored.target,v.target);});
