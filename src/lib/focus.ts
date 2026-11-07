import { byId,AU,type SatelliteId } from './catalog';
import type { ViewConfig } from './simulation-state';
import { updateView } from './store';
import { satelliteMagnification } from './satellites';
import { get } from 'svelte/store';
import { simulationState } from './store';
export function focus(id:string,body:string,preset:'system'|'portrait'='system') {
 const view=get(simulationState).views.find(v=>v.id===id);
 if(!view)throw new Error('View not found.');
 updateView(id,focusPatch(view,body,preset));
}
export function focusPatch(view:ViewConfig,body:string,preset:'system'|'portrait'='system'):Partial<ViewConfig> {
 if(!byId[body])throw new Error('Unknown body.');
 if(byId[body]?.kind==='satellite'){
  const d=Math.max(1e-10,byId[body].radius/AU*satelliteMagnification(view,body as SatelliteId)*8);
  return {cameraMode:'orbit',manualCamera:undefined,focus:'earth',satelliteFocus:body as SatelliteId,satellites:[...new Set([...(view.satellites??[]),body])],follow:true,camera:[0,d*0.55,d*0.85],target:[0,0,0],size:1};
 }
 const b=byId[body];const distances:Record<string,number>={sun:38,mercury:0.0008,venus:0.0015,earth:0.012,mars:0.0008,jupiter:0.035,saturn:0.045,uranus:0.018,neptune:0.018};
 const d=preset==='portrait'?b.radius/AU*7:(distances[body]??b.radius/AU*9);
 return {cameraMode:'orbit',manualCamera:undefined,focus:body,satelliteFocus:null,follow:true,camera:[0,d*0.55,d*0.85],target:[0,0,0],size:body==='sun'&&preset==='system'?60:1,moonScale:1};
}
