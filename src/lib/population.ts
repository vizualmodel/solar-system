import {json2satrec,sgp4,type OMMJsonObject} from 'satellite.js';
import cache from '../data/satellite-population.json';
import {temeToEcliptic,SATELLITE_WINDOW} from './satellites';
import {DAY,eccentricAnomaly,type Vec3} from './ephemeris';

export const populationGroups=['geo','leo','starlink','navigation','gps'] as const;
export type PopulationGroup=typeof populationGroups[number];
export const populationLabels:Record<PopulationGroup,string>={geo:'Geosynchronous',leo:'Low Earth orbit (all)',starlink:'Starlink',navigation:'MEO navigation (all)',gps:'GPS'};
export const populationColors:Record<PopulationGroup,string>={geo:'#e7b76b',leo:'#72c8df',starlink:'#9caced',navigation:'#93d1a0',gps:'#93d1a0'};
export function classifyPopulation(e:OMMJsonObject,sourceGroups:string[]):PopulationGroup[]{
 const a=Math.cbrt(398600.4418/(Number(e.MEAN_MOTION)*2*Math.PI/86400)**2),apogee=a*(1+Number(e.ECCENTRICITY))-6378.137;
 const groups:PopulationGroup[]=[];
 if(sourceGroups.includes('geo'))groups.push('geo');
 if(apogee<=2000){groups.push('leo');if(/^STARLINK/i.test(e.OBJECT_NAME))groups.push('starlink');}
 if(sourceGroups.includes('gnss')&&a*(1-Number(e.ECCENTRICITY))-6378.137>2000&&apogee<35786){groups.push('navigation');if(/^GPS/i.test(e.OBJECT_NAME))groups.push('gps');}
 return groups;
}
export const population=cache.records.map(row=>{
 const elements=row.elements as OMMJsonObject;
 return {elements,id:Number(elements.NORAD_CAT_ID),name:elements.OBJECT_NAME,epoch:Date.parse(elements.EPOCH.replace(/Z$/,'')+'Z'),groups:classifyPopulation(elements,row.groups)};
}).filter(row=>row.groups.length);
export type PopulationSatellite=typeof population[number];
export const populationById=new Map(population.map(row=>[row.id,row]));
export const populationCounts=Object.fromEntries(populationGroups.map(group=>[group,population.filter(row=>row.groups.includes(group)).length])) as Record<PopulationGroup,number>;
export const populationFetchedAt=cache.fetchedAt;
export const populationMatches=(row:PopulationSatellite,groups:readonly string[])=>row.groups.some(g=>groups.includes(g));
export const populationIllustrative=(row:PopulationSatellite,time:number)=>Math.abs(time-row.epoch)>SATELLITE_WINDOW;
export function populationConstellation(row:PopulationSatellite){
 if(row.groups.includes('starlink'))return 'Starlink';
 if(row.groups.includes('gps'))return 'GPS';
 if(/^GSAT|GALILEO/i.test(row.name))return 'Galileo';
 if(/^COSMOS/i.test(row.name)&&row.groups.includes('navigation'))return 'GLONASS';
 if(/^BEIDOU/i.test(row.name))return 'BeiDou';
 if(/^ONEWEB/i.test(row.name))return 'OneWeb';
 return 'Other / unassigned';
}
const records=new Map<number,ReturnType<typeof json2satrec>>();
let frameTime=NaN,frame:Vec3[]=[];
function toScene(p:{x:number;y:number;z:number},time:number):Vec3{
 if(frameTime!==time){frame=[temeToEcliptic({x:1,y:0,z:0},time),temeToEcliptic({x:0,y:1,z:0},time),temeToEcliptic({x:0,y:0,z:1},time)];frameTime=time;}
 return frame[0].map((v,i)=>v*p.x+frame[1][i]*p.y+frame[2][i]*p.z) as Vec3;
}
/** Near epoch: SGP4. Far dates: bounded two-body mean-element illustration,
 * avoiding decades of extrapolated atmospheric drag. No historical claims. */
export function populationState(row:PopulationSatellite,time:number){
 if(!Number.isFinite(time))return null;
 if(!populationIllustrative(row,time)){
  let rec=records.get(row.id);if(!rec){rec=json2satrec(row.elements);records.set(row.id,rec);}
  const state=sgp4(rec,(time-row.epoch)/60000);
  if(!state||[...Object.values(state.position),...Object.values(state.velocity)].some(v=>!Number.isFinite(v)))return null;
  return {position:toScene(state.position,time),altitude:Math.hypot(...Object.values(state.position))-6378.137,speed:Math.hypot(...Object.values(state.velocity))};
 }
 const e=row.elements,n=Number(e.MEAN_MOTION)*2*Math.PI/86400,a=Math.cbrt(398600.4418/n**2),ecc=Number(e.ECCENTRICITY),rad=Math.PI/180;
 const anomaly=eccentricAnomaly((Number(e.MEAN_ANOMALY)*rad+n*(time-row.epoch)/1000)%(2*Math.PI),ecc);
 const x=a*(Math.cos(anomaly)-ecc),y=a*Math.sqrt(1-ecc*ecc)*Math.sin(anomaly);
 const w=Number(e.ARG_OF_PERICENTER)*rad,o=Number(e.RA_OF_ASC_NODE)*rad,i=Number(e.INCLINATION)*rad;
 const u=Math.cos(w)*x-Math.sin(w)*y,v=Math.sin(w)*x+Math.cos(w)*y;
 const position={x:Math.cos(o)*u-Math.sin(o)*Math.cos(i)*v,y:Math.sin(o)*u+Math.cos(o)*Math.cos(i)*v,z:Math.sin(i)*v};
 const radius=Math.hypot(x,y);
 return {position:toScene(position,time),altitude:radius-6378.137,speed:Math.sqrt(398600.4418*(2/radius-1/a))};
}
export function populationOrbit(row:PopulationSatellite,time:number):Vec3[]{
 const period=DAY/Number(row.elements.MEAN_MOTION),points:Vec3[]=[];
 for(let i=0;i<=192;i++){const state=populationState(row,time+(i/192-.5)*period);if(state)points.push(state.position);}
 return points;
}
