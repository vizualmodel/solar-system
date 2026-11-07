import { json2satrec,sgp4,eciToEcf,gstime,type PositionAndVelocity,type OMMJsonObject } from 'satellite.js';
import data from '../data/hubble.json';
import issData from '../data/iss.json';
import { AU,type SatelliteId } from './catalog';
import { DAY,eccentricAnomaly,type Vec3 } from './ephemeris';
import { bodyOrientation } from './rotation';
import type { ViewConfig } from './simulation-state';

export const hubbleEpoch=Date.parse(data.elements.EPOCH+'Z');
// This is a conservative visualization window, not a positional-error guarantee.
export const SATELLITE_WINDOW=3*DAY;
export const satelliteDataSource=data.sourceUrl;
export const DEFAULT_SATELLITE_SIZE=10000;
export const hubblePeriod=DAY/data.elements.MEAN_MOTION;
const datasets={hubble:data,iss:issData};
export const satelliteSnapshots=Object.fromEntries(Object.entries(datasets).map(([id,d])=>[id,{
 epoch:Date.parse(d.elements.EPOCH.endsWith('Z')?d.elements.EPOCH:d.elements.EPOCH+'Z'),
 period:DAY/Number(d.elements.MEAN_MOTION),sourceUrl:d.sourceUrl,norad:Number(d.elements.NORAD_CAT_ID)
}])) as Record<SatelliteId,{epoch:number;period:number;sourceUrl:string;norad:number}>;
const records={hubble:json2satrec(data.elements as OMMJsonObject),iss:json2satrec(issData.elements as OMMJsonObject)};
const boundaryStates=new Map<string,PositionAndVelocity>();
// Dates mark independent orbital operation (ISS starts with Zarya). Date precision is one day.
export const satelliteLaunchDates:Record<SatelliteId,number>={hubble:Date.parse('1990-04-25T00:00:00Z'),iss:Date.parse('1998-11-20T00:00:00Z')};
export function satelliteAccuracy(time:number,id:SatelliteId){return !satelliteAvailable(time,id)?'unavailable':Math.abs(time-satelliteSnapshots[id].epoch)<=SATELLITE_WINDOW?'snapshot':'illustrative';}
/** Two-body continuation anchored to the nearest edge of the SGP4 window.
 * Maintains position/velocity continuity without extrapolating drag for decades.
 * Historical altitude, manoeuvres, precession and phase are NOT reconstructed. */
function illustrativeState(id:SatelliteId,time:number):PositionAndVelocity|null{
 const anchor=satelliteSnapshots[id].epoch+Math.sign(time-satelliteSnapshots[id].epoch)*SATELLITE_WINDOW;
 const key=id+anchor;let state=boundaryStates.get(key);
 if(!state){const computed=sgp4(records[id],(anchor-satelliteSnapshots[id].epoch)/60000);if(!computed)return null;state=computed;boundaryStates.set(key,state);}
 const r=newVector(state.position),v=newVector(state.velocity),mu=398600.4418;
 const dot=(a:number[],b:number[])=>a.reduce((s,x,i)=>s+x*b[i],0);
 const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const radius=Math.hypot(...r),h=cross(r,v),hn=Math.hypot(...h),vxh=cross(v,h);
 const ev=r.map((x,i)=>vxh[i]/mu-x/radius),e=Math.hypot(...ev),a=1/(2/radius-dot(v,v)/mu);
 const p=e>1e-10?ev.map(x=>x/e):r.map(x=>x/radius),q=cross(h.map(x=>x/hn),p);
 const E0=Math.atan2(dot(r,q)/(a*Math.sqrt(1-e*e)),dot(r,p)/a+e),n=Math.sqrt(mu/a**3);
 const E=eccentricAnomaly(E0-e*Math.sin(E0)+n*((time-anchor)/1000),e),c=Math.cos(E),s=Math.sin(E),f=Math.sqrt(1-e*e);
 const position=p.map((x,i)=>a*((c-e)*x+f*s*q[i])),velocity=p.map((x,i)=>a*n/(1-e*c)*(-s*x+f*c*q[i]));
 return {...state,position:{x:position[0],y:position[1],z:position[2]},velocity:{x:velocity[0],y:velocity[1],z:velocity[2]}};
}
function newVector(v:{x:number;y:number;z:number}){return [v.x,v.y,v.z];}
function propagatedState(id:SatelliteId,time:number){return Math.abs(time-satelliteSnapshots[id].epoch)<=SATELLITE_WINDOW?sgp4(records[id],(time-satelliteSnapshots[id].epoch)/60000):illustrativeState(id,time);}
const cache=new Map<SatelliteId,{time:number;state:PositionAndVelocity|null}>();
export function satelliteMagnification(view:ViewConfig,id:SatelliteId){return view.satelliteSizes?.[id]??(id==='hubble'?(view.satelliteSize??DEFAULT_SATELLITE_SIZE):1000);}
export function satelliteAvailable(time:number,id:SatelliteId='hubble'){return Number.isFinite(time)&&time>=satelliteLaunchDates[id];}
export function satelliteState(id:SatelliteId,time:number):PositionAndVelocity|null{
 if(!satelliteAvailable(time,id))return null;
 const previous=cache.get(id);
 if(previous?.time===time)return previous.state;
 const state=propagatedState(id,time);
 cache.set(id,{time,state});return state;
}
export function hubbleState(time:number){return satelliteState('hubble',time);}

