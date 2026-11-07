import { defaultSimulationState,validateSimulationState,splitLayout,removeLayout,MIN_TIME,MAX_TIME,type SimulationState } from '../src/lib/simulation-state';
import { focusPatch } from '../src/lib/focus';
import { changeTracking } from '../src/lib/presentation';
import { exploreSatellite,issCloseUp } from '../src/lib/satellite-demo';
import { satelliteAvailable } from '../src/lib/satellites';
import {populationById,populationMatches} from '../src/lib/population';
import { spainEclipseState,OVIEDO } from '../src/lib/eclipse-camera';
import { nextClosestApproach } from '../src/lib/closest-approach';
import type { Vec3,Ephemeris } from '../src/lib/ephemeris';
import { parseSimulationTime } from './simulation-protocol';
export function applyControl(input:SimulationState,method:string,p:any,context:{positions?:Record<string,Vec3>;data?:Ephemeris;from?:string;to?:string}={}) {
 let s=validateSimulationState(input);const id=p.viewId??s.active;
 const selected=()=>{const v=s.views.find(v=>v.id===id);if(!v)throw new Error('View not found.');return v;};
 const patch=(value:any)=>Object.assign(selected(),value);
 const q=p.settings??{};
 switch(method){
 case 'get_simulation_state':case 'workspace':break;
 case 'set_simulation_time':{const t=parseSimulationTime(p.time);if(t<s.start||t>s.end)throw new Error('Time is outside the current simulationState FROM/TO range.');s.time=t;break;}
 case 'timeline':{
  if([q.time!==undefined,q.stepSeconds!==undefined,q.jump!==undefined].filter(Boolean).length>1)throw new Error('Choose one time, stepSeconds or jump operation.');
  if(q.resetRange&&(q.start!==undefined||q.end!==undefined))throw new Error('Choose resetRange or explicit endpoints.');
  if(q.resetRange){s.start=MIN_TIME;s.end=MAX_TIME;}
  if(q.start!==undefined)s.start=parseSimulationTime(q.start);if(q.end!==undefined)s.end=parseSimulationTime(q.end);
  s.time=Math.max(s.start,Math.min(s.end,s.time));
  if(q.time!==undefined){const t=parseSimulationTime(q.time);if(t<s.start||t>s.end)throw new Error('Time is outside FROM/TO.');s.time=t;}
  if(q.stepSeconds!==undefined)s.time=Math.max(s.start,Math.min(s.end,s.time+q.stepSeconds*1000));
  if(q.jump)s.time=q.jump==='start'?s.start:s.end;
  if(q.speed!==undefined)s.speed=q.speed;if(q.playing!==undefined)s.playing=q.playing;break;
 }
 case 'camera':{
  const v=selected();
  if(q.focus!==undefined){if(['iss','hubble'].includes(q.focus)&&!satelliteAvailable(s.time,q.focus))throw new Error('Satellite data unavailable at this date.');patch(focusPatch(v,q.focus,q.preset==='portrait'?'portrait':'system'));}
  else if(q.preset==='system'||q.preset==='portrait')patch(focusPatch(v,v.satelliteFocus??v.focus,q.preset));
  if(q.mode!==undefined)patch({cameraMode:q.mode,manualCamera:undefined});
  if(q.mode==='surface'||q.mode==='alignment')patch({focus:'earth',satelliteFocus:null,follow:true,size:1,moonScale:1,...(q.mode==='surface'?{observer:q.observer??v.observer??OVIEDO}:{})});
  if(q.observer!==undefined)patch({observer:q.observer,manualCamera:undefined});
  if(q.follow!==undefined&&q.follow!==v.follow){if(!context.positions?.[v.satelliteFocus??v.focus])throw new Error('Tracking requires current body positions.');patch(changeTracking(v,context.positions));}
  if(q.preset==='top'||q.preset==='inclined'){const d=Math.hypot(...v.camera);patch({camera:q.preset==='top'?[0,d,0.000001]:[0,d*0.55,d*0.85],target:[0,0,0]});}
  if(q.camera!==undefined)patch({camera:q.camera});if(q.target!==undefined)patch({target:q.target});break;
 }
 case 'scene':patch(q);break;
 case 'satellites':
  if(q.populationGroups!==undefined)patch({populationGroups:q.populationGroups,populationSelection:null});
  if(q.populationSelection!==undefined){
   const row=q.populationSelection===null?null:populationById.get(q.populationSelection);
   if(q.populationSelection!==null&&(!row||!populationMatches(row,selected().populationGroups??[])))throw new Error('Satellite is not in an enabled population.');
   patch({populationSelection:q.populationSelection});
  }
  if(q.closeUp==='iss')s=issCloseUp(s,id);
  if(q.explore)s=exploreSatellite(s,id,q.explore);
  if(q.visible!==undefined)patch({satellites:q.visible});
  if(q.magnification)patch({satelliteSizes:{...selected().satelliteSizes,...q.magnification}});
  if(q.focus){if(!satelliteAvailable(s.time,q.focus))throw new Error('Satellite data unavailable at this date.');patch(focusPatch(selected(),q.focus));}break;
 case 'views':{
  selected();
  if(p.action==='select')s.active=id;
  if(p.action==='split'){if(s.views.length>=6)throw new Error('Up to six simultaneous views are supported.');const v=structuredClone(selected());v.id=crypto.randomUUID();s.views.push(v);s.layout=splitLayout(s.layout,id,v.id,p.direction??'row');s.active=v.id;}
  if(p.action==='close'){if(s.views.length===1)throw new Error('Cannot close the final view.');s.views=s.views.filter(v=>v.id!==id);s.layout=removeLayout(s.layout,id)!;if(s.active===id)s.active=s.views[0].id;}
  if(p.action==='layout'){if(!p.layout)throw new Error('Supply a layout.');s.layout=p.layout;}break;
 }
 case 'session':
  if(p.action==='rename'){if(p.name===undefined)throw new Error('Supply a name.');s.name=p.name;}
  if(p.action==='import'){if(p.simulationState!==undefined&&p.scenario!==undefined)throw new Error('Supply simulationState only.');s=validateSimulationState(p.simulationState??p.scenario);s.playing=false;}
  if(p.action==='new')s=defaultSimulationState(p.preset==='spain-eclipse'?'overview':p.preset);
  if(p.action==='preset'||p.action==='new'&&p.preset==='spain-eclipse'){
   if(!p.preset)throw new Error('Supply a preset.');
   if(p.preset==='spain-eclipse')s=spainEclipseState(s);else s=defaultSimulationState(p.preset);
  }break;
 case 'charts':
  if(q.nextClosestApproach){if(!context.data)throw new Error('Orbital data unavailable.');const r=nextClosestApproach(context.data,q.from??context.from!,q.to??context.to!,s.time,s.end);if(!r)throw new Error('No next closest approach before TO.');s.time=r.time;s.playing=false;}break;
 default:throw new Error('Unsupported simulation operation.');
 }
 return validateSimulationState(s);
}
