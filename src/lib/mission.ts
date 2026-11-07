import apollo from '../data/apollo-11.json';
import type {SimulationState} from './simulation-state';
import type {Vec3} from './ephemeris';
import type {Layout} from './layout';
import type {MissionView,MissionCamera} from './mission-views';

export interface MissionChapter {id:string;title:string;start:string;end:string;duration:number;scene:string;camera:'spacecraft'|'overview';distance:number;captions:{at:number;text:string}[];timeMap?:{at:number;time:string}[];media?:{kind:'audio'|'video';url:string;at:number;credit:string}[];}
export interface MissionDocument {version:1;id:string;title:string;launch:string;description:string;context:string;accuracy:string;sources:{title:string;url:string}[];chapters:MissionChapter[];}
export interface MissionState {version:1;id:string;chapter:number;elapsed:number;rate:number;playing:boolean;camera?:MissionCamera;views?:MissionView[];layout?:Layout;active?:string;dashboardVisible?:boolean;trajectoriesVisible?:boolean;audioEnabled?:boolean;audioVolume?:number;returnState:SimulationState;}
export function elapsedSeconds(value:string){
 if(!/^\d{3,}:\d{2}:\d{2}(?:\.\d+)?$/.test(value))throw new Error('Use mission elapsed HHH:MM:SS.');
 const [h,m,s]=value.split(':').map(Number);if(m>=60||s>=60)throw new Error('Invalid mission elapsed time.');return h*3600+m*60+s;
}
export function validateMissionDocument(input:unknown):MissionDocument{
 const d=structuredClone(input) as MissionDocument;
 if(!d||d.version!==1||!/^[-a-z0-9]+$/.test(d.id)||!d.title||!d.launch.endsWith('Z')||!Number.isFinite(Date.parse(d.launch))||!d.context?.startsWith('/data/missions/')||!d.accuracy||!Array.isArray(d.sources)||!d.sources.length||!Array.isArray(d.chapters)||!d.chapters.length)throw new Error('Invalid mission document.');
 const ids=new Set<string>();let lastEnd=-1;
 for(const c of d.chapters){
  const start=elapsedSeconds(c.start),end=elapsedSeconds(c.end);
  if(ids.has(c.id)||!c.id||!c.title||!c.scene||start<lastEnd||end<=start||!Number.isFinite(c.duration)||c.duration<=0||c.duration>3600||!['spacecraft','overview'].includes(c.camera)||!Number.isFinite(c.distance)||c.distance<=0||!Array.isArray(c.captions)||!c.captions.length)throw new Error('Invalid mission chapter.');
  let at=-1;for(const caption of c.captions){if(!Number.isFinite(caption.at)||caption.at<0||caption.at>1||caption.at<=at||!caption.text)throw new Error('Invalid mission captions.');at=caption.at;}
  if(c.captions[0].at!==0)throw new Error('A chapter must start with a caption.');
  if(c.media){if(!Array.isArray(c.media)||c.media.some(c=>!['audio','video'].includes(c.kind)||!c.url.startsWith('/audio/')||!Number.isFinite(c.at)||c.at!==0||!c.credit))throw new Error('Invalid mission media cue. This edition supports chapter-start recordings.');}
  if(c.timeMap){let f=-1,t=-1;for(const key of c.timeMap){const seconds=elapsedSeconds(key.time);if(key.at<=f||key.at<0||key.at>1||seconds<t||seconds<start||seconds>end)throw new Error('Invalid mission time map.');f=key.at;t=seconds;}if(c.timeMap[0]?.at!==0||c.timeMap.at(-1)?.at!==1||elapsedSeconds(c.timeMap[0].time)!==start||elapsedSeconds(c.timeMap.at(-1)!.time)!==end)throw new Error('Time map must cover the chapter.');}
  ids.add(c.id);lastEnd=end;
 }
 return d;
}
export const missions=[validateMissionDocument(apollo)];
export const missionById=new Map(missions.map(d=>[d.id,d]));
export const missionDuration=(d:MissionDocument)=>d.chapters.reduce((sum,c)=>sum+c.duration,0);
export function chapterFraction(m:MissionState){return Math.min(1,Math.max(0,m.elapsed/missionById.get(m.id)!.chapters[m.chapter].duration));}
export function missionElapsed(m:MissionState){
 const c=missionById.get(m.id)!.chapters[m.chapter],p=chapterFraction(m);
 const map=c.timeMap??[{at:0,time:c.start},{at:1,time:c.end}];
 for(let i=1;i<map.length;i++)if(p<=map[i].at){const a=map[i-1],b=map[i];return elapsedSeconds(a.time)+(elapsedSeconds(b.time)-elapsedSeconds(a.time))*(p-a.at)/(b.at-a.at);}
 return elapsedSeconds(c.end);
}
export const missionTime=(m:MissionState)=>Date.parse(missionById.get(m.id)!.launch)+missionElapsed(m)*1000;
export function formatMissionElapsed(seconds:number){const n=Math.floor(seconds);return `${String(Math.floor(n/3600)).padStart(3,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
export function startMission(state:SimulationState,id:string):SimulationState{
 if(state.mission)throw new Error('Stop the current mission before starting another.');if(!missionById.has(id))throw new Error('Unknown mission.');
 return {...structuredClone(state),playing:false,mission:{version:1,id,chapter:0,elapsed:0,rate:1,playing:false,views:[{id:'mission-primary',mode:'guided'}],layout:{kind:'view',id:'mission-primary'},active:'mission-primary',dashboardVisible:true,audioEnabled:false,audioVolume:.7,returnState:structuredClone(state)}};
}
export function stopMission(state:SimulationState):SimulationState{if(!state.mission)return state;return {...structuredClone(state.mission.returnState),playing:false};}
export function seekMission(m:MissionState,chapter:number):MissionState{
 const d=missionById.get(m.id);if(!d||!Number.isInteger(chapter)||chapter<0||chapter>=d.chapters.length)throw new Error('Unknown mission chapter.');
 return {...m,chapter,elapsed:0,playing:false,camera:undefined,...resetGuidedCameras(m)};
}
function resetGuidedCameras(m:MissionState){return m.views?{views:m.views.map(v=>{if(v.mode!=='guided')return v;const {camera,...rest}=v;return rest;})}:{};}
export function advanceMission(m:MissionState,seconds:number):MissionState{
 if(!m.playing||!Number.isFinite(seconds)||seconds<=0)return m;
 const d=missionById.get(m.id)!;let chapter=m.chapter,elapsed=m.elapsed+seconds*m.rate;
 while(elapsed>=d.chapters[chapter].duration){
  if(chapter===d.chapters.length-1)return {...m,chapter,elapsed:d.chapters[chapter].duration,playing:false,...(chapter!==m.chapter?{camera:undefined,...resetGuidedCameras(m)}:{})};
  elapsed-=d.chapters[chapter++].duration;
 }
 return {...m,chapter,elapsed,...(chapter!==m.chapter?{camera:undefined,...resetGuidedCameras(m)}:{})};
}
export function missionCaption(m:MissionState){const c=missionById.get(m.id)!.chapters[m.chapter],p=chapterFraction(m);return c.captions.filter(c=>c.at<=p).at(-1)!.text;}
