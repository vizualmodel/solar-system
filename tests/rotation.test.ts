import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyOrientation,rotationModels } from '../src/lib/rotation';
import { DAY,type Vec3 } from '../src/lib/ephemeris';
import { bodies } from '../src/lib/catalog';
import { equatorialToScene } from '../src/lib/sky-coordinates';
const epoch=Date.parse('2000-01-01T12:00:00Z')-69184;
const dot=(a:Vec3,b:Vec3)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
test('all bodies have orthonormal right-handed orientation frames',()=>{
 for(const b of bodies)for(const time of [epoch,Date.parse('2026-09-28'),Date.parse('2031-01-01')]){
  const {x,y,z}=bodyOrientation(b.id,time);
  for(const axis of [x,y,z])assert.ok(Math.abs(Math.hypot(...axis)-1)<1e-12);
  assert.ok(Math.abs(dot(x,y))<1e-12);assert.ok(dot(cross(x,y),z)>1-1e-12);
 }
});
test('Earth has J2000 obliquity and the correct prime-meridian direction',()=>{
 const o=bodyOrientation('earth',epoch);
 assert.ok(Math.abs(Math.acos(o.y[1])*180/Math.PI-23.439291111)<1e-9);
 assert.ok(dot(o.x,equatorialToScene(280.147*Math.PI/180,0))>1-1e-12);
});
test('sidereal periods return planets to their starting orientation',()=>{
 for(const id of ['sun','earth','mars','jupiter','venus','uranus']){
  const period=360/Math.abs(rotationModels[id].w[1])*DAY;
  const first=bodyOrientation(id,epoch),later=bodyOrientation(id,epoch+period);
  assert.ok(dot(first.x,later.x)>0.999999,id);
 }
});
test('spin directions include retrograde Venus and Uranus; time scrubbing is deterministic',()=>{
 for(const [id,sign] of [['earth',1],['sun',1],['venus',-1],['uranus',-1]] as const){
  const start=bodyOrientation(id,epoch),after=bodyOrientation(id,epoch+3600000);
  assert.equal(Math.sign(dot(cross(start.x,after.x),start.y)),sign);
  bodyOrientation(id,epoch-10*DAY);
  assert.deepEqual(bodyOrientation(id,epoch+3600000),after);
 }
});
