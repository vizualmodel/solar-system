import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('the model has one Bridge agent surface, no vendored runtime and no Workspace iframe',()=>{
 const app=readFileSync(new URL('../src/App.svelte',import.meta.url),'utf8'),panel=readFileSync(new URL('../src/components/AgentAccess.svelte',import.meta.url),'utf8'),pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal((app.match(/<AgentAccess\s/g)??[]).length,1);assert.doesNotMatch(app,/ResearchAgent|workspace-agent-open/);assert.doesNotMatch(panel,/iframe|VITE_VMBLU/);
 assert.equal(pkg.dependencies['@vizualmodel/bridge-model-client'],'0.1.0');assert.equal(pkg.devDependencies['@vizualmodel/companion'],undefined);assert.equal(existsSync(new URL('../packages/companion',import.meta.url)),false);
});
test('committed Bridge tool schemas stay aligned with the model control declarations',()=>{
 const result=spawnSync(process.execPath,['--import','tsx','scripts/generate-bridge-tools.ts','--check'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:15000});assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
});
