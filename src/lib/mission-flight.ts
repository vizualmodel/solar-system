import {Vector3} from 'three';
import {AU} from './catalog';
import {bodyOrientation} from './rotation';
import {missionTime,missionElapsed,missionById,chapterFraction,type MissionState} from './mission';
export interface MissionContext {source:string;timeType:string;bodies:Record<'earth'|'moon',{sourceUrl:string;rows:number[][]}>;}
export const METRES_PER_AU=1000*AU;
const unit=(v:Vector3)=>v.clone().normalize(),mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const launch=Date.parse('1969-07-16T13:32:00Z'),landing=102*3600+45*60+40;
export function validateMissionContext(input:unknown):MissionContext{
 const d=input as MissionContext;
 if(!d||d.timeType!=='UT')throw new Error('Invalid historical context time scale.');
 for(const id of ['earth','moon'] as const){const rows=d.bodies?.[id]?.rows;if(!rows||rows.length<2||rows.some((r,i)=>r.length!==7||r.some(n=>!Number.isFinite(n))||i>0&&r[0]<=rows[i-1][0]))throw new Error('Invalid historical vectors.');
  if(rows[0][0]>(launch-13*3600000)/86400000+2440587.5||rows.at(-1)![0]<(launch+(195*3600+18*60+35)*1000)/86400000+2440587.5)throw new Error('Historical context does not cover the mission.');}
 return d;
}
/** Cubic Hermite interpolation of hourly JPL geometric position/velocity vectors. */
export function historicalVector(data:MissionContext,id:'earth'|'moon',time:number){
 const rows=data.bodies[id].rows,jd=time/86400000+2440587.5;
 if(jd<rows[0][0]||jd>rows.at(-1)![0])throw new Error('Outside the historical context.');
 let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid][0]<=jd)lo=mid;else hi=mid;}
 const a=rows[lo],b=rows[hi],seconds=(b[0]-a[0])*86400,t=(jd-a[0])/(b[0]-a[0]),t2=t*t,t3=t2*t;
 const values=[0,1,2].map(i=>(2*t3-3*t2+1)*a[i+1]+(t3-2*t2+t)*seconds*a[i+4]+(-2*t3+3*t2)*b[i+1]+(t3-t2)*seconds*b[i+4]);
 return new Vector3(values[0]/AU,values[2]/AU,-values[1]/AU);
}
export function surfaceDirection(body:string,time:number,latitude:number,longitude:number){
 const f=bodyOrientation(body,time),lat=latitude*Math.PI/180,lon=longitude*Math.PI/180;
 return new Vector3().fromArray(f.x).multiplyScalar(Math.cos(lat)*Math.cos(lon)).addScaledVector(new Vector3().fromArray(f.y),Math.sin(lat)).addScaledVector(new Vector3().fromArray(f.z),-Math.cos(lat)*Math.sin(lon)).normalize();
}
const launchUp=surfaceDirection('earth',launch,28.608,-80.604),north=new Vector3().fromArray(bodyOrientation('earth',launch).y);
const east=new Vector3().crossVectors(north,launchUp).normalize();
const landingUp=surfaceDirection('moon',launch+landing*1000,0.67408,23.47297),lunarEast=new Vector3().crossVectors(new Vector3().fromArray(bodyOrientation('moon',launch+landing*1000).y),landingUp).normalize();
export function earthFlight(met:number){
 const t=Math.max(0,met),angle=t<710?.18*(t/710)**2:.18+(t-710)*2*Math.PI/5300;
 let altitude=185000;
 if(t<164)altitude=67000*(t/164)**1.65;else if(t<555)altitude=mix(67000,185000,(t-164)/391);
 const up=t<710?surfaceDirection('earth',launch+t*1000,28.608,-80.604):surfaceDirection('earth',launch+710000,28.608,-80.604);
 const tangent=new Vector3().crossVectors(north,up).normalize();
 return up.multiplyScalar(Math.cos(angle)).addScaledVector(tangent,Math.sin(angle)).multiplyScalar((6371000+altitude+63)/METRES_PER_AU);
}
export function lunarOrbit(data:MissionContext,met:number,altitude=110000){
 const angle=(met-landing)*2*Math.PI/7100;
 return historicalVector(data,'moon',launch+met*1000).add(landingUp.clone().multiplyScalar(Math.cos(angle)*(1737400+altitude)/METRES_PER_AU)).addScaledVector(lunarEast,Math.sin(angle)*(1737400+altitude)/METRES_PER_AU);
}
export function transferPoint(data:MissionContext,met:number,returning=false){
 const start=returning?135*3600+23*60+42:2*3600+50*60,end=returning?195*3600+3*60:75*3600+50*60;
 const f=Math.max(0,Math.min(1,(met-start)/(end-start))),u=returning?f**1.45:1-(1-f)**1.45;
 const a=returning?lunarOrbit(data,start):earthFlight(start),b=returning?surfaceDirection('earth',launch+end*1000,0,-165).multiplyScalar((6371000+120000)/METRES_PER_AU):lunarOrbit(data,end);
 const curve=unit(new Vector3().crossVectors(unit(b.clone().sub(a)),new Vector3(0,1,0)));
 const point=a.lerp(b,u).addScaledVector(curve,Math.sin(Math.PI*u)*.00025);
 // Keep an illustrative arc outside both bodies, including during close approach.
 const earthMinimum=(6371000+120000)/METRES_PER_AU;
 if(point.length()<earthMinimum)point.setLength(earthMinimum);
 const moon=historicalVector(data,'moon',launch+met*1000),offset=point.clone().sub(moon),moonMinimum=(1737400+110000)/METRES_PER_AU;
 if(offset.length()<moonMinimum)point.copy(moon).add(offset.setLength(moonMinimum));
 return point;
}
export function missionPose(data:MissionContext,m:MissionState){
 const met=missionElapsed(m),time=missionTime(m),chapter=missionById.get(m.id)!.chapters[m.chapter],p=chapterFraction(m),moon=historicalVector(data,'moon',time);
 const ground=surfaceDirection('moon',time,0.67408,23.47297),tangent=new Vector3().crossVectors(new Vector3().fromArray(bodyOrientation('moon',time).y),ground).normalize();
 let position:Vector3,up:Vector3;
 switch(chapter.scene){
  case 'launch':case 'parking':case 'tli':position=earthFlight(met);up=unit(position);break;
  case 'docking':case 'outbound':position=transferPoint(data,met);up=unit(position);break;
  case 'lunar-orbit':case 'undocking':case 'depart':position=lunarOrbit(data,met);up=unit(position.clone().sub(moon));break;
  case 'landing':{
   const angle=.22*(1-p),radius=1737400+15000*(1-p)**2+3.5;
   up=ground.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent,Math.sin(angle));position=moon.clone().addScaledVector(up,radius/METRES_PER_AU);break;
  }
  case 'surface':up=ground;position=moon.clone().addScaledVector(up,(1737400+3.5)/METRES_PER_AU);break;
  case 'ascent':up=ground.clone().multiplyScalar(Math.cos(p*.19)).addScaledVector(tangent,Math.sin(p*.19));position=moon.clone().addScaledVector(up,(1737400+3.5+90000*p*p)/METRES_PER_AU);break;
  case 'rendezvous':position=lunarOrbit(data,met);up=unit(position.clone().sub(moon));break;
  case 'homeward':position=transferPoint(data,met,true);up=unit(position);break;
  case 'entry':{
   const normal=surfaceDirection('earth',time,13.3,-169.15),altitude=p<.5?mix(200000,3000,p/.5):3000*((1-p)/.5)**2;
   up=normal;position=normal.clone().multiplyScalar((6371000+altitude+.3)/METRES_PER_AU);break;
  }
  default:throw new Error('Unsupported mission scene.');
 }
 const forward=unit(new Vector3().crossVectors(up,new Vector3(0,1,0)));
 return {time,met,p,scene:chapter.scene,position,up,forward,moon,sun:historicalVector(data,'earth',time).negate(),ground:moon.clone().addScaledVector(ground,1737400/METRES_PER_AU)};
}
