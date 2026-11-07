import {missionById,missionElapsed,elapsedSeconds,type MissionState} from './mission';
import {historicalVector,earthFlight,transferPoint,type MissionContext} from './mission-flight';
import type {MissionView} from './mission-views';

/** Both paths use Earth-centred, fixed J2000 ecliptic axes (scene AU, Y up).
 * Camera-origin subtraction is a translation only; Earth rotation never enters here. */
export function moonMissionTrajectory(context:MissionContext,m:MissionState){
 const doc=missionById.get(m.id)!,launch=Date.parse(doc.launch),end=elapsedSeconds(doc.chapters.at(-1)!.end);
 return Array.from({length:257},(_,i)=>historicalVector(context,'moon',launch+end*1000*i/256));
}
export function spacecraftMissionTrajectory(context:MissionContext,m:MissionState){
 const chapter=missionById.get(m.id)!.chapters[m.chapter];
 if(chapter.scene==='parking'){
  const start=elapsedSeconds(chapter.start);
  return Array.from({length:257},(_,i)=>earthFlight(start+i*5300/256));
 }
 const returning=missionElapsed(m)>=135*3600+23*60+30;
 const start=returning?135*3600+23*60+42:2*3600+50*60,end=returning?195*3600+3*60:75*3600+50*60;
 return Array.from({length:257},(_,i)=>transferPoint(context,start+(end-start)*i/256,returning));
}
export function missionTrajectoriesVisible(m:MissionState,view:MissionView){
 return m.trajectoriesVisible!==false&&(view.mode==='guided'?missionById.get(m.id)!.chapters[m.chapter].camera==='overview':['overview','earth','moon'].includes(view.mode));
}
