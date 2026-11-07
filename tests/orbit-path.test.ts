import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orbitPath,ORBIT_PIXEL_ERROR } from '../src/lib/orbit-path';
import { interpolatedOrbit,relativePosition,propagate,type Elements,type Ephemeris,type Vec3 } from '../src/lib/ephemeris';
const data=JSON.parse(readFileSync(new URL('../public/data/ephemeris.json',import.meta.url),'utf8')) as Ephemeris;
const rows:Elements[]=[[0,0,0,0,0,1,0,1],[10,0,0,0,0,1,10,1]];

test('orbit at phase zero equals the independently propagated blended body position',()=>{
 for(const id of ['earth','mercury','moon','neptune']){
  const r=data.bodies[id],jd=r[20][0]+(r[21][0]-r[20][0])*0.37;
  const t=0.37**2*(3-2*0.37),a=propagate(r[20],jd),b=propagate(r[21],jd);
  const expected=a.map((v,i)=>v*(1-t)+b[i]*t);
  const actual=interpolatedOrbit(r,jd)(0);
  assert.ok(Math.hypot(...actual.map((v,i)=>v-expected[i]))<1e-11,id);
  assert.deepEqual(actual,relativePosition(r,jd));
  assert.deepEqual(orbitPath(r,jd,[0,0.0001,0.0002],0.001)[0],[0,0,0]);
 }
});
test('close zoom refines arcs to subpixel chord error, including the closing segment',()=>{
 const camera:Vec3=[0,0.0001,0.00015],pixelAngle=0.001;
 const points=orbitPath(rows,0,camera,pixelAngle);
 const far=orbitPath(rows,0,[0,20,30],pixelAngle);
 assert.ok(points.length>far.length*2);
 assert.ok(points.length<=8192);
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  const phaseA=(Math.atan2(-a[2],a[0]+1)+2*Math.PI)%(2*Math.PI);
  let phaseB=(Math.atan2(-b[2],b[0]+1)+2*Math.PI)%(2*Math.PI);
  if(phaseB<=phaseA)phaseB+=2*Math.PI;
  const phase=(phaseA+phaseB)/2,m:Vec3=[Math.cos(phase)-1,0,-Math.sin(phase)];
  const error=Math.hypot(...m.map((v,j)=>v-(a[j]+b[j])/2));
  const distance=Math.min(...[a,m,b].map(p=>Math.hypot(...p.map((v,j)=>v-camera[j]))));
  assert.ok(error<=ORBIT_PIXEL_ERROR*pixelAngle*distance*1.00001);
 }
});
test('blended orbit shape is continuous on either side of a source epoch',()=>{
 for(const id of ['earth','moon','mercury']){
  const r=data.bodies[id],jd=r[20][0];
  for(const phase of [0,0.1,1,3,6]){
   const before=interpolatedOrbit(r,jd-1e-8)(phase),after=interpolatedOrbit(r,jd+1e-8)(phase);
   assert.ok(Math.hypot(...before.map((v,i)=>v-after[i]))<1e-8,id);
  }
 }
});
test('moon orbit display scaling preserves body alignment and closed periodic shape',()=>{
 const r=data.bodies.moon,jd=r[20][0]+0.5;
 const a=orbitPath(r,jd,[0,10,20],0.001,1),b=orbitPath(r,jd,[0,50,100],0.001,5);
 assert.equal(a.length,b.length);
 a.forEach((p,i)=>p.forEach((v,j)=>assert.ok(Math.abs(b[i][j]-v*5)<1e-12)));
 const curve=interpolatedOrbit(r,jd);
 assert.ok(Math.hypot(...curve(0).map((v,i)=>v-curve(Math.PI*2)[i]))<1e-12);
});
