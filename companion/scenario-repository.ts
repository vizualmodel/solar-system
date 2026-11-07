import {mkdir,readdir,readFile,writeFile,lstat,realpath,rename,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import type {ScenarioRepository} from '@vizualmodel/companion/contracts';
import {parseScenarioMarkdown,scenarioMarkdown,scenarioId,validateScenarioId} from '../src/lib/scenario-prompts';
export function createScenarioRepository(directory:string):ScenarioRepository{
 const root=resolve(directory);
 let queue:Promise<unknown>=Promise.resolve();
 async function file(id:string){
  validateScenarioId(id);await mkdir(root,{recursive:true});
  if((await realpath(root)).toLowerCase()!==root.toLowerCase())throw new Error('Scenario directory must not redirect outside the app.');
  const path=join(root,id+'.md');
  try{if(!(await lstat(path)).isFile()||(await lstat(path)).isSymbolicLink())throw new Error('Scenario must be a regular Markdown file.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  return path;
 }
 async function get(id:string){const text=await readFile(await file(id),'utf8');return parseScenarioMarkdown(id,text,createHash('sha256').update(text).digest('hex'));}
 return {
  get,
  async list(){await mkdir(root,{recursive:true});const names=(await readdir(root)).filter(n=>n.endsWith('.md')).sort();if(names.length>200)throw new Error('Scenario catalogue is too large.');return Promise.all(names.map(async n=>{const {prompt,...summary}=await get(n.slice(0,-3));return summary;}));},
  save(value){
   const operation=queue.then(async()=>{
    const id=value.id??scenarioId(value.title),path=await file(id),text=scenarioMarkdown(value.title,value.prompt);
    let current;try{current=await get(id);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    if(current&&value.expectedRevision!==current.revision)throw new Error('Scenario already exists or changed. Read its revision before replacing it.');
    if(!current&&value.expectedRevision)throw new Error('Scenario no longer exists; refresh the catalogue.');
    if(!current)await writeFile(path,text,{encoding:'utf8',flag:'wx'});
    else {const temporary=join(root,'.'+id+'-'+randomUUID()+'.tmp');try{await writeFile(temporary,text,{encoding:'utf8',flag:'wx'});await rename(temporary,path);}finally{await unlink(temporary).catch(()=>{});}}
    return get(id);
   });queue=operation.catch(()=>{});return operation;
  }
 };
}
