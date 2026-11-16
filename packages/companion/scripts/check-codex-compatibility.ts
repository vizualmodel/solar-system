import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {resolveCodex} from '../src/codex-executable';
import {Runtime} from '../src/runtime';

// No model turn, approval decisions, global configuration writes or existing saved-thread changes.
const cwd=resolve(process.argv[2]??process.cwd());
const executable=await resolveCodex(),exec=promisify(execFile);
const version=(await exec(executable,['--version'],{windowsHide:true})).stdout.trim();
console.log(`Validating ${version}`);
const directory=await mkdtemp(join(tmpdir(),'companion-protocol-'));
await exec(executable,['app-server','generate-json-schema','--out',directory],{windowsHide:true});
for(const [name,fields] of Object.entries({
 ThreadStartParams:['cwd','config','approvalPolicy','sandbox','developerInstructions'],
 ThreadResumeParams:['threadId','cwd','config','approvalPolicy','sandbox','developerInstructions'],
 TurnStartParams:['threadId','input'],TurnInterruptParams:['threadId','turnId']
})){
 const schema=JSON.parse(await readFile(join(directory,'v2',name+'.json'),'utf8'));
 for(const field of fields)assert.ok(schema.properties[field],`${name}.${field} missing`);
 assert.ok((schema.required??[]).every((field:string)=>fields.includes(field)),`${name}: new required field`);
 if(name.startsWith('Thread')){
  assert.ok(JSON.stringify(schema.definitions.AskForApproval).includes('"on-request"'));
  assert.ok(JSON.stringify(schema.definitions.SandboxMode).includes('"workspace-write"'));
 }
}
// Exercise actual initialize, initialized, account/read, config/read and thread/start
// through the production Runtime. This only creates an empty diagnostic thread;
// the application's saved conversation ID is never replaced.
const runtime=new Runtime(cwd,'http://127.0.0.1:1','diagnostic-only',async()=>{},
 {workspace:true,mcpName:'compatibility_probe',mcpEntry:'',instructions:'Read-only compatibility diagnostic. No turn will be submitted.'});
try{
 await runtime.start();assert.equal(runtime.status,'Ready',runtime.status);
 const models=await runtime.models();assert.ok(Array.isArray(models.data),'model/list response');
 runtime.configureWorkspace(cwd,'Read-only compatibility diagnostic. No turn will be submitted.',{});
 await runtime.conversation();assert.equal(runtime.status,'Ready',runtime.status);
 assert.ok(runtime.threadId);assert.equal(runtime.turnId,undefined);
 const threadId=runtime.threadId;
 await runtime.conversation(threadId);assert.equal(runtime.status,'Ready');
 if(runtime.threadId!==threadId)assert.match(runtime.notice??'',/could not find saved history/);
 console.log(`${version}: protocol fields, handshake, configuration, model list, empty-thread startup and resume/fallback passed. No model turn submitted.`);
 console.log(`Exported schema: ${directory}`);
}finally{runtime.close();}
