import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3,Mesh} from 'three';
import {loadSatelliteAsset} from './helpers/satellite-asset';
import {partitionApolloModel,createApolloCsm,disposeApolloObjects} from '../src/lib/apollo-mesh';

test('NASA Apollo assets load and partition into physical stage geometry',async()=>{
 for(const [id,height,cuts] of [['apollo/saturn',110.6,[-13.3,12,34.7,47.7]],['apollo/lm',7,[-.3]]] as const){
  const loaded=await loadSatelliteAsset(id),parts=partitionApolloModel(loaded.scene,height,[...cuts]);
  assert.equal(parts.length,cuts.length+1);const box=new Box3();
  for(const part of parts){assert.ok(part.children.length>0);box.union(new Box3().setFromObject(part));part.traverse(object=>{if(object instanceof Mesh)assert.ok(object.geometry.getAttribute('position').count>0);});}
  assert.ok(Math.abs(box.getSize(new Vector3()).y-height)<.001);
  disposeApolloObjects(parts);
 }
});
test('Columbia has independently removable command/service modules',()=>{
 const {group,cm,sm}=createApolloCsm();assert.ok(cm.children.length>=6);assert.ok(sm.children.length>10);assert.ok(group.children.includes(cm)&&group.children.includes(sm));
 const box=new Box3().setFromObject(group).getSize(new Vector3());assert.ok(box.y>10&&box.y<12);assert.ok(box.x>3.8&&box.x<5);
 disposeApolloObjects([group]);
});
