import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3,Mesh,MeshStandardMaterial} from 'three';
import {loadSatelliteAsset} from './helpers/satellite-asset';
import {normalizeSatelliteModel,disposeSatelliteModel} from '../src/lib/satellite-model';
import {ISS_AUTHORING_DEBRIS} from '../src/lib/iss-materials';

for(const id of ['iss','hubble'] as const)test(`NASA ${id} asset decodes, batches and fits metre-scale dimensions`,async()=>{
 const gltf=await loadSatelliteAsset(id);
 const model=normalizeSatelliteModel(gltf.scene,id),box=new Box3().setFromObject(model),size=box.getSize(new Vector3());
 console.log(id,'normalised bounds',size.toArray(),'draw calls',model.children.length);
 assert.ok(model.children.length>0&&model.children.length<100);
 assert.ok(Math.abs(Math.max(size.x,size.y,size.z)-(id==='iss'?109:13.2))<0.01);
 assert.ok(box.getCenter(new Vector3()).length()<0.001);
 assert.ok(model.children.reduce((sum,m:any)=>sum+m.geometry.index.count/3,0)>(id==='iss'?100000:1000));
 disposeSatelliteModel(model);
});

test('ISS removes only seven detached authoring cylinders and keeps station geometry',async()=>{
 const {scene}=await loadSatelliteAsset('iss');
 const loose:string[]=[];scene.traverse(o=>{if(ISS_AUTHORING_DEBRIS.has(o.name))loose.push(o.name);});assert.equal(loose.length,7);
 const model=normalizeSatelliteModel(scene,'iss'),size=new Box3().setFromObject(model).getSize(new Vector3());
 assert.ok(Math.abs(size.x-109)<0.01);assert.ok(size.y>10&&size.y<20);assert.ok(size.z>65&&size.z<75);
 const triangles=model.children.reduce((sum,m:any)=>sum+m.geometry.index.count/3,0);
 assert.equal(triangles,174440-7*320,'all station triangles are retained');
 assert.equal(model.children.length,18,'only the loose-cylinder material disappears');
 disposeSatelliteModel(model);
});

test('ISS has distinct opaque untextured metal, insulation, foil and solar materials',async()=>{
 const model=normalizeSatelliteModel((await loadSatelliteAsset('iss')).scene,'iss'),names=new Set<string>();
 model.traverse(o=>{if(o instanceof Mesh){
  const m=o.material as MeshStandardMaterial;assert.ok(m instanceof MeshStandardMaterial);names.add(m.name);
  assert.equal(m.transparent,false);assert.equal(m.opacity,1);assert.equal(m.depthTest,true);assert.equal(m.depthWrite,true);
  assert.equal(m.map,null);assert.equal(m.normalMap,null);assert.equal(m.roughnessMap,null);assert.equal(m.metalnessMap,null);
  if(m.name==='ISS aluminium')assert.ok(m.metalness>0.7);
  if(m.name==='ISS insulation')assert.ok(m.roughness>0.75&&m.metalness<0.1);
  if(m.name==='ISS solar')assert.ok(m.color.r>m.color.b*2);
 }});
 for(const name of ['aluminium','insulation','radiator','solar','foil','glass'])assert.ok(names.has('ISS '+name));
 disposeSatelliteModel(model);
});
