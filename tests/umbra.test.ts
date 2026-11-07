import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { moonUmbra,moonPenumbra,insideUmbra } from '../src/lib/umbra';
import { AU,byId } from '../src/lib/catalog';
import { displayPosition } from '../src/lib/presentation';
const sun=new Vector3(),moon=new Vector3(1,0,0);
const rs=byId.sun.radius/AU,rm=byId.moon.radius/AU;
test('true-scale umbra terminates at the external tangent apex and touches the Moon',()=>{
 const c=moonUmbra(sun,moon,rs,rm)!;
 assert.ok(Math.abs(c.apexDistance*AU-374556)<100);
 const tangent=c.base.clone().add(new Vector3(0,c.baseRadius,0));
 assert.ok(Math.abs(tangent.distanceTo(moon)-rm)<1e-15);
 const apex=moon.clone().addScaledVector(c.axis,c.apexDistance);
 assert.ok(Math.abs(tangent.clone().sub(moon).dot(apex.clone().sub(tangent)))<1e-15);
 assert.ok(c.base.clone().addScaledVector(c.axis,c.length).distanceTo(apex)<1e-15);
});
test('Earth surface enters and leaves total shadow; no umbra beyond the apex',()=>{
 const c=moonUmbra(sun,moon,rs,rm)!;
 const surface=moon.clone().addScaledVector(c.axis,360000/AU);
 assert.equal(insideUmbra(surface,moon,c),true);
 assert.equal(insideUmbra(surface.clone().add(new Vector3(0,200/AU,0)),moon,c),false);
 assert.equal(insideUmbra(moon.clone().addScaledVector(c.axis,c.apexDistance*1.01),moon,c),false);
 assert.equal(insideUmbra(moon.clone().addScaledVector(c.axis,-rm*2),moon,c),false);
});
test('cone follows Moon motion and the displayed body and orbit scales',()=>{
 const positions={sun:[0,0,0],earth:[1,0,0],moon:[1,0.002,0.001]} as Record<string,[number,number,number]>;
 const m=new Vector3(...displayPosition('moon',positions,3));
 const c=moonUmbra(sun,m,rs*Math.sqrt(4),rm*4)!;
 assert.ok(c.axis.distanceTo(m.clone().normalize())<1e-15);
 assert.ok(c.apexDistance>moonUmbra(sun,m,rs,rm)!.apexDistance);
 assert.deepEqual(m.toArray(),[1,0.003,-0.006]);
 const shifted=moonUmbra(sun,new Vector3(0,1,0),rs,rm)!;
 assert.deepEqual(shifted.axis.toArray(),[0,1,0]);
});
test('invalid or overlapping spheres do not produce a cone',()=>{
 assert.equal(moonUmbra(sun,moon,rm,rs),null);
 assert.equal(moonUmbra(sun,sun,rs,rm),null);
 assert.equal(moonUmbra(sun,moon,rs,0),null);
});
test('penumbra touches the Moon and widens to the partial eclipse boundary at Earth',()=>{
 const c=moonPenumbra(sun,moon,rs,rm)!;
 const tangent=c.base.clone().add(new Vector3(0,c.baseRadius,0));
 const apex=moon.clone().addScaledVector(c.axis,-c.apexDistance);
 assert.ok(Math.abs(tangent.distanceTo(moon)-rm)<1e-15);
 assert.ok(Math.abs(tangent.clone().sub(moon).dot(apex.clone().sub(tangent)))<1e-15);
 const nearRadius=(c.apexDistance+360000/AU)*c.slope;
 const farRadius=(c.apexDistance+400000/AU)*c.slope;
 assert.ok(nearRadius*AU>3300&&nearRadius*AU<3500);
 assert.ok(farRadius>nearRadius);
 assert.ok(nearRadius>(moonUmbra(sun,moon,rs,rm)!.apexDistance-360000/AU)*moonUmbra(sun,moon,rs,rm)!.slope);
 assert.equal(moonPenumbra(sun,sun,rs,rm),null);
 const moved=moonPenumbra(sun,new Vector3(0,1,0),rs*2,rm*4)!;
 assert.deepEqual(moved.axis.toArray(),[0,1,0]);assert.ok(moved.baseRadius>c.baseRadius);
});
