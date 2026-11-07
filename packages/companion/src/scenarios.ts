import { z } from 'zod';
import type { ApplicationTool, ScenarioRepository } from './contracts';
export const scenarioSchema = {
 action: z.enum(['list','get','save']),
 id: z.string().min(1).max(80).optional(),
 title: z.string().min(1).max(120).optional(),
 prompt: z.string().min(1).max(19000).optional(),
 expectedRevision: z.string().max(100).optional()
};
export const scenarioTool:ApplicationTool = {
 name:'scenarios',description:'Application-owned reusable scenario prompts, separate from simulation state. List/get Markdown prompts; save a distilled, tested task as title + prompt. Saving does not run it. To replace an existing prompt, get its id/revision first and supply expectedRevision. The app dropdown runs a prompt as a new companion turn; within this turn read it and use the app tools.',
 inputSchema:scenarioSchema,annotations:{destructiveHint:false,openWorldHint:false},
 validateResult(value:any){if(!value||!Array.isArray(value.scenarios))throw new Error('Invalid scenario catalogue acknowledgement.');return value;},
 summarize(value:any){return value.scenario?`${value.action==='save'?'Saved scenario':'Scenario'}: ${value.scenario.title}.`:`${value.scenarios.length} application scenarios.`;}
};
export async function scenarioOperation(repository:ScenarioRepository,input:unknown){
 const p=z.object(scenarioSchema).strict().parse(input);
 let scenario;
 if(p.action==='get'){if(!p.id)throw new Error('Supply a scenario id.');scenario=await repository.get(p.id);}
 if(p.action==='save'){if(!p.title?.trim()||!p.prompt?.trim())throw new Error('Supply a title and a reusable prompt.');scenario=await repository.save({id:p.id,title:p.title,prompt:p.prompt,expectedRevision:p.expectedRevision});}
 return {action:p.action,scenarios:await repository.list(),...(scenario?{scenario}:{})};
}
