import * as THREE from 'three';
import {population,populationById,populationColors,populationMatches,populationState,populationOrbit,type PopulationSatellite} from './population';
import type {ViewConfig} from './simulation-state';
import type {Vec3} from './ephemeris';

/** One GPU point cloud; picking is in CSS pixels, independent of dot size. */
export class PopulationRenderer {
 private geometry=new THREE.BufferGeometry();
 private material=new THREE.PointsMaterial({size:3,sizeAttenuation:false,vertexColors:true,depthTest:true});
 private dots=new THREE.Points(this.geometry,this.material);
 private line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#fff0a6',transparent:true,opacity:.9}));
 private selection=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:'#fff0a6',size:8,sizeAttenuation:false}));
 private positions=new Float32Array(population.length*3);
 private colors=new Float32Array(population.length*3);
 private rows:PopulationSatellite[]=[];
 private physical:Vec3[]=[];
 private key='';private orbitKey='';private down?:[number,number];private dragged=false;
 private drawKey='';
 private targets:{id:number;x:number;y:number;depth:number}[]=[];
 private onDown=(event:PointerEvent)=>{this.down=event.button===0?[event.clientX,event.clientY]:undefined;this.dragged=false;};
 private onMove=(event:PointerEvent)=>{if(this.down&&Math.hypot(event.clientX-this.down[0],event.clientY-this.down[1])>5)this.dragged=true;};
 private onCancel=()=>{this.down=undefined;};
 private onUp=(event:PointerEvent)=>{
  const down=this.down;this.down=undefined;
  if(!down||this.dragged||event.button!==0||Math.hypot(event.clientX-down[0],event.clientY-down[1])>5)return;
  const rect=this.canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  const target=this.targets.map(t=>({...t,d:Math.hypot(t.x-x,t.y-y)})).filter(t=>t.d<=12).sort((a,b)=>a.d-b.d||a.depth-b.depth)[0];
  this.onSelect(target?.id??null);
 };
 constructor(scene:THREE.Scene,private canvas:HTMLCanvasElement,private onSelect:(id:number|null)=>void){
  this.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');};
  this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
  this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3));
  this.dots.frustumCulled=false;this.line.frustumCulled=false;this.selection.frustumCulled=false;
  scene.add(this.dots,this.line,this.selection);
  canvas.addEventListener('pointerdown',this.onDown);canvas.addEventListener('pointermove',this.onMove);canvas.addEventListener('pointerup',this.onUp);canvas.addEventListener('pointercancel',this.onCancel);
 }
 draw(view:ViewConfig,time:number,earth:THREE.Vector3,camera:THREE.PerspectiveCamera,width:number,height:number){
  const groups=view.populationGroups??[],key=[time,...groups].join('|');
  const drawKey=[key,view.populationSelection,view.size,view.visible.includes('earth'),...earth.toArray(),...camera.matrixWorld.elements,...camera.projectionMatrix.elements,width,height].join('|');
  if(drawKey===this.drawKey)return;this.drawKey=drawKey;
  this.dots.visible=!!groups.length;this.line.visible=false;this.selection.visible=false;this.targets=[];
  if(!groups.length)return;
  if(key!==this.key){
   this.rows=[];this.physical=[];
   for(const row of population){if(!populationMatches(row,groups))continue;const state=populationState(row,time);if(state){this.rows.push(row);this.physical.push(state.position);}}
   this.rows.forEach((row,i)=>new THREE.Color(populationColors[row.groups.includes('starlink')?'starlink':row.groups[0]]).toArray(this.colors,i*3));
   this.geometry.getAttribute('color').needsUpdate=true;this.key=key;
  }
  // Positions are relative to the floating origin, matching the physical Earth.
  this.physical.forEach((p,i)=>{
   const point=new THREE.Vector3(p[0],p[2],-p[1]).add(earth);point.toArray(this.positions,i*3);
   const offset=point.clone().sub(camera.position),distance=offset.length(),earthOffset=earth.clone().sub(camera.position);
   const direction=offset.clone().normalize(),along=earthOffset.dot(direction),miss2=earthOffset.lengthSq()-along*along;
   const radius=6378.137/149597870.7*view.size;
   const obscured=view.visible.includes('earth')&&along>0&&along<distance&&miss2<radius*radius&&along-Math.sqrt(Math.max(0,radius*radius-miss2))<distance;
   const screen=point.clone().project(camera);
   if(!obscured&&offset.dot(camera.getWorldDirection(new THREE.Vector3()))>0&&screen.z>=-1&&screen.z<=1&&Math.abs(screen.x)<=1&&Math.abs(screen.y)<=1)this.targets.push({id:this.rows[i].id,x:(screen.x+1)*width/2,y:(1-screen.y)*height/2,depth:distance});
  });
  this.geometry.getAttribute('position').needsUpdate=true;this.geometry.setDrawRange(0,this.rows.length);
  const row=view.populationSelection?populationById.get(view.populationSelection):undefined;
  if(!row||!populationMatches(row,groups))return;
  const orbitKey=[row.id,time].join('|');
  if(orbitKey!==this.orbitKey){
   const points=populationOrbit(row,time).map(p=>new THREE.Vector3(p[0],p[2],-p[1]));
   this.line.geometry.dispose();this.line.geometry=new THREE.BufferGeometry().setFromPoints(points);
   const p=populationState(row,time)?.position;
   this.selection.geometry.dispose();this.selection.geometry=new THREE.BufferGeometry().setFromPoints(p?[new THREE.Vector3(p[0],p[2],-p[1])]:[]);
   this.orbitKey=orbitKey;
  }
  this.line.position.copy(earth);this.selection.position.copy(earth);this.line.visible=true;this.selection.visible=true;
 }
 dispose(){this.canvas.removeEventListener('pointerdown',this.onDown);this.canvas.removeEventListener('pointermove',this.onMove);this.canvas.removeEventListener('pointerup',this.onUp);this.canvas.removeEventListener('pointercancel',this.onCancel);}
}
