// Validation helper using the existing authenticated diagnostic boundary; no inference.
import { writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=`http://127.0.0.1:${process.env.COMPANION_PORT||5180}`;
const bootstrap=await (await fetch(origin+'/companion/bootstrap')).json();
if(process.argv[2]==='restore'){
 const saved=JSON.parse(await readFile(new URL('./validation/solar-before.json',import.meta.url),'utf8'));
 const restored=await fetch(origin+'/internal/tool',{method:'POST',headers:{authorization:`Bearer ${bootstrap.token}`,'content-type':'application/json'},body:JSON.stringify({method:'session',params:{action:'import',simulationState:saved.simulationState}}),signal:AbortSignal.timeout(30000)});
 if(!restored.ok)throw new Error(await restored.text());
}
const response=await fetch(origin+'/internal/tool',{method:'POST',headers:{authorization:`Bearer ${bootstrap.token}`,'content-type':'application/json'},body:JSON.stringify({method:'get_simulation_state',params:{detail:'full'}}),signal:AbortSignal.timeout(30000)});
const result=await response.json();if(!response.ok)throw new Error(result.error);
if(process.argv[2]==='save')await writeFile(new URL('./validation/solar-before.json',import.meta.url),JSON.stringify(result.state));
if(process.argv[2]==='compare')assert.deepEqual(result.state,JSON.parse(await readFile(new URL('./validation/solar-before.json',import.meta.url),'utf8')));
console.log(JSON.stringify({time:result.time,playing:result.playing,viewCount:result.viewCount,build:result.build?.id,comparison:process.argv[2]==='compare'?'all simulation state fields equal':undefined}));
