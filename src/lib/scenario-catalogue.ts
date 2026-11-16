import {parseScenarioMarkdown,scenarioMarkdown,scenarioId,type ScenarioPrompt} from './scenario-prompts';
export interface ScenarioStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
const key='solar.scenario-prompts.v1';
export function createScenarioCatalogue(bundled:ScenarioPrompt[],storage:ScenarioStorage){
 function saved():ScenarioPrompt[]{const raw=storage.getItem(key);if(!raw)return [];const values=JSON.parse(raw);if(!Array.isArray(values)||values.length>200)throw Error('Saved scenario catalogue is invalid. Export or repair it before saving.');return values.map(value=>{const p=parseScenarioMarkdown(value.id,scenarioMarkdown(value.title,value.prompt),value.revision);if(typeof value.revision!=='string'||!value.revision)throw Error('Saved scenario revision is missing.');return p;});}
 function all(){return [...new Map([...bundled,...saved()].map(value=>[value.id,value])).values()];}
 return{
  async list(){return all().map(({prompt,...summary})=>summary);},
  async get(id:string){const found=all().find(value=>value.id===id);if(!found)throw Error('Scenario was not found.');return found;},
  async save(value:{id?:string;title:string;prompt:string;expectedRevision?:string}){
   const id=value.id??scenarioId(value.title),current=all().find(value=>value.id===id);
   if(current&&current.revision!==value.expectedRevision)throw Error('Scenario already exists or changed. Read its revision before replacing it.');
   if(!current&&value.expectedRevision)throw Error('Scenario no longer exists; refresh the catalogue.');
   const next=parseScenarioMarkdown(id,scenarioMarkdown(value.title,value.prompt),crypto.randomUUID());
   const values=saved().filter(item=>item.id!==id);values.push(next);if(values.length>200)throw Error('Scenario catalogue is full.');
   storage.setItem(key,JSON.stringify(values));return next;
  }
 };
}
