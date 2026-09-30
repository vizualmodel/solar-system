import { bodies, byId } from './catalog';
import type { Vec3 } from './ephemeris';
export const MIN_TIME=Date.parse('2025-01-01T00:00:00Z'),MAX_TIME=Date.parse('2031-01-01T00:00:00Z');
export interface ViewConfig {id:string;focus:string;follow:boolean;orbits:boolean;labels:boolean;stars:boolean;constellations:boolean;size:number;moonScale:number;visible:string[];camera:Vec3;target:Vec3;}
export type Layout = {kind:'view';id:string}|{kind:'split';direction:'row'|'column';children:[Layout,Layout]};
export interface Scenario {version:1;name:string;time:number;start:number;end:number;speed:number;playing:boolean;views:ViewConfig[];layout:Layout;active:string;}
export function newView(id:string=crypto.randomUUID()):ViewConfig{return {id,focus:'sun',follow:true,orbits:true,labels:true,stars:true,constellations:false,size:60,moonScale:1,visible:bodies.map(b=>b.id),camera:[0,22,32],target:[0,0,0]};}
export function defaultScenario(preset='overview'):Scenario {
 const view=newView('primary');if(preset==='earth'){view.focus='earth';view.camera=[0,0.008,0.012];view.size=1;}
 if(preset==='inner'){view.camera=[0,2.8,4.2];view.size=30;}
 return {version:1,name:preset==='earth'?'Earth & Moon':'Solar system exploration',time:Math.min(MAX_TIME,Math.max(MIN_TIME,Date.now())),start:MIN_TIME,end:MAX_TIME,speed:10,playing:false,views:[view],layout:{kind:'view',id:view.id},active:view.id};
}
export function splitLayout(node:Layout,id:string,newId:string,direction:'row'|'column'):Layout {
 if(node.kind==='view')return node.id===id?{kind:'split',direction,children:[node,{kind:'view',id:newId}]}:node;
 return {...node,children:node.children.map(c=>splitLayout(c,id,newId,direction)) as [Layout,Layout]};
}
export function removeLayout(node:Layout,id:string):Layout|null {
 if(node.kind==='view')return node.id===id?null:node;
 const a=removeLayout(node.children[0],id),b=removeLayout(node.children[1],id);
 return !a?b:!b?a:{...node,children:[a,b]};
}
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const vector=(x:unknown):x is Vec3=>Array.isArray(x)&&x.length===3&&x.every(v=>finite(v)&&Math.abs(v)<=10000);
export function validateScenario(input:unknown):Scenario {
 const s=structuredClone(input) as Scenario;
 if(!s||s.version!==1||typeof s.name!=='string'||s.name.length>120||![s.time,s.start,s.end,s.speed].every(finite)||s.start<MIN_TIME||s.end>MAX_TIME||s.start>=s.end||s.time<s.start||s.time>s.end||Math.abs(s.speed)>365||typeof s.playing!=='boolean'||!Array.isArray(s.views)||s.views.length<1||s.views.length>6)throw new Error('Invalid scenario or unsupported date range.');
 const ids=new Set<string>();
 // Version 1 sessions predate the optional constellation layer. Preserve every other setting.
 for(const v of s.views){if(v&&v.constellations===undefined)v.constellations=false;if(v&&typeof v.constellations!=='boolean')throw new Error('Invalid constellation setting.');}
 for(const v of s.views){if(!v||typeof v.id!=='string'||v.id.length>100||ids.has(v.id)||!Object.hasOwn(byId,v.focus)||!vector(v.camera)||Math.hypot(...v.camera)<1e-8||!vector(v.target)||!finite(v.size)||v.size<1||v.size>200||!finite(v.moonScale)||v.moonScale<1||v.moonScale>100||![v.follow,v.orbits,v.labels,v.stars].every(x=>typeof x==='boolean')||!Array.isArray(v.visible)||v.visible.some(id=>!Object.hasOwn(byId,id)))throw new Error('Invalid view configuration.');ids.add(v.id);}
 const leaves:string[]=[];
 function walk(n:Layout,depth=0){if(!n||depth>6)throw new Error('Invalid layout.');if(n.kind==='view'){leaves.push(n.id);return;}if(n.kind!=='split'||!['row','column'].includes(n.direction)||!Array.isArray(n.children)||n.children.length!==2)throw new Error('Invalid layout.');n.children.forEach(c=>walk(c,depth+1));}
 walk(s.layout);if(leaves.length!==ids.size||new Set(leaves).size!==ids.size||leaves.some(id=>!ids.has(id))||!ids.has(s.active))throw new Error('Layout does not match views.');
 return structuredClone(s);
}
export const STORAGE_KEY='solar-observatory.scenario.v1';
