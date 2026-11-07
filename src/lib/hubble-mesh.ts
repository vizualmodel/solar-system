import * as THREE from 'three';

/** Simplified, reusable Hubble silhouette in metres; pointing is illustrative.
 * NASA dimensions: 13.2 m long, 4.2 m aft diameter; arrays 7.1 x 2.6 m. */
export function createHubbleMesh():THREE.Group{
 const group=new THREE.Group();group.name='Hubble Space Telescope';
 const metal=new THREE.MeshStandardMaterial({color:0xcdd2da,metalness:0.65,roughness:0.4});
 const gold=new THREE.MeshStandardMaterial({color:0xc2a463,metalness:0.5,roughness:0.55});
 const panels=new THREE.MeshStandardMaterial({color:0x183d72,metalness:0.35,roughness:0.6,side:THREE.DoubleSide});
 const dark=new THREE.MeshStandardMaterial({color:0x10151c,roughness:0.8});
 function add(geometry:THREE.BufferGeometry,material:THREE.Material,position:[number,number,number]){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(position);group.add(mesh);return mesh;
 }
 add(new THREE.CylinderGeometry(1.25,1.25,9.2,32),metal,[0,2,0]);
 add(new THREE.CylinderGeometry(2.1,2.1,4,32),gold,[0,-4.6,0]);
 const aperture=add(new THREE.CircleGeometry(1.12,32),dark,[0,6.61,0]);aperture.rotation.x=-Math.PI/2;
 for(const side of [-1,1]){
  add(new THREE.BoxGeometry(1.4,0.15,0.15),metal,[side*2.2,-1.5,0]);
  add(new THREE.BoxGeometry(7.1,2.6,0.08),panels,[side*6.45,-1.5,0]);
  for(let i=0;i<5;i++)add(new THREE.BoxGeometry(0.025,2.6,0.1),metal,[side*6.45-3.55+i*7.1/4,-1.5,0]);
  add(new THREE.BoxGeometry(7.1,0.025,0.1),metal,[side*6.45,-1.5,0]);
 }
 const door=add(new THREE.CircleGeometry(1.25,24),metal,[1.75,6.5,0]);door.rotation.set(-Math.PI/2,0,-Math.PI/3);
 return group;
}
