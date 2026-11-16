import {get} from 'svelte/store';
import {tick} from 'svelte';
import {simulationState} from '../lib/store';
import {applyBrowserRequest} from '../../model-service/browser-adapter';
import {positions,type Ephemeris} from '../lib/ephemeris';
import {withSatellitePositions} from '../lib/satellites';
import {snapshot} from '../../model-service/state';
import {waitForModelReady} from './readiness';
let orbitalData:Promise<Ephemeris>|undefined;
export async function executeModelControl(method:string,params:any,request:{id:string;expiresAt:number},assertActive:()=>void=()=>{}){
 assertActive();
 window.dispatchEvent(new Event('solar:save-cameras'));let context={};
 if(method==='camera'||method==='charts'&&params?.settings?.nextClosestApproach){
  orbitalData??=fetch('/data/ephemeris.json').then(response=>{if(!response.ok)throw Error('Orbital data unavailable.');return response.json();}).catch(error=>{orbitalData=undefined;throw error;});
  const data=await orbitalData;context={data,positions:withSatellitePositions(positions(data,get(simulationState).time),get(simulationState).time)};
 }
 assertActive();
 const result=applyBrowserRequest({...params,id:request.id,expiresAt:request.expiresAt,method},context);
 await tick();await waitForModelReady();return{...result,viewCount:get(simulationState).views.length,...(params?.detail==='full'?{state:snapshot({schema:1,simulationState:get(simulationState)})}:{})};
}
