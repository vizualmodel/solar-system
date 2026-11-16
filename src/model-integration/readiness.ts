import {get} from 'svelte/store';
import {tick} from 'svelte';
import {simulationState} from '../lib/store';
import {missionReady,missionViewStatus} from '../lib/mission-ui';
import {renderedViews,failedViews} from '../../model-service/readiness';
export async function waitForModelReady(){
 const deadline=Date.now()+60000;
 while(Date.now()<deadline){
  if(get(simulationState).mission?Object.values(get(missionViewStatus)).includes('error'):failedViews.size)throw Error('A simulation view failed to render.');
  if(get(simulationState).mission?get(missionReady):get(simulationState).views.every(view=>renderedViews.has(view.id))){await tick();return;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('Simulation readiness timed out. No readiness acknowledgement was sent.');
}
