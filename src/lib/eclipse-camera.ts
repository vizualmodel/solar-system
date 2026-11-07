import { AU, byId } from './catalog';
import { bodyOrientation } from './rotation';
import { displayPosition } from './presentation';
import type { Vec3 } from './ephemeris';
import { validateSimulationState, newView, splitLayout, type SimulationState, type ViewConfig } from './simulation-state';

export interface SurfaceObserver { latitude:number; longitude:number; altitude:number; }
export interface CameraPose { camera:Vec3; target:Vec3; up:Vec3; fov:number; }
export function manualCameraPatch(pose:CameraPose):Partial<ViewConfig>{return {camera:[...pose.camera],target:[...pose.target],manualCamera:{up:[...pose.up],fov:pose.fov}};}
/** Keep the viewing direction, but use a local orbit pivot so gestures stay near Earth. */
export function interactiveEclipsePose(pose:CameraPose,mode:ViewConfig['cameraMode']):CameraPose {
 const direction=unit(pose.target.map((v,i)=>v-pose.camera[i]) as Vec3);
 const distance=mode==='surface'?0.00001:0.001;
 return {...pose,target:pose.camera.map((v,i)=>v+direction[i]*distance) as Vec3};
}
const unit=(v:Vec3):Vec3=>{const length=Math.hypot(...v);return v.map(x=>x/length) as Vec3;};
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const OVIEDO:SurfaceObserver={latitude:43.3619,longitude:-5.8494,altitude:232};
// First external contact at Oviedo in the bundled orbital model (not a published contact prediction).
export const SPAIN_ECLIPSE_TIME=Date.parse('2026-08-12T17:31:37.472Z');
export const SURFACE_ECLIPSE_FOV=8;

/** Geographic east is -Z in the renderer's body-fixed basis. Altitude is metres. */
export function surfaceOffset(observer:SurfaceObserver,time:number):Vec3 {
 const lat=observer.latitude*Math.PI/180,lon=observer.longitude*Math.PI/180;
 const {x,y,z}=bodyOrientation('earth',time),radius=(byId.earth.radius+observer.altitude/1000)/AU;
 return x.map((v,i)=>radius*(v*Math.cos(lat)*Math.cos(lon)+y[i]*Math.sin(lat)-z[i]*Math.cos(lat)*Math.sin(lon))) as Vec3;
}
/** Signed angular gap between the visible solar and lunar limbs, in radians. */
export function solarContactGap(observer:SurfaceObserver,time:number,positions:Record<string,Vec3>):number {
 const earth=displayPosition('earth',positions,1),offset=surfaceOffset(observer,time);
 const direction=(id:string)=>displayPosition(id,positions,1).map((v,i)=>v-earth[i]-offset[i]) as Vec3;
 const sun=direction('sun'),moon=direction('moon'),ds=Math.hypot(...sun),dm=Math.hypot(...moon);
 const a=unit(sun),b=unit(moon);
 const separation=Math.atan2(Math.hypot(...cross(a,b)),a.reduce((sum,v,i)=>sum+v*b[i],0));
 return separation-Math.asin(byId.sun.radius/AU/ds)-Math.asin(byId.moon.radius/AU/dm);
}
export function surfaceCamera(observer:SurfaceObserver,time:number,positions:Record<string,Vec3>):CameraPose {
 const earth=displayPosition('earth',positions,1),sun=displayPosition('sun',positions,1);
 const camera=surfaceOffset(observer,time);
 return {camera,target:sun.map((v,i)=>v-earth[i]) as Vec3,up:unit(camera),fov:SURFACE_ECLIPSE_FOV};
}
/** Manual telescope direction is body-fixed, so the mount follows Earth's rotation. */
export function mountedSurfaceCamera(view:ViewConfig,time:number,positions:Record<string,Vec3>):CameraPose {
 const pose=interactiveEclipsePose(surfaceCamera(view.observer!,time,positions),'surface');
 if(!view.manualCamera)return pose;
 const basis=bodyOrientation('earth',time),local=view.manualCamera.mountDirection;
 const direction=local?basis.x.map((v,i)=>v*local[0]+basis.y[i]*local[1]+basis.z[i]*local[2]) as Vec3:unit(view.target.map((v,i)=>v-view.camera[i]) as Vec3);
 return {...pose,target:pose.camera.map((v,i)=>v+direction[i]*0.00001) as Vec3,fov:view.manualCamera.fov};
}
export function mountDirection(direction:Vec3,time:number):Vec3 {
 const basis=bodyOrientation('earth',time),d=unit(direction);
 return [basis.x,basis.y,basis.z].map(axis=>axis.reduce((sum,v,i)=>sum+v*d[i],0)) as Vec3;
}
/** A nearby, slightly off-axis view lets Earth, Moon and the shadow separate visibly. */
export function alignmentCamera(positions:Record<string,Vec3>):CameraPose {
 const earth=displayPosition('earth',positions,1),sun=displayPosition('sun',positions,1);
 const towardSun=unit(sun.map((v,i)=>v-earth[i]) as Vec3);
 const side=unit(cross(towardSun,Math.abs(towardSun[1])<0.95?[0,1,0]:[1,0,0]));
 return {camera:towardSun.map((v,i)=>-v*0.0006+side[i]*0.00018) as Vec3,target:towardSun.map(v=>v*0.03) as Vec3,up:[0,1,0],fov:45};
}
/** Preserve other views and session settings; replace the active view and append its companion. */
export function spainEclipseState(input:SimulationState):SimulationState {
 const s=validateSimulationState(input);
 if(SPAIN_ECLIPSE_TIME<s.start||SPAIN_ECLIPSE_TIME>s.end)throw new Error('August 12, 2026 is outside the current FROM/TO range.');
 if(s.views.length>=6)throw new Error('Close a view before opening the two-view eclipse preset.');
 const index=s.views.findIndex(v=>v.id===s.active),id=s.active;
 const shared={focus:'earth',satelliteFocus:null,follow:true,size:1,moonScale:1,orbits:false,labels:false,stars:true,constellations:false,visible:['sun','earth','moon'],satellites:[],moonPenumbra:false} as const;
 const overview={...s.views[index],...shared,visible:[...shared.visible],satellites:[],cameraMode:'alignment' as const,manualCamera:undefined,observer:undefined,moonUmbra:true};
 const ground={...newView(),...shared,visible:[...shared.visible],satellites:[],cameraMode:'surface' as const,observer:{...OVIEDO},moonUmbra:false};
 s.views[index]=overview;s.views.push(ground);s.layout=splitLayout(s.layout,id,ground.id,'row');s.active=ground.id;s.time=SPAIN_ECLIPSE_TIME;
 return validateSimulationState(s);
}
