import * as THREE from 'three';
import { bodyOrientation } from './rotation';
import { surfaceOffset,type SurfaceObserver } from './eclipse-camera';
import { AU,byId } from './catalog';
import type { ViewConfig } from './simulation-state';

export const EYE_HEIGHT=1.7;
const RADIUS=byId.earth.radius*1000;
export const landscapeEnabled=(view:ViewConfig)=>view.cameraMode==='surface'&&!!view.observer&&view.localLandscape!==false;

/** Right-handed east/up/south frame, including at the geographic poles. */
export function observerFrame(observer:SurfaceObserver,time:number){
 const basis=bodyOrientation('earth',time),lon=observer.longitude*Math.PI/180;
 const east=new THREE.Vector3(...basis.x).multiplyScalar(-Math.sin(lon)).addScaledVector(new THREE.Vector3(...basis.z),-Math.cos(lon)).normalize();
 const up=new THREE.Vector3(...surfaceOffset(observer,time)).normalize();
 return new THREE.Matrix4().makeBasis(east,up,new THREE.Vector3().crossVectors(east,up).normalize());
}

/** Illustrative terrain relative to the telescope, never a change to its geographic altitude. */
export function landscapeHeight(x:number,z:number){
 const distance=Math.hypot(x,z),blend=1-Math.exp(-distance*distance/180000);
 const rolling=5*Math.sin(x/430)*Math.cos(z/510)+12*Math.sin(x/1600+z/2200);
 const hills=42*Math.pow(0.5+0.5*Math.sin(x/3600+z/4100),2)*(1-Math.exp(-distance*distance/18000000));
 return -EYE_HEIGHT+blend*(rolling+hills)-distance*distance/(2*RADIUS);
}

/** Uncovered solar-disc fraction; circular apparent discs, no atmospheric refraction. */
export function solarVisibility(separation:number,sunRadius:number,moonRadius:number){
 if(separation>=sunRadius+moonRadius)return 1;
 if(separation<=Math.abs(sunRadius-moonRadius))return Math.max(0,1-moonRadius*moonRadius/(sunRadius*sunRadius));
 const d=separation,s=sunRadius,m=moonRadius,clamp=(v:number)=>Math.max(-1,Math.min(1,v));
 const overlap=s*s*Math.acos(clamp((d*d+s*s-m*m)/(2*d*s)))+m*m*Math.acos(clamp((d*d+m*m-s*s)/(2*d*m)))
  -0.5*Math.sqrt(Math.max(0,(-d+s+m)*(d+s-m)*(d-s+m)*(d+s+m)));
 return THREE.MathUtils.clamp(1-overlap/(Math.PI*s*s),0,1);
}

