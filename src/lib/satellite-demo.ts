import { satelliteSnapshots,satelliteMagnification,DEFAULT_SATELLITE_SIZE,satelliteAvailable } from './satellites';
import { byId,AU,type SatelliteId } from './catalog';
import { MINUTE_PER_SECOND,REAL_TIME } from './playback';
import type { SimulationState } from './simulation-state';

export function exploreSatellite(s:SimulationState,id:string,satellite:SatelliteId):SimulationState{
 const epoch=satelliteSnapshots[satellite].epoch;
 if(epoch<s.start||epoch>s.end)throw new Error(`${byId[satellite].name} data epoch is outside the selected timeline range.`);
 if(!s.views.some(v=>v.id===id))throw new Error('View not found.');
 return {...s,time:epoch,speed:MINUTE_PER_SECOND,playing:false,views:s.views.map(v=>v.id===id?{
  ...v,focus:'earth',satelliteFocus:null,satellites:[...new Set([...(v.satellites??[]),satellite])],
  satelliteSizes:{...v.satelliteSizes,[satellite]:satelliteMagnification(v,satellite)},
  satelliteSize:v.satelliteSize??DEFAULT_SATELLITE_SIZE,size:1,moonScale:1,follow:true,orbits:true,labels:true,
  camera:[0,0.00009,0.00014],target:[0,0,0]
 }:v)};
}
export function exploreHubble(s:SimulationState,id:string){return exploreSatellite(s,id,'hubble');}

export function issCloseUp(s:SimulationState,id:string):SimulationState{
 if(!s.views.some(v=>v.id===id))throw new Error('View not found.');
 if(!satelliteAvailable(s.time,'iss'))throw new Error('Choose a date on or after 20 November 1998.');
 // 300 metres from the station, tracking its origin each frame. Setup remains paused.
 const metresToAu=1/(1000*AU);
 return {...s,speed:REAL_TIME,playing:false,views:s.views.map(v=>v.id!==id?v:{
  ...v,cameraMode:'orbit',manualCamera:undefined,observer:undefined,focus:'earth',satelliteFocus:'iss',follow:true,
  satellites:[...new Set([...(v.satellites??[]),'iss'])],satelliteSizes:{...v.satelliteSizes,iss:1},
  size:1,moonScale:1,orbits:false,labels:false,moonUmbra:false,moonPenumbra:false,
  visible:[...new Set([...v.visible,'earth','sun'])],
  camera:[180*metresToAu,140*metresToAu,200*metresToAu],target:[0,0,0]
 })};
}
