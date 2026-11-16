import {writable,get} from 'svelte/store';
import {scenarioOperation} from '@vizualmodel/model-development/scenarios';
import {createScenarioCatalogue} from '../lib/scenario-catalogue';
import {parseScenarioMarkdown} from '../lib/scenario-prompts';
const files=import.meta.glob('../../scenarios/*.md',{query:'?raw',import:'default',eager:true}) as Record<string,string>;
const bundled=Object.entries(files).map(([name,text])=>parseScenarioMarkdown(name.split('/').pop()!.slice(0,-3),text));
const repository=createScenarioCatalogue(bundled,{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
export const scenarioSummaries=writable(bundled.map(({prompt,...summary})=>summary));
const development=import.meta.env.MODE==='model-development'?import('../../model-service/client'):null;
if(development)void development.then(({client})=>{
 let connected=false;
 client.panel.subscribe(value=>{if(value.connected&&!connected){connected=true;void client.listScenarios().catch(()=>{});}else if(!value.connected)connected=false;});
 client.scenarios.subscribe(value=>{if(get(client.panel).connected)scenarioSummaries.set(value);});
});
export async function operateScenario(params:unknown){
 const service=development?(await development).client:null;
 if(service&&get(service.panel).connected){const result=await service.request('scenario-operation',{params});scenarioSummaries.set(result.scenarios);return result;}
 if(service&&(params as any)?.action==='save')throw Error('The model development service is disconnected. The scenario was not saved; retry after it is ready.');
 const result=await scenarioOperation(repository,params);scenarioSummaries.set(result.scenarios);return result;
}