/** TEME -> Earth-fixed via GMST -> our existing IAU Earth orientation.
 * Approximate J2000 ecliptic coordinates; polar motion and nutation are omitted. */
export function temeToEcliptic(position:{x:number;y:number;z:number},time:number):Vec3{
 const fixed=eciToEcf(position,gstime(new Date(time))),frame=bodyOrientation('earth',time);
 const scene=frame.x.map((v,i)=>(v*fixed.x-frame.z[i]*fixed.y+frame.y[i]*fixed.z)/AU) as Vec3;
 return [scene[0],-scene[2],scene[1]];
}
export function satelliteRelativePosition(id:SatelliteId,time:number):Vec3|null{
 const state=satelliteState(id,time);
 return state?temeToEcliptic(state.position,time):null;
}
export function hubbleRelativePosition(time:number){return satelliteRelativePosition('hubble',time);}
export function withSatellitePositions(positions:Record<string,Vec3>,time:number):Record<string,Vec3>{
 if(!positions.earth)return positions;
 let result=positions;
 for(const id of Object.keys(datasets) as SatelliteId[]){
  const relative=satelliteRelativePosition(id,time);
  if(relative){if(result===positions)result={...positions};result[id]=relative.map((v,i)=>v+positions.earth[i]) as Vec3;}
 }
 return result;
}

/** One revolution of the selected propagation model, centred at the satellite.
 * SGP4 precession means endpoints should not be forced into a closed loop. */
export function satelliteOrbitPath(id:SatelliteId,time:number,cameraFromBody:Vec3,pixelAngle:number):Vec3[]{
 const current=satelliteRelativePosition(id,time),{period}=satelliteSnapshots[id];
 if(!current)return [];
 function point(offset:number):Vec3{
  // The trail may extend half a period beyond the display window at its endpoints.
  const t=time+offset,state=propagatedState(id,t);
  if(!state)return [0,0,0];
  const p=temeToEcliptic(state.position,t);
  return [p[0]-current![0],p[2]-current![2],-(p[1]-current![1])];
 }
 const points:Vec3[]=[];
 function refine(start:number,a:Vec3,end:number,b:Vec3,depth:number){
  const middle=(start+end)/2,m=point(middle);
  const error=Math.hypot(...m.map((v,i)=>v-(a[i]+b[i])/2));
  const distance=Math.min(...[a,m,b].map(p=>Math.hypot(...p.map((v,i)=>v-cameraFromBody[i]))));
  if(error>0.2*pixelAngle*Math.max(distance,1e-10)&&depth<12){refine(start,a,middle,m,depth+1);refine(middle,m,end,b,depth+1);}
  else points.push(b);
 }
 for(let i=0;i<64;i++){
  const start=(i/64-0.5)*period,end=((i+1)/64-0.5)*period;
  const a=i===32?[0,0,0] as Vec3:point(start),b=i===31?[0,0,0] as Vec3:point(end);
  if(i===0)points.push(a);
  refine(start,a,end,b,0);
 }
 // sgp4 mutates record.error, but the cached current state remains independent.
 return points;
}
export function hubbleOrbitPath(time:number,cameraFromBody:Vec3,pixelAngle:number){return satelliteOrbitPath('hubble',time,cameraFromBody,pixelAngle);}
