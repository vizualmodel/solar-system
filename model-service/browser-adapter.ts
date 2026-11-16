import { get } from 'svelte/store';
import { simulationState, status } from '../src/lib/store';
import { validateSimulationState, STORAGE_KEY } from '../src/lib/simulation-state';
import { type SimulationRequest } from './simulation-protocol';
import { parseControl } from './control-schema';
import { applyControl } from './controls';
import { workspaceUi } from '../src/lib/workspace-ui';
import { settingsSections } from '../src/lib/settings-sections';
import type { Ephemeris, Vec3 } from '../src/lib/ephemeris';
import {population,populationCounts,populationMatches,populationById,populationState,populationIllustrative,populationConstellation,populationFetchedAt} from '../src/lib/population';
import {missionById,missionTime} from '../src/lib/mission';

export function applyBrowserRequest(request: SimulationRequest | ({method:string;id:string;expiresAt:number}&Record<string,any>), context:{data?:Ephemeris;positions?:Record<string,Vec3>}={}) {
  if (!Number.isFinite(request.expiresAt) || Date.now() >= request.expiresAt) throw new Error('Request expired; no command applied.');
  const {method,id,expiresAt,...params}=request;
  const p:any=parseControl(method,params);
  const before=validateSimulationState(get(simulationState)),ui=get(workspaceUi);
  if(before.mission&&!['get_simulation_state','workspace'].includes(method)&&!(method==='session'&&['save','export'].includes(p.action)))throw new Error('Stop the mission before using normal simulation controls.');
  const next=applyControl(before,method,p,{...context,from:ui.from,to:ui.to});
  // Validate the whole operation before committing either store.
  const persist=method==='session'&&['save','import','new'].includes(p.action);
  if(persist){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{throw new Error('Browser storage unavailable; session operation was not applied. Export your session to keep it.');}}
  if(method!=='get_simulation_state')simulationState.set(next);
  if(method==='workspace'){const {sections,...settings}=p.settings;workspaceUi.update(v=>({...v,...settings}));if(sections)settingsSections.update(v=>({...v,...sections}));}
  if(method==='charts'){const {open,from,to}=p.settings;workspaceUi.update(v=>({...v,...(open===undefined?{}:{charts:open}),...(from===undefined?{}:{from}),...(to===undefined?{}:{to})}));}
  if(persist)status.set(p.action==='import'?'Simulation state imported · paused':'Session saved on this browser');
  const actual = validateSimulationState(get(simulationState));
  return { time: new Date(actual.time).toISOString(), playing: actual.playing,
   ...(actual.mission?{mission:{id:actual.mission.id,title:missionById.get(actual.mission.id)!.title,time:new Date(missionTime(actual.mission)).toISOString(),chapter:actual.mission.chapter,playing:actual.mission.playing}}:{}),
   ...(method==='session'&&p.action==='export'?{simulationState:actual}:{}),
   ...(method==='session'&&p.action==='new'?{previousSimulationState:before}:{}),
   ...(p.detail==='full'?{ui:{...get(workspaceUi),sections:get(settingsSections)},population:{catalogueCount:population.length,counts:populationCounts,fetchedAt:populationFetchedAt,views:actual.views.map(view=>{
    const row=view.populationSelection?populationById.get(view.populationSelection):undefined;
    return {id:view.id,enabled:population.filter(row=>populationMatches(row,view.populationGroups??[])).length,selected:row?{norad:row.id,name:row.name,constellation:populationConstellation(row),epoch:new Date(row.epoch).toISOString(),illustrative:populationIllustrative(row,actual.time),periodMinutes:1440/Number(row.elements.MEAN_MOTION),inclination:Number(row.elements.INCLINATION),...populationState(row,actual.time)}:null};
   })}}:{}) };
}
