import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bodies,byId,AU } from './catalog';
import { bracket,julianDate,orbitalPoint,type Ephemeris,type Vec3 } from './ephemeris';
import type { ViewConfig } from './scenario';
import { displayPosition } from './presentation';
import { SkyBackground } from './sky';
import { bodyOrientation } from './rotation';
const toScene=(p:Vec3)=>new THREE.Vector3(p[0],p[2],-p[1]);
export class SolarRenderer {
 private renderer:THREE.WebGLRenderer;
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(45,1,0.0000001,10000);
 private controls:OrbitControls;
 private meshes=new Map<string,THREE.Mesh>();
 private paths=new Map<string,THREE.LineLoop>();
 private labels=new Map<string,HTMLButtonElement>();
 private markers=new Map<string,THREE.Sprite>();
 private observer:ResizeObserver;
 private sky:SkyBackground;
 private sunLight=new THREE.PointLight(0xffffff,3,0,0);
 private config:ViewConfig;
 private positions:Record<string,Vec3>={};
 private origin=new THREE.Vector3();
 private width=1;private height=1;private orbitDay=-1;
 private disposed=false;
 private ring:THREE.Mesh;
 private bodyMatrix=new THREE.Matrix4();
 private bodyX=new THREE.Vector3();private bodyY=new THREE.Vector3();private bodyZ=new THREE.Vector3();
 constructor(private host:HTMLElement,config:ViewConfig,private data:Ephemeris,private onCamera:(camera:Vec3,target:Vec3)=>void,private onPick:(id:string)=>void,onWarning:(message:string)=>void=console.warn){
  this.config=config;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,logarithmicDepthBuffer:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0x080d14,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.autoClear=false;
  this.sky=new SkyBackground(onWarning);
  host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive solar system. Drag to orbit, scroll to zoom, right drag to pan.');
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=0.0000001;this.controls.maxDistance=200;this.controls.zoomSpeed=0.85;
  this.camera.position.fromArray(config.camera);this.controls.target.fromArray(config.target);this.controls.update();
  this.controls.addEventListener('end',()=>this.onCamera(this.camera.position.toArray() as Vec3,this.controls.target.toArray() as Vec3));
  this.scene.add(new THREE.AmbientLight(0xffffff,0.25),this.sunLight);
  const geometry=new THREE.SphereGeometry(1,48,32),loader=new THREE.TextureLoader();
  for(const body of bodies){
   const material=body.id==='sun'?new THREE.MeshBasicMaterial({color:0xffe5b1}):new THREE.MeshStandardMaterial({color:body.color,roughness:1});
   if(body.texture)loader.load(`/textures/${body.texture}.jpg`,texture=>{if(this.disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.color.set(0xffffff);material.needsUpdate=true;});
   const mesh=new THREE.Mesh(geometry,material);this.meshes.set(body.id,mesh);this.scene.add(mesh);
   const line=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:body.color,transparent:true,opacity:body.parent==='sun'?0.25:0.4}));this.paths.set(body.id,line);this.scene.add(line);
   const label=document.createElement('button');label.className='body-label';label.textContent=body.name;label.style.setProperty('--body-color',body.color);label.onclick=()=>this.onPick(body.id);host.append(label);this.labels.set(body.id,label);
   const marker=new THREE.Sprite(new THREE.SpriteMaterial({color:body.color,depthTest:false,transparent:true,opacity:0.85}));this.markers.set(body.id,marker);this.scene.add(marker);
  }
  this.ring=new THREE.Mesh(new THREE.RingGeometry(1.35,2.3,96),new THREE.MeshStandardMaterial({color:'#c9b58c',side:THREE.DoubleSide,transparent:true,opacity:0.6}));this.ring.rotation.x=-Math.PI/2;this.meshes.get('saturn')!.add(this.ring);
  this.observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.renderer.setSize(this.width,this.height);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();});this.observer.observe(host);
 }
 configure(next:ViewConfig){
  const changed=next.focus!==this.config.focus||next.camera.some((x,i)=>x!==this.config.camera[i])||next.target.some((x,i)=>x!==this.config.target[i]);
  if(changed){this.camera.position.fromArray(next.camera);this.controls.target.fromArray(next.target);this.controls.update();}
  this.config=next;
 }
 private displayPosition(id:string):THREE.Vector3 {
  return new THREE.Vector3(...displayPosition(id,this.positions,this.config.moonScale));
 }
 draw(time:number,positions:Record<string,Vec3>){
  this.positions=positions;const config=this.config;
  if(config.follow)this.origin.copy(this.displayPosition(config.focus));
  else this.origin.set(0,0,0);
  this.controls.update();this.camera.updateMatrixWorld();
  this.sunLight.position.copy(this.displayPosition('sun').sub(this.origin));
  const day=Math.floor(time/86400000),occupied:{x:number;y:number;width:number}[]=[];
  for(const body of bodies){
   const mesh=this.meshes.get(body.id)!,line=this.paths.get(body.id)!,label=this.labels.get(body.id)!,marker=this.markers.get(body.id)!;
   const pos=this.displayPosition(body.id).sub(this.origin),visible=config.visible.includes(body.id);
   mesh.position.copy(pos);mesh.visible=visible;
   const orientation=bodyOrientation(body.id,time);
   this.bodyMatrix.makeBasis(this.bodyX.fromArray(orientation.x),this.bodyY.fromArray(orientation.y),this.bodyZ.fromArray(orientation.z));
   mesh.quaternion.setFromRotationMatrix(this.bodyMatrix);
   const radius=body.radius/AU*(body.id==='sun'?Math.sqrt(config.size):config.size);mesh.scale.setScalar(radius);
   marker.position.copy(pos);const depth=pos.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
   const pixel=2*Math.max(1e-9,-depth)*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))/this.height;
   marker.scale.setScalar(pixel*3);marker.visible=visible&&radius<pixel*2&&depth<0;
   line.visible=config.orbits&&visible&&body.id!=='sun';
   if(body.parent){
    if(day!==this.orbitDay){const [row]=bracket(this.data.bodies[body.id],julianDate(time));const points=Array.from({length:256},(_,i)=>toScene(orbitalPoint(row,i/256*Math.PI*2)));line.geometry.dispose();line.geometry=new THREE.BufferGeometry().setFromPoints(points);}
    line.position.copy(this.displayPosition(body.parent).sub(this.origin));line.scale.setScalar(body.parent==='sun'?1:config.moonScale);
   }
   const screen=pos.clone().project(this.camera);
   const x=(screen.x+1)*this.width/2+Math.max(8,Math.min(radius/pixel,60))+5,y=(1-screen.y)*this.height/2-8,width=body.name.length*6+12;
   const overlaps=occupied.some(r=>x<r.x+r.width&&x+width>r.x&&Math.abs(y-r.y)<18);
   const onScreen=visible&&config.labels&&!overlaps&&depth<0&&screen.z>=-1&&screen.z<=1&&x>0&&x+width<this.width&&y>48&&y<this.height-40;
   label.style.display=onScreen?'block':'none';if(onScreen){label.style.left=`${x}px`;label.style.top=`${y}px`;occupied.push({x,y,width});}
  }
  this.orbitDay=day;
  this.renderer.clear();
  this.sky.draw(this.renderer,this.camera,config.stars,config.constellations);
  this.renderer.clearDepth();
  this.renderer.render(this.scene,this.camera);
 }
 dispose(){this.disposed=true;this.sky.dispose();this.observer.disconnect();this.controls.dispose();this.scene.traverse(obj=>{const o=obj as THREE.Mesh;if(o.geometry)o.geometry.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){const mat=m as THREE.MeshStandardMaterial;mat.map?.dispose();mat.dispose();}}});this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.labels.forEach(l=>l.remove());}
}