/** A separate metre-scale pass avoids planet-sized float32 transforms and sky-path haze on nearby trees. */
export class LocalLandscape {
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.PerspectiveCamera(8,1,0.1,40000);
 readonly sun=new THREE.DirectionalLight(0xffefdc,2);
 readonly ambient=new THREE.HemisphereLight(0x9bb5cd,0x242b19,0.7);
 private geometries=new Set<THREE.BufferGeometry>();
 private materials=new Set<THREE.MeshStandardMaterial>();
 private inverse=new THREE.Quaternion();
 private scratch=new THREE.Object3D();
 private dead=false;
 private uniforms={landSun:{value:new THREE.Vector3()},landHaze:{value:new THREE.Color()},landNight:{value:1}};
 constructor(){
  this.scene.name='Local observing landscape (illustrative)';this.scene.add(this.sun,this.sun.target,this.ambient);
  const grass=this.material(0x617047,true),bark=this.material(0x514239),leaves=this.material(0x3e5935);
  const plaster=this.material(0xc5bca7),roof=this.material(0x785249),gravel=this.material(0x9c9986);
  const terrain=this.keep(new THREE.BufferGeometry()),vertices:number[]=[],colours:number[]=[],indices:number[]=[];
  const sectors=192,rings=100,colour=new THREE.Color();
  for(let ring=0;ring<=rings;ring++){
   const r=26000*Math.pow(ring/rings,3);
   for(let segment=0;segment<=sectors;segment++){
    const angle=segment/sectors*Math.PI*2,x=r*Math.cos(angle),z=r*Math.sin(angle);
    vertices.push(x,landscapeHeight(x,z),z);
    const variation=0.94+0.06*Math.sin(x/43)*Math.cos(z/61)+0.045*Math.sin(x/230+z/177);
    colour.setRGB(variation,variation,variation);colours.push(colour.r,colour.g,colour.b);
    if(ring<rings&&segment<sectors){const a=ring*(sectors+1)+segment,b=a+sectors+1;indices.push(a,b+1,b,a,a+1,b+1);}
   }
  }
  terrain.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));terrain.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
  terrain.setIndex(indices);terrain.computeVertexNormals();this.scene.add(new THREE.Mesh(terrain,grass));
  const pad=new THREE.Mesh(this.keep(new THREE.CircleGeometry(6,64)),gravel);pad.rotation.x=-Math.PI/2;pad.position.y=-EYE_HEIGHT+0.025;this.scene.add(pad);

  // Stable pseudo-random layout: pause, reverse time and rebuilding a view never reshuffle scenery.
  let seed=17491;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const treeCount=300,trunks=new THREE.InstancedMesh(this.keep(new THREE.CylinderGeometry(0.65,0.9,1,7)),bark,treeCount);
  const crowns=new THREE.InstancedMesh(this.keep(new THREE.IcosahedronGeometry(1,2)),leaves,treeCount*3);
  const set=(mesh:THREE.InstancedMesh,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,angle=0)=>{
   this.scratch.position.set(x,y,z);this.scratch.rotation.set(0,angle,0);this.scratch.scale.set(sx,sy,sz);this.scratch.updateMatrix();mesh.setMatrixAt(index,this.scratch.matrix);
  };
  for(let i=0;i<treeCount;i++){
   const angle=random()*Math.PI*2;
   // The western eclipse horizon has distant trees; nearby groups frame the other directions.
   const west=Math.cos(angle)<-0.55,r=(west?1100:65)+Math.pow(random(),1.7)*(west?4200:2600);
   const x=r*Math.cos(angle),z=r*Math.sin(angle),h=7+random()*9,ground=landscapeHeight(x,z);
   set(trunks,i,x,ground+h*0.35,z,0.4+h/25,h*0.7,0.4+h/25);
   for(let j=0;j<3;j++){
    const dx=(random()-0.5)*h*0.3,dz=(random()-0.5)*h*0.3;
    set(crowns,i*3+j,x+dx,ground+h*(0.63+j*0.10),z+dz,h*(0.24+random()*0.08),h*0.29,h*0.27,random()*6.28);
    colour.setHex([0x48613a,0x385236,0x566846][i%3]);colour.multiplyScalar(0.85+random()*0.25);crowns.setColorAt(i*3+j,colour);
   }
  }
  trunks.computeBoundingSphere();crowns.computeBoundingSphere();this.scene.add(trunks,crowns);
  const walls=new THREE.InstancedMesh(this.keep(new THREE.BoxGeometry(1,1,1)),plaster,16);
  // Unit gabled roof: ridge along Z, with real front/back faces rather than floating roof planes.
  const roofGeometry=this.keep(new THREE.BufferGeometry());
  roofGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
   -.5,0,-.5,0,1,-.5,.5,0,-.5, -.5,0,.5,.5,0,.5,0,1,.5,
   -.5,0,-.5,0,1,.5,0,1,-.5, -.5,0,-.5,-.5,0,.5,0,1,.5,
   .5,0,-.5,0,1,.5,.5,0,.5, .5,0,-.5,0,1,-.5,0,1,.5
  ],3));roofGeometry.computeVertexNormals();
  const roofs=new THREE.InstancedMesh(roofGeometry,roof,16);
  const windows=new THREE.InstancedMesh(this.keep(new THREE.BoxGeometry(1,1,1)),this.material(0x283b41),16*4);
  for(let i=0;i<16;i++){
   const angle=i/16*Math.PI*2+0.08*Math.sin(i*7),r=1000+random()*1700,x=r*Math.cos(angle),z=r*Math.sin(angle);
   const ground=landscapeHeight(x,z),height=5+random()*2,width=9+random()*5,depth=7+random()*3;
   set(walls,i,x,ground+height/2,z,width,height,depth);set(roofs,i,x,ground+height,z,width+1.2,2.8,depth+1.2);
   for(let j=0;j<4;j++)set(windows,i*4+j,x+width*(j%2===0?-0.24:0.24),ground+height*0.55,z+(j<2?-1:1)*(depth/2+0.03),1.2,1.45,0.10);
  }
  walls.computeBoundingSphere();roofs.computeBoundingSphere();windows.computeBoundingSphere();this.scene.add(walls,roofs,windows);
 }
 private keep<T extends THREE.BufferGeometry>(geometry:T):T{this.geometries.add(geometry);return geometry;}
 private material(colour:number,vertexColors=false){
  const material=new THREE.MeshStandardMaterial({color:colour,roughness:1,vertexColors});this.materials.add(material);
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 landViewPosition;')
    .replace('#include <project_vertex>','#include <project_vertex>\nlandViewPosition=mvPosition.xyz;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 landViewPosition;
uniform vec3 landSun;
uniform vec3 landHaze;
uniform float landNight;`)
    .replace('#include <opaque_fragment>',`
// Short local paths get much less haze than the full atmosphere behind this pass.
float distanceToObserver=length(landViewPosition);
vec3 ray=normalize(landViewPosition);
float forwardGlow=pow(max(0.0,dot(ray,landSun)),12.0);
vec3 haze=landHaze*(0.75+0.35*forwardGlow);
float amount=(1.0-exp(-distanceToObserver/11000.0))*0.75;
outgoingLight=mix(outgoingLight,haze*landNight,amount);
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'local-landscape-v1';return material;
 }
 update(observer:SurfaceObserver,time:number,worldCamera:THREE.PerspectiveCamera,sunFromEarth:THREE.Vector3,moonFromEarth:THREE.Vector3){
  const frame=observerFrame(observer,time);this.inverse.setFromRotationMatrix(frame).invert();
  this.camera.quaternion.copy(this.inverse).multiply(worldCamera.quaternion);
  this.camera.fov=worldCamera.fov;this.camera.aspect=worldCamera.aspect;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
  const offset=new THREE.Vector3(...surfaceOffset(observer,time));
  const sun=sunFromEarth.clone().sub(offset),moon=moonFromEarth.clone().sub(offset);
  const ds=sun.length(),dm=moon.length();sun.normalize();moon.normalize();
  const separation=Math.atan2(new THREE.Vector3().crossVectors(sun,moon).length(),sun.dot(moon));
  const visibility=solarVisibility(separation,Math.asin(byId.sun.radius/AU/ds),Math.asin(byId.moon.radius/AU/dm));
  sun.applyQuaternion(this.inverse);this.sun.position.copy(sun).multiplyScalar(10000);
  const daylight=THREE.MathUtils.smoothstep(sun.y,-0.10,0.12),warm=1-THREE.MathUtils.smoothstep(sun.y,0,0.3);
  this.sun.color.set(0xfff4df).lerp(new THREE.Color(0xffa05b),warm);
  this.sun.intensity=2.5*THREE.MathUtils.smoothstep(sun.y,-0.015,0.04)*visibility;
  this.ambient.intensity=(0.035+0.65*daylight)*(0.14+0.86*Math.sqrt(visibility));
  this.ambient.color.set(0xa8c3da).lerp(new THREE.Color(0xa68577),warm);
  this.uniforms.landHaze.value.set(0x98b4c8).lerp(new THREE.Color(0xd1a18c),warm);
  this.uniforms.landNight.value=(0.025+0.7*daylight)*(0.18+0.82*Math.sqrt(visibility));
  this.uniforms.landSun.value.copy(sun).transformDirection(this.camera.matrixWorldInverse);
 }
 render(renderer:THREE.WebGLRenderer){renderer.clearDepth();renderer.render(this.scene,this.camera);}
 dispose(){if(this.dead)return;this.dead=true;this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.scene.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.scene.clear();}
}
