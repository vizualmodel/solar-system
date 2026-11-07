import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera,Vector3 } from 'three';
import { zoomTelescope,aimTelescope,TelescopeControls } from '../src/lib/telescope-controls';
import { mountedSurfaceCamera,mountDirection,OVIEDO,SPAIN_ECLIPSE_TIME } from '../src/lib/eclipse-camera';
import { defaultSimulationState,validateSimulationState } from '../src/lib/simulation-state';

test('optical zoom changes magnification without moving the camera, and clamps extreme input',()=>{
 const camera=new PerspectiveCamera(2);camera.position.set(1,2,3);const original=camera.position.clone();
 zoomTelescope(camera,100);assert.ok(camera.fov>2&&camera.fov<2.3);assert.deepEqual(camera.position,original);
 zoomTelescope(camera,-100);assert.ok(Math.abs(camera.fov-2)<1e-12);
 for(let i=0;i<200;i++)zoomTelescope(camera,200);assert.equal(camera.fov,100);
 for(let i=0;i<200;i++)zoomTelescope(camera,-200);assert.equal(camera.fov,0.1);assert.deepEqual(camera.position,original);
});
test('drag aims horizontally and vertically about a fixed mount with field-scaled sensitivity',()=>{
 const camera=new PerspectiveCamera(2);camera.position.set(0.0001,0.0002,0.0003);const original=camera.position.clone();
 const target=original.clone().add(new Vector3(0,0,-0.00001));camera.lookAt(target);
 const before=target.clone().sub(original).normalize();aimTelescope(camera,target,100,0,500);
 const after=target.clone().sub(original).normalize();assert.ok(after.x>0);assert.ok(before.angleTo(after)<0.01);
 aimTelescope(camera,target,0,-100,500);assert.ok(target.clone().sub(original).y>0);
 assert.deepEqual(camera.position,original);assert.ok(Math.abs(target.distanceTo(original)-0.00001)<1e-15);
});
test('the telescope remains anchored to its observer through time and ignores old dolly position',()=>{
 const view=defaultSimulationState().views[0];Object.assign(view,{focus:'earth',follow:true,size:1,cameraMode:'surface',observer:OVIEDO});
 const positions={earth:[1,0,0],sun:[0,0,0]} as Record<string,[number,number,number]>;
 const first=mountedSurfaceCamera(view,SPAIN_ECLIPSE_TIME,positions);
 const direction=first.target.map((v,i)=>v-first.camera[i]) as [number,number,number];
 view.camera=[4,5,6];view.manualCamera={up:first.up,fov:5,mountDirection:mountDirection(direction,SPAIN_ECLIPSE_TIME)};
 const later=mountedSurfaceCamera(view,SPAIN_ECLIPSE_TIME+3600000,positions);
 assert.ok(Math.abs(Math.hypot(...later.camera)-Math.hypot(...first.camera))<1e-15);assert.notDeepEqual(later.camera,first.camera);assert.equal(later.fov,5);
 assert.deepEqual(validateSimulationState({...defaultSimulationState(),views:[view]}).views[0].manualCamera,view.manualCamera);
});
test('actual wheel and pointer handlers persist lens/aim changes, not translation, and clean up',()=>{
 class Element extends EventTarget {clientHeight=500;ids=new Set<number>();setPointerCapture(id:number){this.ids.add(id);}hasPointerCapture(id:number){return this.ids.has(id);}releasePointerCapture(id:number){this.ids.delete(id);}}
 const element=new Element(),camera=new PerspectiveCamera(2),target=new Vector3(0,0,-1);camera.position.set(0,0,0.001);camera.lookAt(target);
 const original=camera.position.clone();let enabled=true,commits=0;
 const controls=new TelescopeControls(camera,target,element as any,()=>enabled,()=>{},()=>commits++);
 const fire=(name:string,props:any)=>{const e=new Event(name,{cancelable:true});Object.assign(e,props);element.dispatchEvent(e);return e;};
 fire('wheel',{deltaY:100,deltaMode:0});assert.ok(camera.fov>2);assert.equal(commits,1);
 fire('pointerdown',{pointerId:1,button:0,clientX:0,clientY:0});fire('pointermove',{pointerId:1,clientX:50,clientY:20});fire('pointerup',{pointerId:1});
 assert.deepEqual(camera.position,original);assert.equal(element.ids.size,0);
 enabled=false;const fov=camera.fov;fire('wheel',{deltaY:100,deltaMode:0});assert.equal(camera.fov,fov);
 enabled=true;controls.dispose();fire('wheel',{deltaY:100,deltaMode:0});assert.equal(camera.fov,fov);
});
