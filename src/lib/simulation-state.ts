import { bodies, byId,satellites,type SatelliteId } from './catalog';
import type { Vec3 } from './ephemeris';
import {missionById,type MissionState} from './mission';
import {validateMissionViews} from './mission-views';
import type {Layout} from './layout';
export {splitLayout,removeLayout,type Layout} from './layout';
export const MIN_TIME=Date.parse('1990-01-01T00:00:00Z'),MAX_TIME=Date.parse('2031-01-01T00:00:00Z');
// Optional for existing version-1 sessions; an absent switch enables scenery in surface views.
export interface ViewConfig { localLandscape?:boolean; }
export interface ViewConfig { populationGroups?:import('./population').PopulationGroup[]; populationSelection?:number|null; }
export interface SimulationState {mission?:MissionState;}
export interface ViewConfig {id:string;focus:string;follow:boolean;orbits:boolean;labels:boolean;stars:boolean;constellations:boolean;moonUmbra:boolean;moonPenumbra:boolean;size:number;moonScale:number;visible:string[];camera:Vec3;target:Vec3;cameraMode?:'orbit'|'alignment'|'surface';manualCamera?:{up:Vec3;fov:number;mountDirection?:Vec3};observer?:{latitude:number;longitude:number;altitude:number};satellites?:string[];satelliteSize?:number;satelliteFocus?:SatelliteId|null;satelliteSizes?:Partial<Record<SatelliteId,number>>;}
export interface SimulationState {version:1;name:string;time:number;start:number;end:number;speed:number;playing:boolean;views:ViewConfig[];layout:Layout;active:string;}
export function newView(id:string=crypto.randomUUID()):ViewConfig{return {id,focus:'sun',follow:true,orbits:true,labels:true,stars:true,constellations:false,moonUmbra:false,moonPenumbra:false,size:60,moonScale:1,visible:bodies.map(b=>b.id),camera:[0,22,32],target:[0,0,0]};}
export function defaultSimulationState(preset='overview'):SimulationState {
 const view=newView('primary');if(preset==='earth'){view.focus='earth';view.camera=[0,0.008,0.012];view.size=1;}
 if(preset==='inner'){view.camera=[0,2.8,4.2];view.size=30;}
 return {version:1,name:preset==='earth'?'Earth & Moon':'Solar system exploration',time:Math.min(MAX_TIME,Math.max(MIN_TIME,Date.now())),start:MIN_TIME,end:MAX_TIME,speed:10,playing:false,views:[view],layout:{kind:'view',id:view.id},active:view.id};
}
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const vector=(x:unknown):x is Vec3=>Array.isArray(x)&&x.length===3&&x.every(v=>finite(v)&&Math.abs(v)<=10000);
export function validateSimulationState(input:unknown):SimulationState {
 const s=structuredClone(input) as SimulationState;
 if(!s||s.version!==1||typeof s.name!=='string'||s.name.length>120||![s.time,s.start,s.end,s.speed].every(finite)||s.start<MIN_TIME||s.end>MAX_TIME||s.start>=s.end||s.time<s.start||s.time>s.end||Math.abs(s.speed)>365||typeof s.playing!=='boolean'||!Array.isArray(s.views)||s.views.length<1||s.views.length>6)throw new Error('Invalid simulation state or unsupported date range.');
 if(s.mission!==undefined){
  const m=s.mission,d=missionById.get(m?.id);
  if(!m||m.version!==1||!d||!Number.isInteger(m.chapter)||m.chapter<0||m.chapter>=d.chapters.length||!finite(m.elapsed)||m.elapsed<0||m.elapsed>d.chapters[m.chapter].duration||![0.5,1,2].includes(m.rate)||typeof m.playing!=='boolean'||s.playing||!m.returnState||m.returnState.mission!==undefined)throw new Error('Invalid mission playback state.');
  validateMissionViews(m);
  validateSimulationState(m.returnState);
 }
 const ids=new Set<string>();
 for(const v of s.views){
  if(v.populationGroups!==undefined&&(!Array.isArray(v.populationGroups)||v.populationGroups.some(g=>!['geo','leo','starlink','navigation','gps'].includes(g))))throw new Error('Invalid satellite population groups.');
  if(v.populationSelection!==undefined&&v.populationSelection!==null&&(!Number.isInteger(v.populationSelection)||v.populationSelection<=0||v.populationSelection>999999999))throw new Error('Invalid population satellite.');
  if(v.localLandscape!==undefined&&typeof v.localLandscape!=='boolean')throw new Error('Invalid local landscape setting.');
  if(v.cameraMode!==undefined&&!['orbit','alignment','surface'].includes(v.cameraMode))throw new Error('Invalid camera mode.');
  if(v.manualCamera!==undefined&&(!v.manualCamera||!vector(v.manualCamera.up)||Math.abs(Math.hypot(...v.manualCamera.up)-1)>1e-6||!finite(v.manualCamera.fov)||v.manualCamera.fov<0.1||v.manualCamera.fov>120))throw new Error('Invalid manual camera.');
  if(v.manualCamera?.mountDirection!==undefined&&(!vector(v.manualCamera.mountDirection)||Math.abs(Math.hypot(...v.manualCamera.mountDirection)-1)>1e-6))throw new Error('Invalid mounted camera direction.');
  const o=v.observer;
  if(o!==undefined&&(!o||![o.latitude,o.longitude,o.altitude].every(finite)||Math.abs(o.latitude)>90||Math.abs(o.longitude)>180||o.altitude<0||o.altitude>100000))throw new Error('Invalid surface observer.');
  if(v.cameraMode==='surface'&&(!o||v.focus!=='earth'||v.follow!==true||v.satelliteFocus||v.size!==1||v.moonScale!==1))throw new Error('Surface camera requires an Earth observer and true physical scale.');
  if(v.cameraMode==='alignment'&&(v.focus!=='earth'||v.follow!==true||v.satelliteFocus||v.size!==1||v.moonScale!==1))throw new Error('Alignment camera requires Earth tracking and true physical scale.');
 }
 // Version 1 sessions predate the optional constellation layer. Preserve every other setting.
 for(const v of s.views){if(v&&v.constellations===undefined)v.constellations=false;if(v&&typeof v.constellations!=='boolean')throw new Error('Invalid constellation setting.');}
 for(const v of s.views){if(v&&v.moonPenumbra===undefined)v.moonPenumbra=false;if(v&&typeof v.moonPenumbra!=='boolean')throw new Error('Invalid Moon penumbra setting.');}
 for(const v of s.views){if(v&&v.moonUmbra===undefined)v.moonUmbra=false;if(v&&typeof v.moonUmbra!=='boolean')throw new Error('Invalid Moon umbra setting.');}
 const satelliteId=(id:unknown)=>satellites.some(b=>b.id===id),magnification=(value:unknown)=>finite(value)&&value>=1&&value<=100000;
 for(const v of s.views){if(v.satellites!==undefined&&(!Array.isArray(v.satellites)||v.satellites.some(id=>!satelliteId(id))))throw new Error('Invalid satellite selection.');if(v.satelliteSize!==undefined&&!magnification(v.satelliteSize))throw new Error('Invalid satellite magnification.');if(v.satelliteFocus!==undefined&&v.satelliteFocus!==null&&!satelliteId(v.satelliteFocus))throw new Error('Invalid satellite focus.');if(v.satelliteSizes!==undefined&&(!v.satelliteSizes||typeof v.satelliteSizes!=='object'||Array.isArray(v.satelliteSizes)||Object.entries(v.satelliteSizes).some(([id,value])=>!satelliteId(id)||!magnification(value))))throw new Error('Invalid satellite magnifications.');}
 for(const v of s.views){if(!v||typeof v.id!=='string'||v.id.length>100||ids.has(v.id)||!Object.hasOwn(byId,v.focus)||!vector(v.camera)||Math.hypot(...v.camera)<(v.satelliteFocus?1e-12:1e-8)||!vector(v.target)||!finite(v.size)||v.size<1||v.size>200||!finite(v.moonScale)||v.moonScale<1||v.moonScale>100||![v.follow,v.orbits,v.labels,v.stars].every(x=>typeof x==='boolean')||!Array.isArray(v.visible)||v.visible.some(id=>!Object.hasOwn(byId,id)))throw new Error('Invalid view configuration.');ids.add(v.id);}
 const leaves:string[]=[];
 function walk(n:Layout,depth=0){if(!n||depth>6)throw new Error('Invalid layout.');if(n.kind==='view'){leaves.push(n.id);return;}if(n.kind!=='split'||!['row','column'].includes(n.direction)||!Array.isArray(n.children)||n.children.length!==2)throw new Error('Invalid layout.');n.children.forEach(c=>walk(c,depth+1));}
 walk(s.layout);if(leaves.length!==ids.size||new Set(leaves).size!==ids.size||leaves.some(id=>!ids.has(id))||!ids.has(s.active))throw new Error('Layout does not match views.');
 return structuredClone(s);
}
export const STORAGE_KEY='solar-observatory.scenario.v1';
