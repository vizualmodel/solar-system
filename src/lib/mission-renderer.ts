import {createLaunchPad,ApolloExhaust,LaunchSmoke} from './apollo-launch';
import {surfaceDirection} from './mission-flight';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {SkyBackground} from './sky';
import {EarthVisual} from './earth-visual';
import {bodyOrientation} from './rotation';
import {RENDER_UNITS_PER_AU,updateRenderCamera} from './render-units';
import type {MissionState} from './mission';
import {METRES_PER_AU,type MissionContext} from './mission-flight';
import {createApolloCsm,loadApolloModels,disposeApolloObjects} from './apollo-mesh';
import {missionCameraFrame} from './mission-camera';
import type {MissionCamera,MissionView} from './mission-views';
import {moonMissionTrajectory,spacecraftMissionTrajectory,missionTrajectoriesVisible} from './mission-trajectories';

export class MissionRenderer{
 private renderer:THREE.WebGLRenderer;
 private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(45,1,1e-11,10000);private renderCamera=new THREE.PerspectiveCamera();
 private controls:OrbitControls;private observer:ResizeObserver;private width=1;private height=1;private dead=false;
 private sky:SkyBackground;private earth:EarthVisual;private moon:THREE.Mesh;private light=new THREE.DirectionalLight(0xffffff,3);
 private vehicles=new THREE.Group();private rocket=new THREE.Group();private eagle=new THREE.Group();private descent=new THREE.Group();private csm=createApolloCsm();
 private csmFlame=new THREE.Mesh(new THREE.ConeGeometry(.7,5,24),new THREE.MeshBasicMaterial({color:'#a8d4ff',transparent:true,opacity:.7,depthWrite:false}));
 private flame=new THREE.Mesh(new THREE.ConeGeometry(1.2,12,24),new THREE.MeshBasicMaterial({color:'#ffb34d',transparent:true,opacity:.8,depthWrite:false}));
 private pad=createLaunchPad();private exhaust=new ApolloExhaust();private smoke=new LaunchSmoke();
 private chutes=new THREE.Group();private terrain:THREE.Mesh;
 private ocean=new THREE.Mesh(new THREE.PlaneGeometry(800,800,64,64),new THREE.MeshStandardMaterial({color:'#244d65',emissive:'#091c28',roughness:.3,metalness:.15,side:THREE.DoubleSide}));
 private marker=new THREE.Sprite(new THREE.SpriteMaterial({color:'#f4c678',depthTest:true}));
 private path=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#e6bd7d',transparent:true,opacity:.5}));
 private moonPath=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#74c7ef',transparent:true,opacity:.8}));
 private chapter=-1;private cameraKey='';private sceneKey='';private mode='';
 static async create(host:HTMLElement,context:MissionContext,state:MissionState,onCamera:(camera:MissionCamera)=>void,onWarning:(message:string)=>void,view:MissionView={id:'mission-primary',mode:'guided',camera:state.camera}){
  const models=await loadApolloModels();
  try{return new MissionRenderer(host,context,state,models,onCamera,onWarning,view);}catch(error){disposeApolloObjects([...models.saturn,...models.lm]);throw error;}
 }
 private constructor(private host:HTMLElement,private context:MissionContext,state:MissionState,private models:Awaited<ReturnType<typeof loadApolloModels>>,private onCamera:(camera:MissionCamera)=>void,onWarning:(message:string)=>void,view:MissionView){
  this.scene.scale.setScalar(RENDER_UNITS_PER_AU);
  this.renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});this.renderer.autoClear=false;this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.domElement.setAttribute('aria-label','Apollo mission. Drag to inspect the spacecraft, scroll to zoom. Pause mission to freeze motion.');host.append(this.renderer.domElement);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=3/METRES_PER_AU;this.controls.maxDistance=.02;this.controls.zoomSpeed=.7;
  this.controls.addEventListener('end',()=>this.captureCamera());
  this.sky=new SkyBackground(onWarning);
  this.earth=new EarthVisual(new THREE.MeshStandardMaterial({color:0xffffff}),{maxTextureSize:this.renderer.capabilities.maxTextureSize,anisotropy:this.renderer.capabilities.getMaxAnisotropy()},onWarning);
  this.earth.scale.setScalar(6371000/METRES_PER_AU);
  this.moon=new THREE.Mesh(new THREE.SphereGeometry(1,128,64),new THREE.MeshStandardMaterial({color:'#dfdbd1',roughness:1}));this.moon.scale.setScalar(1737400/METRES_PER_AU);
  new THREE.TextureLoader().load('/textures/moon.jpg',texture=>{if(this.dead){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;(this.moon.material as THREE.MeshStandardMaterial).map=texture;(this.moon.material as THREE.MeshStandardMaterial).needsUpdate=true;},undefined,()=>onWarning('Moon texture unavailable; using shaded lunar geometry.'));
  const ambient=new THREE.AmbientLight(0xffffff,.65);ambient.layers.enable(1);this.light.layers.enable(1);this.camera.layers.enable(1);this.earth.traverse(o=>o.layers.set(1));this.moon.layers.set(1);
  this.scene.add(this.earth,this.moon,this.light,ambient);
  this.models.saturn.forEach((part,i)=>{part.name=`Saturn V section ${i+1}`;this.rocket.add(part);});
  this.eagle.add(models.lm[1]);this.descent.add(models.lm[0]);
  this.flame.rotation.z=Math.PI;this.csmFlame.rotation.z=Math.PI;this.csmFlame.position.y=-9;
  this.vehicles.add(this.exhaust.group,this.rocket,this.eagle,this.descent,this.csm.group,this.flame,this.csmFlame,this.chutes);this.vehicles.scale.setScalar(1/METRES_PER_AU);
  for(let i=0;i<3;i++){const x=(i-1)*8,canopy=new THREE.Mesh(new THREE.SphereGeometry(5,32,16,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:i===1?'#e7e1d5':'#c34a38',side:THREE.DoubleSide}));canopy.position.set(x,22,0);this.chutes.add(canopy);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,22,0),new THREE.Vector3(0,2,0)]),new THREE.LineBasicMaterial({color:'#dcd6c8'}));this.chutes.add(line);}
  const terrainGeometry=new THREE.PlaneGeometry(350,350,64,64);terrainGeometry.rotateX(-Math.PI/2);
  const vertices=terrainGeometry.getAttribute('position');for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),z=vertices.getZ(i),r=Math.hypot(x,z);vertices.setY(i,(Math.sin(x*.13)*Math.cos(z*.17)*.15+Math.sin(x*.04+z*.06)*.2)*Math.min(1,r/15));}terrainGeometry.computeVertexNormals();
  this.terrain=new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({color:'#8d8981',roughness:1}));this.terrain.scale.setScalar(1/METRES_PER_AU);
  this.ocean.geometry.rotateX(-Math.PI/2);const water=this.ocean.geometry.getAttribute('position');for(let i=0;i<water.count;i++){const x=water.getX(i),z=water.getZ(i);water.setY(i,Math.sin(x*.06)*Math.sin(z*.08)*.18);}this.ocean.geometry.computeVertexNormals();this.ocean.scale.setScalar(1/METRES_PER_AU);
  this.pad.scale.setScalar(1/METRES_PER_AU);this.smoke.group.scale.setScalar(1/METRES_PER_AU);this.scene.add(this.pad,this.smoke.group);
  this.moonPath.geometry.setFromPoints(moonMissionTrajectory(context,state));
  this.path.frustumCulled=false;this.moonPath.frustumCulled=false;this.scene.add(this.vehicles,this.terrain,this.ocean,this.marker,this.path,this.moonPath);
  this.observer=new ResizeObserver(entries=>{const box=entries[0].contentRect;this.width=Math.max(1,box.width);this.height=Math.max(1,box.height);this.renderer.setSize(this.width,this.height);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();});this.observer.observe(host);
  this.draw(state,view);
 }
 draw(state:MissionState,view:MissionView={id:'mission-primary',mode:'guided',camera:state.camera}){
  if(this.dead)return;
  const frame=missionCameraFrame(this.context,state,view),pose=frame.pose,{position,up,scene,met,p}=pose,origin=frame.origin;
  const cameraKey=JSON.stringify(view.camera??null);
  if(this.mode!==view.mode||view.mode==='guided'&&this.chapter!==state.chapter||cameraKey!==this.cameraKey){
   if(view.camera){this.camera.position.fromArray(view.camera.position);this.controls.target.fromArray(view.camera.target);this.camera.up.fromArray(view.camera.up??frame.up.toArray());}
   else{
    this.camera.up.copy(frame.up);
    this.camera.position.copy(frame.direction).multiplyScalar(frame.distance/METRES_PER_AU);this.controls.target.set(0,0,0);
   }
   this.camera.lookAt(this.controls.target);this.controls.update();this.chapter=state.chapter;this.cameraKey=cameraKey;this.mode=view.mode;
  }
  this.controls.update();this.camera.updateMatrixWorld(true);
  this.earth.position.copy(origin).negate();this.moon.position.copy(pose.moon).sub(origin);this.light.position.copy(pose.sun).normalize();
  for(const [id,mesh] of [['earth',this.earth],['moon',this.moon]] as const){const f=bodyOrientation(id,pose.time);mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().fromArray(f.x),new THREE.Vector3().fromArray(f.y),new THREE.Vector3().fromArray(f.z)));}
  this.earth.updateMatrixWorld(true);
  const radius=6371000/METRES_PER_AU,distance=this.camera.position.distanceTo(this.earth.position),pixels=distance<radius*1.04?4000:radius/Math.max(distance,1e-12)/Math.tan(this.camera.fov*Math.PI/360)*this.height;
  this.earth.updateAppearance(pose.time,this.camera,pixels,pose.sun.clone().sub(origin),this.moon.position,1737400/METRES_PER_AU,695700000/METRES_PER_AU);
  this.vehicles.position.copy(position).sub(origin);this.vehicles.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);
  this.rocket.visible=['launch','parking','tli','docking'].includes(scene);this.rocket.position.set(0,scene==='launch'?0:-30,0);
  this.models.saturn.forEach((part,i)=>{part.visible=scene==='launch'?(i!==4||met<197):scene==='docking'?i===2:i===2||i===3;part.position.set(0,0,0);if(i===0&&met>=164){part.position.y=-(met-164)*4;part.visible=met<204;}if(i===1&&met>=555){part.position.y=-(met-555)*3;part.visible=met<610;}});
  this.csm.group.visible=!['launch','parking','tli'].includes(scene);this.csm.group.position.set(0,0,0);this.csm.group.rotation.set(0,0,0);this.csm.sm.visible=scene!=='entry'||met<194*3600+49*60+13;
  this.eagle.visible=['docking','outbound','lunar-orbit','undocking','landing','surface','ascent','rendezvous'].includes(scene);this.descent.visible=['docking','outbound','lunar-orbit','undocking','landing','surface'].includes(scene);
  this.eagle.rotation.set(0,0,0);this.eagle.position.set(0,0,0);this.descent.rotation.set(0,0,0);this.descent.position.set(0,0,0);
  if(scene==='docking'){
   // LM in the opened adapter; Columbia turns and approaches nose first.
   const turn=Math.min(1,p/.25),approach=Math.max(0,Math.min(1,(p-.25)/.55));
   this.rocket.position.y=-38.2;this.csm.group.position.y=18-10.3*approach;this.csm.group.rotation.z=Math.PI*turn;
   if(p>.8){this.rocket.position.y-=200*(p-.8)/.2;}
  }else if(['outbound','lunar-orbit'].includes(scene)){
   this.eagle.rotation.z=Math.PI;this.descent.rotation.z=Math.PI;this.eagle.position.y=this.descent.position.y=7.7;
  }else if(['undocking','rendezvous'].includes(scene)){
   const gap=scene==='undocking'?100*Math.max(0,(met-(100*3600+12*60))/(8*60)):25+140*(1-p);
   this.csm.group.position.set(gap,7.7,0);this.csm.group.rotation.z=Math.PI;
   if(scene==='rendezvous'){this.csm.group.position.set(0,7.7+100*Math.max(0,1-p/.94),0);}
  }else if(['landing','surface','ascent'].includes(scene)){this.csm.group.visible=false;}
  this.flame.visible=false;this.exhaust.update(scene,met,p);
  const padUp=surfaceDirection('earth',pose.time,28.608,-80.604);this.pad.position.copy(padUp).multiplyScalar(6371000/METRES_PER_AU).sub(origin);this.pad.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),padUp);this.pad.visible=['launch','parking'].includes(scene);this.smoke.group.position.copy(this.pad.position);this.smoke.group.quaternion.copy(this.pad.quaternion);this.smoke.update(met);
  this.pad.children.filter(c=>c.name==='Umbilical arm').forEach(c=>c.rotation.y=-Math.min(1,met/4)*Math.PI/2);
  this.flame.position.set(0,scene==='launch'?(met<164?-61:met<555?-20:5):scene==='tli'?-20:-7,0);this.flame.scale.setScalar(scene==='launch'?1:scene==='tli'?.4:.22);
  this.csmFlame.visible=false;this.chutes.visible=scene==='entry'&&met>=195*3600+13*60&&p<1;
  this.ocean.visible=scene==='entry'&&p>.92;this.ocean.position.copy(up).multiplyScalar(6371000/METRES_PER_AU).sub(origin);this.ocean.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);
  if(scene==='entry'){this.csm.group.rotation.z=met<195*3600+13*60?Math.PI:0;this.flame.visible=met>=195*3600+3*60&&met<195*3600+13*60;this.flame.position.y=5;this.flame.scale.setScalar(.45);}
  this.terrain.visible=['surface','ascent'].includes(scene)||scene==='landing'&&p>.9;
  this.terrain.position.copy(pose.ground).sub(origin);this.terrain.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),surfaceNormal(pose.ground,pose.moon));
  // Leave the descent stage on the surface during lunar ascent.
  if(scene==='ascent'){this.descent.visible=true;const local=pose.ground.clone().addScaledVector(surfaceNormal(pose.ground,pose.moon),3.5/METRES_PER_AU).sub(position).applyQuaternion(this.vehicles.quaternion.clone().invert()).multiplyScalar(METRES_PER_AU);this.descent.position.copy(local);this.descent.quaternion.copy(this.vehicles.quaternion.clone().invert()).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),surfaceNormal(pose.ground,pose.moon)));}
  this.marker.position.copy(position).sub(origin);this.marker.visible=frame.overview;this.marker.scale.setScalar(this.camera.position.distanceTo(this.marker.position)*2*Math.tan(Math.PI/8)/this.height*9);
  this.path.visible=this.moonPath.visible=missionTrajectoriesVisible(state,view);
  const pathKey=`${state.id}:${state.chapter}`;
  if(this.sceneKey!==pathKey&&this.path.visible){
   this.path.geometry.dispose();this.path.geometry=new THREE.BufferGeometry().setFromPoints(spacecraftMissionTrajectory(this.context,state));this.sceneKey=pathKey;
  }
  this.path.position.copy(origin).negate();this.moonPath.position.copy(this.path.position);
  const localAtmosphere=distance<radius+20000/METRES_PER_AU;
  const daylight=this.camera.position.clone().add(origin).normalize().dot(pose.sun.clone().normalize())>0;
  this.renderer.clear();this.sky.draw(this.renderer,this.camera,!(localAtmosphere&&daylight),false);this.renderer.clearDepth();updateRenderCamera(this.camera,this.renderCamera);
  // At close range, composite the atmospheric background before foreground craft.
  // Retain Earth depth so foreground geometry still respects the ground/horizon.
  if(localAtmosphere){this.renderCamera.layers.set(1);this.renderer.render(this.scene,this.renderCamera);this.renderCamera.layers.set(0);}
  this.renderer.render(this.scene,this.renderCamera);
 }
 captureCamera(){this.onCamera({position:this.camera.position.toArray() as [number,number,number],target:this.controls.target.toArray() as [number,number,number],up:this.camera.up.toArray() as [number,number,number]});}
 dispose(){if(this.dead)return;this.dead=true;this.observer.disconnect();this.controls.dispose();this.sky.dispose();this.earth.dispose();disposeApolloObjects([this.vehicles,this.moon,this.terrain,this.ocean,this.pad,this.smoke.group]);this.earth.material.dispose();this.marker.material.dispose();for(const path of [this.path,this.moonPath]){path.geometry.dispose();(path.material as THREE.Material).dispose();}this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
function surfaceNormal(ground:THREE.Vector3,moon:THREE.Vector3){return ground.clone().sub(moon).normalize();}
