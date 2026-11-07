import * as THREE from 'three';

/** Recognizable station silhouette in metres, not an engineering/attitude model.
 * Approximate NASA overall dimensions: 109 m across, 73 m array span. */
export function createIssMesh():THREE.Group{
 const group=new THREE.Group();group.name='International Space Station';
 const metal=new THREE.MeshStandardMaterial({color:0xc6ccd3,metalness:0.4,roughness:0.6});
 const panels=new THREE.MeshStandardMaterial({color:0x735031,metalness:0.2,roughness:0.65});
 const white=new THREE.MeshStandardMaterial({color:0xe1e4df,roughness:0.8});
 function add(geometry:THREE.BufferGeometry,material:THREE.Material,position:[number,number,number]){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(position);group.add(mesh);return mesh;
 }
 add(new THREE.BoxGeometry(109,1.6,1.6),metal,[0,0,0]);
 for(const x of [-48,-33,33,48])for(const side of [-1,1]){
  add(new THREE.BoxGeometry(11.7,0.18,35.1),panels,[x,0,side*18.95]);
  for(let j=0;j<=8;j++)add(new THREE.BoxGeometry(11.7,0.22,0.08),metal,[x,0,side*(1.4+j*35.1/8)]);
 }
 for(const [z,length,radius] of [[-18,12,2],[-7,10,2.2],[4,10,2.2],[14,8,2],[22,7,1.7]]){
  const module=add(new THREE.CylinderGeometry(radius,radius,length,24),white,[0,-3,z]);module.rotation.x=Math.PI/2;
 }
 for(const x of [-8,8]){const lab=add(new THREE.CylinderGeometry(2.1,2.1,11,24),white,[x,-3,4]);lab.rotation.z=Math.PI/2;}
 for(const side of [-1,1])add(new THREE.BoxGeometry(16,0.12,6),white,[side*16,2,0]);
 add(new THREE.BoxGeometry(0.35,0.35,12),metal,[6,-1,11]);
 return group;
}
