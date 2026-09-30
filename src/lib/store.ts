import { writable, get } from 'svelte/store';
import { defaultScenario,validateScenario,STORAGE_KEY,splitLayout,removeLayout,type Scenario,type ViewConfig } from './scenario';
import { DAY } from './ephemeris';
export const status=writable('Ready to explore');
function load(){try {const raw=localStorage.getItem(STORAGE_KEY);if(raw){const s=validateScenario(JSON.parse(raw));s.playing=false;status.set('Previous session restored · paused');return s;}}catch{status.set('Saved session could not be loaded. Using the default.');}return defaultScenario(new URLSearchParams(location.search).get('preset')??'overview');}
export const scenario=writable<Scenario>(load());
export function updateView(id:string,patch:Partial<ViewConfig>){scenario.update(s=>({...s,views:s.views.map(v=>v.id===id?{...v,...patch}:v)}));}
export type Command = {type:'time';value:number}|{type:'play';value:boolean}|{type:'speed';value:number}|{type:'view';id:string;patch:Partial<ViewConfig>};
// UI and future LLM integrations share this validated command boundary.
export function command(c:Command){const s=structuredClone(get(scenario));switch(c.type){case'time':s.time=Math.max(s.start,Math.min(s.end,c.value));break;case'play':s.playing=c.value;break;case'speed':s.speed=c.value;break;case'view':s.views=s.views.map(v=>v.id===c.id?{...v,...c.patch,id:v.id}:v);break;default:throw new Error('Unsupported command.');}scenario.set(validateScenario(s));}
export function split(id:string,direction:'row'|'column'){scenario.update(s=>{if(s.views.length>=6){status.set('Up to six simultaneous views are supported.');return s;}const view=structuredClone(s.views.find(v=>v.id===id)!);view.id=crypto.randomUUID();return {...s,views:[...s.views,view],active:view.id,layout:splitLayout(s.layout,id,view.id,direction)};});}
export function close(id:string){scenario.update(s=>{if(s.views.length===1)return s;const views=s.views.filter(v=>v.id!==id);return {...s,views,active:s.active===id?views[0].id:s.active,layout:removeLayout(s.layout,id)!};});}
export function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(get(scenario)));status.set('Session saved on this browser');}catch{status.set('Browser storage unavailable. Export your session to keep it.');}}
export function startClock(){let last=performance.now(),raf=0;const tick=(now:number)=>{const elapsed=Math.min((now-last)/1000,0.25);last=now;if(get(scenario).playing)scenario.update(s=>{const time=Math.max(s.start,Math.min(s.end,s.time+elapsed*s.speed*DAY));return {...s,time,playing:time>s.start&&time<s.end};});raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);const timer=setInterval(save,15000);window.addEventListener('pagehide',save);return ()=>{cancelAnimationFrame(raf);clearInterval(timer);window.removeEventListener('pagehide',save);};}
