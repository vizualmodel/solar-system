import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {SatelliteId} from './catalog';
import {createIssMesh} from './iss-mesh';
import {createHubbleMesh} from './hubble-mesh';
import {prepareIssModel} from './iss-materials';

export const DETAIL_PIXELS=80;
export function normalizeSatelliteModel(model:THREE.Object3D,id:SatelliteId){
 if(id==='iss')prepareIssModel(model);
 const box=new THREE.Box3().setFromObject(model,true),size=box.getSize(new THREE.Vector3());
 const extent=Math.max(size.x,size.y,size.z);
 if(!Number.isFinite(extent)||extent<=0)throw new Error('Empty satellite model.');
 // NASA files use arbitrary authoring units. Preserve proportions and centre geometry.
 const wrapper=new THREE.Group();wrapper.add(model);model.position.sub(box.getCenter(new THREE.Vector3()));
 wrapper.scale.setScalar((id==='iss'?109:13.2)/extent);wrapper.updateMatrixWorld(true);
 // Batch components by material for close-up rendering.
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 wrapper.traverse(object=>{if(object instanceof THREE.Mesh&&!Array.isArray(object.material)){
  const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
  const list=batches.get(object.material)??[];list.push(geometry);batches.set(object.material,list);
 }});
 const result=new THREE.Group();result.name=`NASA ${id} detailed model`;
 for(const [material,geometries] of batches){
  const merged=mergeGeometries(geometries);if(!merged)throw new Error('Incompatible satellite geometry.');
  result.add(new THREE.Mesh(merged,material));geometries.forEach(g=>g.dispose());
 }
 wrapper.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});
 return result;
}
export function disposeSatelliteModel(model:THREE.Object3D){model.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const m of Array.isArray(object.material)?object.material:[object.material]){for(const value of Object.values(m))if(value instanceof THREE.Texture)value.dispose();m.dispose();}}});}

/** Pixel-based LOD honours magnification and FOV. Download/decode only on approach. */
export class SatelliteModel extends THREE.Group{
 private coarse:THREE.Group;
 private detailed?:THREE.Group;
 private loading=false;
 private dead=false;
 private decoder?:DRACOLoader;
 constructor(private satelliteId:SatelliteId,private warning:(message:string)=>void){super();this.coarse=satelliteId==='iss'?createIssMesh():createHubbleMesh();this.add(this.coarse);}
 updateDetail(diameterPixels:number){
  const close=diameterPixels>=DETAIL_PIXELS;
  this.coarse.visible=!close||!this.detailed;if(this.detailed)this.detailed.visible=close;
  if(!close||this.loading||this.detailed||this.dead)return;
  this.loading=true;
  this.decoder=new DRACOLoader().setDecoderPath('/models/draco/');
  const loader=new GLTFLoader().setDRACOLoader(this.decoder);
  loader.load(`/models/${this.satelliteId}.glb`,gltf=>{
   this.decoder?.dispose();
   if(this.dead){disposeSatelliteModel(gltf.scene);return;}
   try{this.detailed=normalizeSatelliteModel(gltf.scene,this.satelliteId);this.add(this.detailed);this.updateDetail(diameterPixels);}
   catch(error){disposeSatelliteModel(gltf.scene);this.warning(`Could not prepare ${this.satelliteId} detail model: ${error}`);}
  },undefined,()=>{this.decoder?.dispose();this.warning(`Could not load ${this.satelliteId} detail model. Showing simplified mesh.`);});
 }
 dispose(){this.dead=true;this.decoder?.dispose();}
}
