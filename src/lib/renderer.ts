import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { displayBodies as bodies,byId,AU,type SatelliteId } from './catalog';
import { julianDate,type Ephemeris,type Vec3 } from './ephemeris';
import type { ViewConfig } from './simulation-state';
import { displayPosition } from './presentation';
import { SkyBackground } from './sky';
import { bodyOrientation } from './rotation';
import { moonUmbra,moonPenumbra } from './umbra';
import { orbitPath } from './orbit-path';
import { SatelliteModel } from './satellite-model';
import { satelliteOrbitPath,satelliteMagnification } from './satellites';
import { mountedSurfaceCamera,mountDirection,alignmentCamera,interactiveEclipsePose,manualCameraPatch } from './eclipse-camera';
import { TelescopeControls } from './telescope-controls';
import {RENDER_UNITS_PER_AU,updateRenderCamera} from './render-units';
import {EarthVisual} from './earth-visual';
import {LocalLandscape,landscapeEnabled} from './local-landscape';
import {PopulationRenderer} from './population-renderer';
export class SolarRenderer {
 private renderer:THREE.WebGLRenderer;
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(45,1,0.0000001,10000);
 private renderCamera=new THREE.PerspectiveCamera();
 private controls:OrbitControls;
 private telescope:TelescopeControls;
 private frameTime=0;
 private meshes=new Map<string,THREE.Object3D>();
 private paths=new Map<string,THREE.Line>();
 private labels=new Map<string,HTMLButtonElement>();
 private markers=new Map<string,THREE.Sprite>();
 private observer:ResizeObserver;
 private sky:SkyBackground;
 private sunLight=new THREE.PointLight(0xffffff,3,0,0);
 private config:ViewConfig;
 private positions:Record<string,Vec3>={};
 private origin=new THREE.Vector3();
 private width=1;private height=1;
 private orbitKeys=new Map<string,string>();
 private disposed=false;
 private landscape?:LocalLandscape;
 private population:PopulationRenderer;
 private ring:THREE.Mesh;
 private bodyMatrix=new THREE.Matrix4();
 private bodyX=new THREE.Vector3();private bodyY=new THREE.Vector3();private bodyZ=new THREE.Vector3();
 private umbra=new THREE.Mesh(new THREE.ConeGeometry(1,1,96,1,true),new THREE.MeshBasicMaterial({color:0x173b78,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false}));
 private umbraUniforms={umbraEnabled:{value:0},umbraAxis:{value:new THREE.Vector3()},earthFromMoon:{value:new THREE.Vector3()},umbraApex:{value:0},umbraSlope:{value:0}};
 private penumbra=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,96,1,true),new THREE.MeshBasicMaterial({color:0x9aa2ae,transparent:true,opacity:0.065,side:THREE.DoubleSide,depthWrite:false}));
 private penumbraVertices=this.penumbra.geometry.getAttribute('position').array.slice();
 private penumbraUniforms={penumbraEnabled:{value:0},penumbraApex:{value:0},penumbraSlope:{value:0}};
 constructor(private host:HTMLElement,config:ViewConfig,private data:Ephemeris,private onCamera:(camera:Vec3,target:Vec3,patch?:Partial<ViewConfig>)=>void,private onPick:(id:string)=>void,onWarning:(message:string)=>void=console.warn){
  this.config=config;
  this.scene.scale.setScalar(RENDER_UNITS_PER_AU);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,logarithmicDepthBuffer:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0x080d14,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.autoClear=false;
  this.population=new PopulationRenderer(this.scene,this.renderer.domElement,id=>this.onCamera(this.camera.position.toArray() as Vec3,this.controls.target.toArray() as Vec3,{populationSelection:id}));
  this.sky=new SkyBackground(onWarning);
  host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive solar system. Drag to orbit, scroll to zoom, right drag to pan.');
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=config.satelliteFocus?1e-11:1e-7;this.controls.maxDistance=200;this.controls.zoomSpeed=0.85;
  this.camera.position.fromArray(config.camera);this.controls.target.fromArray(config.target);this.controls.update();
  this.controls.addEventListener('end',()=>this.captureCamera());
  this.controls.addEventListener('start',()=>this.captureCamera(true));
  this.telescope=new TelescopeControls(this.camera,this.controls.target,this.renderer.domElement,()=>this.config.cameraMode==='surface',()=>this.captureCamera(true),()=>this.captureCamera(false,true));
  this.scene.add(new THREE.AmbientLight(0xffffff,0.25),this.sunLight);
  const geometry=new THREE.SphereGeometry(1,48,32),loader=new THREE.TextureLoader();
  for(const body of bodies){
   const material=body.id==='sun'?new THREE.MeshBasicMaterial({color:0xffe5b1}):new THREE.MeshStandardMaterial({color:body.color,roughness:1});
   if(body.id==='earth')material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,this.umbraUniforms,this.penumbraUniforms);
    // Surface offsets exclude translation, keeping small eclipse footprints precise even far from the origin.
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 umbraSurface;').replace('#include <project_vertex>',`#include <project_vertex>\numbraSurface = mat3(modelMatrix) * transformed / ${RENDER_UNITS_PER_AU.toFixed(1)};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 umbraSurface;
uniform float umbraEnabled;
uniform vec3 umbraAxis;
uniform vec3 earthFromMoon;
uniform float umbraApex;
uniform float umbraSlope;
uniform float penumbraEnabled;
uniform float penumbraApex;
uniform float penumbraSlope;`).replace('#include <opaque_fragment>',`
if (umbraEnabled > 0.5 || penumbraEnabled > 0.5) {
 vec3 relative = earthFromMoon + umbraSurface;
 float axial = dot(relative, umbraAxis);
 vec3 radial = relative - axial * umbraAxis;
 float radius = (umbraApex - axial) * umbraSlope;
 if (penumbraEnabled > 0.5 && axial >= 0.0) {
  float outerRadius = (penumbraApex + axial) * penumbraSlope;
  // Approximate the gradual loss of sunlight between the exact tangent boundaries.
  float partial = 1.0 - smoothstep(abs(radius), max(outerRadius, abs(radius) + 1e-12), length(radial));
  outgoingLight *= 1.0 - 0.6 * partial;
 }
 float edge = length(radial) - radius;
 float feather = max(fwidth(edge), 1e-12);
 float shadow = 1.0 - smoothstep(-feather, feather, edge);
 if (umbraEnabled > 0.5 && axial >= 0.0 && axial <= umbraApex) outgoingLight *= mix(vec3(1.0), vec3(0.12,0.16,0.25), shadow);
}
#include <opaque_fragment>`);
   };
   if(body.texture&&body.id!=='earth')loader.load(`/textures/${body.texture}.jpg`,texture=>{if(this.disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.color.set(0xffffff);material.needsUpdate=true;});
   const mesh=body.kind==='satellite'?new SatelliteModel(body.id as SatelliteId,onWarning):body.id==='earth'?new EarthVisual(material as THREE.MeshStandardMaterial,{maxTextureSize:this.renderer.capabilities.maxTextureSize,deviceMemory:(navigator as Navigator&{deviceMemory?:number}).deviceMemory,anisotropy:this.renderer.capabilities.getMaxAnisotropy()},onWarning):new THREE.Mesh(geometry,material);if(body.kind==='satellite')material.dispose();this.meshes.set(body.id,mesh);this.scene.add(mesh);
   const lineGeometry=new THREE.BufferGeometry(),lineMaterial=new THREE.LineBasicMaterial({color:body.color,transparent:true,opacity:body.parent==='sun'?0.25:0.4});
   const line=body.kind==='satellite'?new THREE.Line(lineGeometry,lineMaterial):new THREE.LineLoop(lineGeometry,lineMaterial);this.paths.set(body.id,line);this.scene.add(line);
   const label=document.createElement('button');label.className='body-label';label.textContent=body.name;label.style.setProperty('--body-color',body.color);label.onclick=()=>this.onPick(body.id);host.append(label);this.labels.set(body.id,label);
   const marker=new THREE.Sprite(new THREE.SpriteMaterial({color:body.color,depthTest:false,transparent:true,opacity:0.85}));this.markers.set(body.id,marker);this.scene.add(marker);
  }
  this.ring=new THREE.Mesh(new THREE.RingGeometry(1.35,2.3,96),new THREE.MeshStandardMaterial({color:'#c9b58c',side:THREE.DoubleSide,transparent:true,opacity:0.6}));this.ring.rotation.x=-Math.PI/2;this.meshes.get('saturn')!.add(this.ring);
  this.umbra.visible=false;this.scene.add(this.umbra);
  this.penumbra.visible=false;this.scene.add(this.penumbra);
  this.observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.renderer.setSize(this.width,this.height);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();});this.observer.observe(host);
 }
 configure(next:ViewConfig){
  this.controls.minDistance=next.satelliteFocus?1e-11:1e-7;
  const changed=next.cameraMode!==this.config.cameraMode||next.focus!==this.config.focus||next.satelliteFocus!==this.config.satelliteFocus||next.camera.some((x,i)=>x!==this.config.camera[i])||next.target.some((x,i)=>x!==this.config.target[i]);
  if(changed){this.camera.up.fromArray(next.manualCamera?.up??[0,1,0]);this.camera.position.fromArray(next.camera);this.controls.target.fromArray(next.target);if(next.cameraMode!=='surface')this.controls.update();}
  this.config=next;
 }
 private displayPosition(id:string):THREE.Vector3 {
  return new THREE.Vector3(...displayPosition(id,this.positions,this.config.moonScale));
 }
 draw(time:number,positions:Record<string,Vec3>){
  this.positions=positions;this.frameTime=time;const config=this.config;
  if(config.follow)this.origin.copy(this.displayPosition(config.satelliteFocus??config.focus));
  else this.origin.set(0,0,0);
  const eclipse=config.cameraMode==='surface'||config.cameraMode==='alignment';
  this.controls.enabled=config.cameraMode!=='surface';
  this.renderer.domElement.setAttribute('aria-label',config.cameraMode==='surface'?'Mounted telescope. Drag to aim, scroll or pinch to change magnification.':'Interactive solar system. Drag to orbit, scroll to zoom, right drag to pan.');
  if(config.cameraMode==='surface'||eclipse&&!config.manualCamera){
   const pose=config.cameraMode==='surface'?mountedSurfaceCamera(config,time,positions):interactiveEclipsePose(alignmentCamera(positions),config.cameraMode);
   this.camera.position.fromArray(pose.camera);this.camera.up.fromArray(pose.up);this.controls.target.fromArray(pose.target);this.camera.lookAt(this.controls.target);
   this.camera.fov=pose.fov;this.camera.near=config.cameraMode==='surface'?1e-11:1e-7;
  }else{this.camera.up.fromArray(config.manualCamera?.up??[0,1,0]);this.camera.fov=config.manualCamera?.fov??45;this.camera.near=config.satelliteFocus?1e-11:1e-7;this.controls.update();}
  this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  this.sunLight.position.copy(this.displayPosition('sun').sub(this.origin));
  const occupied:{x:number;y:number;width:number}[]=[];
  for(const body of bodies){
   const mesh=this.meshes.get(body.id)!,line=this.paths.get(body.id)!,label=this.labels.get(body.id)!,marker=this.markers.get(body.id)!;
   const pos=this.displayPosition(body.id).sub(this.origin),isSatellite=body.kind==='satellite';
   const visible=isSatellite?(config.satellites??[]).includes(body.id)&&!!positions[body.id]:config.visible.includes(body.id);
   mesh.position.copy(pos);mesh.visible=visible;
   const orientation=bodyOrientation(isSatellite?'earth':body.id,time);
   this.bodyMatrix.makeBasis(this.bodyX.fromArray(orientation.x),this.bodyY.fromArray(orientation.y),this.bodyZ.fromArray(orientation.z));
   if(isSatellite)mesh.quaternion.identity();else mesh.quaternion.setFromRotationMatrix(this.bodyMatrix);
   const magnification=isSatellite?satelliteMagnification(config,body.id as SatelliteId):body.id==='sun'?Math.sqrt(config.size):config.size;
   const radius=body.radius/AU*magnification;
   mesh.scale.setScalar(isSatellite?magnification/(1000*AU):radius);
   marker.position.copy(pos);const depth=pos.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
   const pixel=2*Math.max(1e-9,-depth)*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))/this.height;
   if(mesh instanceof SatelliteModel&&visible)mesh.updateDetail(2*radius/pixel);
   if(mesh instanceof EarthVisual&&visible){
    const diameter=this.camera.position.distanceTo(pos)<radius*1.04?4000:depth<0?2*radius/pixel:0;
    mesh.updateAppearance(time,this.camera,diameter,this.sunLight.position,this.displayPosition('moon').sub(this.origin),byId.moon.radius/AU*config.size,byId.sun.radius/AU*Math.sqrt(config.size));
   }
   marker.scale.setScalar(pixel*3);marker.visible=visible&&radius<pixel*2&&depth<0;
   line.visible=config.orbits&&visible&&body.id!=='sun';
   if(body.parent&&line.visible){
    const cameraFromBody=this.camera.position.clone().sub(pos).toArray() as Vec3;
    const pixelAngle=2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))/this.height;
    const scale=body.parent==='sun'||isSatellite?1:config.moonScale;
    const key=[time,...cameraFromBody,pixelAngle,scale].join(',');
    if(this.orbitKeys.get(body.id)!==key){
     const points=isSatellite?satelliteOrbitPath(body.id as SatelliteId,time,cameraFromBody,pixelAngle):orbitPath(this.data.bodies[body.id],julianDate(time),cameraFromBody,pixelAngle,scale);
     let vertices=line.geometry.getAttribute('position') as THREE.BufferAttribute|undefined;
     if(!vertices||vertices.count<points.length){line.geometry.dispose();line.geometry=new THREE.BufferGeometry();const capacity=THREE.MathUtils.ceilPowerOfTwo(points.length);vertices=new THREE.BufferAttribute(new Float32Array(capacity*3),3);vertices.setUsage(THREE.DynamicDrawUsage);line.geometry.setAttribute('position',vertices);}
     points.forEach((p,i)=>vertices!.setXYZ(i,...p));vertices.needsUpdate=true;
     line.geometry.setDrawRange(0,points.length);
     line.geometry.computeBoundingSphere();this.orbitKeys.set(body.id,key);
    }
    line.position.copy(pos);
   }
   const screen=pos.clone().project(this.camera);
   const x=(screen.x+1)*this.width/2+Math.max(8,Math.min(radius/pixel,60))+5,y=(1-screen.y)*this.height/2-8,width=body.name.length*6+12;
   const overlaps=occupied.some(r=>x<r.x+r.width&&x+width>r.x&&Math.abs(y-r.y)<18);
   const onScreen=visible&&config.labels&&!overlaps&&depth<0&&screen.z>=-1&&screen.z<=1&&x>0&&x+width<this.width&&y>48&&y<this.height-40;
   label.style.display=onScreen?'block':'none';if(onScreen){label.style.left=`${x}px`;label.style.top=`${y}px`;occupied.push({x,y,width});}
  }
  this.population.draw(config,time,this.displayPosition('earth').sub(this.origin),this.camera,this.width,this.height);
  this.updateUmbra();
  this.renderer.clear();
  this.sky.draw(this.renderer,this.camera,config.stars,config.constellations);
  this.renderer.clearDepth();
  updateRenderCamera(this.camera,this.renderCamera);
  this.renderer.render(this.scene,this.renderCamera);
  if(landscapeEnabled(config)){
   this.landscape??=new LocalLandscape();
   const earth=this.displayPosition('earth');
   this.landscape.update(config.observer!,time,this.camera,this.displayPosition('sun').sub(earth),this.displayPosition('moon').sub(earth));
   this.landscape.render(this.renderer);
  }else if(this.landscape){this.landscape.dispose();this.landscape=undefined;}
 }
 private updateUmbra(){
  const config=this.config;
  this.umbra.visible=false;this.umbraUniforms.umbraEnabled.value=0;
  this.penumbra.visible=false;this.penumbraUniforms.penumbraEnabled.value=0;
  if(!config.moonUmbra&&!config.moonPenumbra)return;
  const moon=this.displayPosition('moon'),sun=this.displayPosition('sun');
  const cone=moonUmbra(sun,moon,byId.sun.radius/AU*Math.sqrt(config.size),byId.moon.radius/AU*config.size);
  if(!cone)return;
  this.umbra.visible=config.moonUmbra;
  this.umbra.position.copy(cone.base).addScaledVector(cone.axis,cone.length/2).sub(this.origin);
  this.umbra.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),cone.axis);
  this.umbra.scale.set(cone.baseRadius,cone.length,cone.baseRadius);
  this.umbraUniforms.umbraEnabled.value=config.moonUmbra&&config.visible.includes('earth')?1:0;
  this.umbraUniforms.umbraAxis.value.copy(cone.axis);
  this.umbraUniforms.earthFromMoon.value.copy(this.displayPosition('earth')).sub(moon);
  this.umbraUniforms.umbraApex.value=cone.apexDistance;
  this.umbraUniforms.umbraSlope.value=cone.slope;
  if(config.moonPenumbra){
   const pen=moonPenumbra(sun,moon,byId.sun.radius/AU*Math.sqrt(config.size),byId.moon.radius/AU*config.size);
   if(!pen)return;
   // Penumbra has no far tip. Show a useful segment reaching past the displayed Earth.
   const length=Math.max(cone.length,this.displayPosition('earth').distanceTo(moon)+2*byId.earth.radius/AU*config.size)-pen.baseOffset;
   const endRadius=(pen.apexDistance+pen.baseOffset+length)*pen.slope;
   const vertices=this.penumbra.geometry.getAttribute('position');
   for(let i=0;i<vertices.count;i++){
    const y=this.penumbraVertices[i*3+1],radius=pen.baseRadius+(endRadius-pen.baseRadius)*(y+0.5);
    vertices.setXYZ(i,this.penumbraVertices[i*3]*radius,y,this.penumbraVertices[i*3+2]*radius);
   }
   vertices.needsUpdate=true;this.penumbra.geometry.computeBoundingSphere();
   this.penumbra.position.copy(pen.base).addScaledVector(pen.axis,length/2).sub(this.origin);
   this.penumbra.quaternion.copy(this.umbra.quaternion);this.penumbra.scale.set(1,length,1);
   this.penumbra.visible=true;
   this.penumbraUniforms.penumbraEnabled.value=config.visible.includes('earth')?1:0;
   this.penumbraUniforms.penumbraApex.value=pen.apexDistance;
   this.penumbraUniforms.penumbraSlope.value=pen.slope;
  }
 }
 captureCamera(interacting=false,changed=false){
  if(this.config.cameraMode==='surface'&&!interacting&&!changed)return;
  const eclipse=this.config.cameraMode==='surface'||this.config.cameraMode==='alignment';
  if(eclipse&&!this.config.manualCamera&&!interacting)return;
  const camera=this.camera.position.toArray() as Vec3,target=this.controls.target.toArray() as Vec3;
  const patch=eclipse?manualCameraPatch({camera,target,up:this.camera.up.toArray() as Vec3,fov:this.camera.fov}):undefined;
  if(patch?.manualCamera&&this.config.cameraMode==='surface')patch.manualCamera.mountDirection=mountDirection(target.map((v,i)=>v-camera[i]) as Vec3,this.frameTime);
  if(patch)this.config={...this.config,...patch};
  this.onCamera(camera,target,patch);
 }
 dispose(){this.disposed=true;this.population.dispose();this.landscape?.dispose();this.sky.dispose();this.observer.disconnect();this.telescope.dispose();this.controls.dispose();this.scene.traverse(obj=>{if(obj instanceof EarthVisual)obj.dispose();if(obj.userData.earthOwned)return;if(obj instanceof SatelliteModel)obj.dispose();const o=obj as THREE.Mesh;if(o.geometry)o.geometry.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){const mat=m as THREE.MeshStandardMaterial;mat.map?.dispose();mat.dispose();}}});this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.labels.forEach(l=>l.remove());}
}
