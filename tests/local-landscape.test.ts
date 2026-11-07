import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { LocalLandscape,observerFrame,landscapeHeight,landscapeEnabled,solarVisibility,EYE_HEIGHT } from '../src/lib/local-landscape';
import { OVIEDO,SPAIN_ECLIPSE_TIME,surfaceCamera,spainEclipseState } from '../src/lib/eclipse-camera';
import { positions,type Ephemeris } from '../src/lib/ephemeris';
import { displayPosition } from '../src/lib/presentation';
import { defaultSimulationState,validateSimulationState } from '../src/lib/simulation-state';
import { parseControl } from '../companion/control-schema';
import { snapshot,assertRestored } from '../companion/state';
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{}}});
Object.defineProperty(globalThis,'location',{configurable:true,value:{search:''}});
const {applyControl}=await import('../companion/controls');

test('local observer frames remain orthonormal, rotate with Earth, and preserve the astronomical camera',()=>{
 for(const observer of [OVIEDO,{latitude:90,longitude:0,altitude:0},{latitude:-90,longitude:132,altitude:1000}]){
  const a=observerFrame(observer,SPAIN_ECLIPSE_TIME),b=observerFrame(observer,SPAIN_ECLIPSE_TIME+3600000);
  assert.ok(Math.abs(a.determinant()-1)<1e-12);
  const identity=a.clone().transpose().multiply(a).elements;
  identity.forEach((v,i)=>assert.ok(Math.abs(v-(i%5===0?1:0))<1e-12));
  assert.notDeepEqual(a.elements,b.elements);
 }
 assert.equal(landscapeHeight(0,0),-EYE_HEIGHT);
 assert.ok(landscapeHeight(26000,0)<0); // Earth curvature keeps the outer edge below the horizon.
});

test('landscape toggle survives controls, session export and exact restoration without changing older sessions',()=>{
 const old=defaultSimulationState();assert.deepEqual(validateSimulationState(old),old);assert.equal(landscapeEnabled(old.views[0]),false);
 const s=spainEclipseState(old),view=s.views.find(v=>v.id===s.active)!;assert.equal(landscapeEnabled(view),true);
 const parameters=parseControl('scene',{settings:{localLandscape:false}});
 const changed=applyControl(s,'scene',parameters);assert.equal(landscapeEnabled(changed.views.find(v=>v.id===s.active)!),false);
 const exported=JSON.parse(JSON.stringify({schema:1,simulationState:changed}));assertRestored(snapshot(exported),structuredClone(exported));
 (view as any).localLandscape='yes';assert.throws(()=>validateSimulationState(s),/landscape/);
});

test('solar disc overlap handles totality, annular, partial and unobscured sunlight',()=>{
 assert.equal(solarVisibility(3,1,1),1);assert.equal(solarVisibility(0,1,1),0);
 assert.equal(solarVisibility(0,1,2),0);assert.equal(solarVisibility(0,2,1),0.75);
 assert.ok(Math.abs(solarVisibility(1,1,1)-0.608997781)<1e-8);
 for(let d=0;d<=2;d+=0.01)assert.ok(solarVisibility(d,1,1)<=solarVisibility(d+0.01,1,1));
});

test('local render pass keeps astronomical rays aligned and releases each owned resource once',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/data/ephemeris.json',import.meta.url),'utf8')) as Ephemeris;
 const p=positions(data,SPAIN_ECLIPSE_TIME),pose=surfaceCamera(OVIEDO,SPAIN_ECLIPSE_TIME,p);
 const camera=new THREE.PerspectiveCamera(pose.fov,1.7);camera.position.fromArray(pose.camera);camera.up.fromArray(pose.up);camera.lookAt(new THREE.Vector3(...pose.target));camera.updateMatrixWorld();
 const landscape=new LocalLandscape(),earth=new THREE.Vector3(...displayPosition('earth',p,1));
 const sun=new THREE.Vector3(...displayPosition('sun',p,1)).sub(earth),moon=new THREE.Vector3(...displayPosition('moon',p,1)).sub(earth);
 const before=camera.matrixWorld.clone();landscape.update(OVIEDO,SPAIN_ECLIPSE_TIME,camera,sun,moon);
 assert.deepEqual(camera.matrixWorld.elements,before.elements);assert.equal(landscape.camera.fov,camera.fov);assert.equal(landscape.camera.aspect,camera.aspect);
 const localRay=new THREE.Vector3(0,0,-1).applyQuaternion(landscape.camera.quaternion).transformDirection(observerFrame(OVIEDO,SPAIN_ECLIPSE_TIME));
 assert.ok(localRay.distanceTo(camera.getWorldDirection(new THREE.Vector3()))<1e-12);
 const order:string[]=[];landscape.render({clearDepth:()=>order.push('clear'),render:()=>order.push('render')} as unknown as THREE.WebGLRenderer);assert.deepEqual(order,['clear','render']);
 const geometryCounts=new Map<THREE.BufferGeometry,number>(),materialCounts=new Map<THREE.Material,number>();
 landscape.scene.traverse(object=>{if(object instanceof THREE.Mesh){geometryCounts.set(object.geometry,0);materialCounts.set(object.material,0);}});
 geometryCounts.forEach((_,g)=>g.addEventListener('dispose',()=>geometryCounts.set(g,geometryCounts.get(g)!+1)));
 materialCounts.forEach((_,m)=>m.addEventListener('dispose',()=>materialCounts.set(m,materialCounts.get(m)!+1)));
 landscape.dispose();landscape.dispose();assert.ok([...geometryCounts.values(),...materialCounts.values()].every(n=>n===1));assert.equal(landscape.scene.children.length,0);
});
