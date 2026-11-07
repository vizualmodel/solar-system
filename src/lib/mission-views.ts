import {splitLayout,removeLayout,type Layout} from './layout';
import type {Vec3} from './ephemeris';
import type {MissionState} from './mission';
export interface MissionCamera {position:Vec3;target:Vec3;up?:Vec3;}
export const missionViewModes=['guided','spacecraft','overview','earth','moon','pad'] as const;
export type MissionViewMode=typeof missionViewModes[number];
export const missionViewLabels:Record<MissionViewMode,string>={guided:'Story camera',spacecraft:'Follow spacecraft',overview:'Earth–Moon overview',earth:'Earth view',moon:'Moon view',pad:'Launch pad'};
export interface MissionView {id:string;mode:MissionViewMode;camera?:MissionCamera;}
export const missionViews=(m:MissionState):MissionView[]=>m.views??[{id:'mission-primary',mode:'guided',...(m.camera?{camera:m.camera}:{})}];
export const missionLayout=(m:MissionState):Layout=>m.layout??{kind:'view',id:missionViews(m)[0].id};
export const activeMissionView=(m:MissionState)=>m.active??missionViews(m)[0].id;
export function updateMissionView(m:MissionState,id:string,patch:Partial<Omit<MissionView,'id'>>):MissionState{
 if(!missionViews(m).some(v=>v.id===id))throw new Error('Unknown mission view.');
 return {...m,views:missionViews(m).map(v=>v.id===id?{...v,...patch}:v),layout:missionLayout(m),active:activeMissionView(m)};
}
export function splitMissionView(m:MissionState,id:string,newId:string,direction:'row'|'column'):MissionState{
 const views=missionViews(m),source=views.find(v=>v.id===id);
 if(!source||views.length>=6||views.some(v=>v.id===newId)||!newId)throw new Error('Cannot split this mission view (six-view limit).');
 return {...m,views:[...views,{id:newId,mode:source.mode==='overview'?'spacecraft':'overview'}],layout:splitLayout(missionLayout(m),id,newId,direction),active:newId};
}
export function closeMissionView(m:MissionState,id:string):MissionState{
 const views=missionViews(m);if(views.length===1||!views.some(v=>v.id===id))throw new Error('The final mission view cannot close.');
 return {...m,views:views.filter(v=>v.id!==id),layout:removeLayout(missionLayout(m),id)!,active:activeMissionView(m)===id?views.find(v=>v.id!==id)!.id:activeMissionView(m)};
}
export function validateMissionViews(m:MissionState){
 if(m.trajectoriesVisible!==undefined&&typeof m.trajectoriesVisible!=='boolean')throw new Error('Invalid mission trajectories setting.');
 const vector=(v:unknown):v is Vec3=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=10000);
 const camera=(c:MissionCamera|undefined)=>!c||vector(c.position)&&vector(c.target)&&Math.hypot(...c.position)>1e-14&&(c.up===undefined||vector(c.up)&&Math.abs(Math.hypot(...c.up)-1)<1e-6);
 if(!camera(m.camera))throw new Error('Invalid mission camera.');
 if(m.views!==undefined){
  if(!Array.isArray(m.views)||m.views.length<1||m.views.length>6||!m.layout||!m.active)throw new Error('Invalid mission views.');
  const ids=new Set<string>();for(const v of m.views){if(!v||typeof v.id!=='string'||!v.id||v.id.length>100||ids.has(v.id)||!missionViewModes.includes(v.mode)||!camera(v.camera))throw new Error('Invalid mission view.');ids.add(v.id);}
  const leaves:string[]=[];function walk(n:Layout,depth=0){if(!n||depth>6)throw new Error('Invalid mission layout.');if(n.kind==='view'){leaves.push(n.id);return;}if(n.kind!=='split'||!['row','column'].includes(n.direction)||!Array.isArray(n.children)||n.children.length!==2)throw new Error('Invalid mission layout.');n.children.forEach(c=>walk(c,depth+1));}
  walk(m.layout);if(leaves.length!==ids.size||new Set(leaves).size!==ids.size||leaves.some(id=>!ids.has(id))||!ids.has(m.active))throw new Error('Mission layout does not match its views.');
 }else if(m.layout!==undefined||m.active!==undefined)throw new Error('Mission layout requires views.');
 if(m.dashboardVisible!==undefined&&typeof m.dashboardVisible!=='boolean'||m.audioEnabled!==undefined&&typeof m.audioEnabled!=='boolean'||m.audioVolume!==undefined&&(!Number.isFinite(m.audioVolume)||m.audioVolume<0||m.audioVolume>1))throw new Error('Invalid mission dashboard or audio settings.');
}
