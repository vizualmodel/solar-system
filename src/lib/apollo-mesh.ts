import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';

const metal=(color:THREE.ColorRepresentation,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness:.55,roughness});
export function createApolloCsm(){
 const group=new THREE.Group();group.name='Columbia · command and service modules';
 const silver=metal('#c6cbd0',.24),white=metal('#deddd6',.65),dark=metal('#302d2a'),gold=metal('#b38b4c');
 const cm=new THREE.Group(),sm=new THREE.Group();cm.name='Command module';sm.name='Service module';
 const add=(parent:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 add(sm,new THREE.CylinderGeometry(1.95,1.95,4.7,64),silver,0,-2.7,0);
 add(sm,new THREE.CylinderGeometry(1.97,1.97,.18,64),white,0,-.27,0);
 add(sm,new THREE.CylinderGeometry(.38,1.02,1.8,40,1,true),dark,0,-5.85,0);
 add(sm,new THREE.CylinderGeometry(1.08,1.08,.12,40),silver,0,-6.73,0);
 // Radiator panels, service bays and four RCS quads.
 for(let i=0;i<8;i++){const a=i*Math.PI/4,p=add(sm,new THREE.BoxGeometry(.9,2.8,.045),i%2?white:gold,Math.sin(a)*1.96,-2.65,Math.cos(a)*1.96);p.rotation.y=a;}
 for(let i=0;i<4;i++){const a=i*Math.PI/2,quad=new THREE.Group();quad.position.set(Math.sin(a)*2,-1.1,Math.cos(a)*2);quad.rotation.y=a;sm.add(quad);add(quad,new THREE.BoxGeometry(.4,.5,.35),white,0,0,0);for(const sign of [-1,1]){const thruster=add(quad,new THREE.CylinderGeometry(.045,.12,.35,16),dark,.25*sign,0,.12);thruster.rotation.z=Math.PI/2;}}
 add(cm,new THREE.CylinderGeometry(.45,1.95,3.1,64),silver,0,1.4,0);
 add(cm,new THREE.CylinderGeometry(1.97,1.97,.16,64),dark,0,-.22,0);
 add(cm,new THREE.CylinderGeometry(.42,.45,.35,32),white,0,3.12,0);
 add(cm,new THREE.CylinderGeometry(.045,.045,.9,12),silver,0,3.75,0);
 add(cm,new THREE.SphereGeometry(.12,12,8),dark,0,4.2,0);
 const glass=new THREE.MeshStandardMaterial({color:'#142c43',metalness:.6,roughness:.12});
 for(const x of [-.65,.65]){const w=add(cm,new THREE.BoxGeometry(.42,.35,.08),glass,x,1.4,1.22);w.rotation.x=-.4;}
 group.add(cm,sm);return {group,cm,sm};
}

/** Partition by triangle height so stage changes work even in a merged authoring mesh.
 * Splits are illustrative; the original NASA geometry and surface materials are retained. */
export function partitionApolloModel(model:THREE.Object3D,height:number,cuts:number[]){
 model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<=0)throw new Error('Empty Apollo model.');
 const scale=height/size.y,transform=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z));
 const parts=Array.from({length:cuts.length+1},()=>new THREE.Group());
 model.traverse(object=>{if(object instanceof THREE.Mesh){
  const source=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();source.applyMatrix4(transform.clone().multiply(object.matrixWorld));
  const vertices=source.getAttribute('position'),indices:number[][]=parts.map(()=>[]);
  for(let i=0;i<vertices.count;i+=3){const y=(vertices.getY(i)+vertices.getY(i+1)+vertices.getY(i+2))/3;const index=cuts.findIndex(cut=>y<cut);indices[index<0?cuts.length:index].push(i,i+1,i+2);}
  indices.forEach((list,index)=>{if(!list.length)return;const geometry=new THREE.BufferGeometry();
   for(const [name,a] of Object.entries(source.attributes) as [string,THREE.BufferAttribute][]){const array=new Float32Array(list.length*a.itemSize);list.forEach((vertex,i)=>{for(let k=0;k<a.itemSize;k++)array[i*a.itemSize+k]=a.array[vertex*a.itemSize+k];});geometry.setAttribute(name,new THREE.BufferAttribute(array,a.itemSize));}
   const material=Array.isArray(object.material)?object.material[0]:object.material;
   parts[index].add(new THREE.Mesh(geometry,material));
  });source.dispose();object.geometry.dispose();
 }});
 return parts;
}
export async function loadApolloModels(){
 const decoder=new DRACOLoader().setDecoderPath('/models/draco/');
 const loader=new GLTFLoader().setDRACOLoader(decoder);
 const results=await Promise.allSettled([loader.loadAsync('/models/apollo/saturn.glb'),loader.loadAsync('/models/apollo/lm.glb')]);decoder.dispose();
 if(results.some(r=>r.status==='rejected')){for(const r of results)if(r.status==='fulfilled')disposeApolloObjects([r.value.scene]);throw new Error('Apollo spacecraft models could not load.');}
 const [saturn,lm]=results.map(r=>(r as PromiseFulfilledResult<Awaited<ReturnType<typeof loader.loadAsync>>>).value.scene);
 return {saturn:partitionApolloModel(saturn,110.6,[-13.3,12,34.7,47.7]),lm:partitionApolloModel(lm,7,[-.3])};
}
export function disposeApolloObjects(objects:THREE.Object3D[]){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 for(const root of objects)root.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Sprite){if(object instanceof THREE.Mesh)geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}}});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
