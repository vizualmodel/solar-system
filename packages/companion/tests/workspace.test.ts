import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {createWorkspace} from '../src/workspace';import {config as example} from '../examples/counter/config';
test('candidate identity includes uncommitted linked-library source',async t=>{
 const root=await mkdtemp(join(tmpdir(),'companion-digest-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const app=join(root,'app'),library=join(root,'library');
 for(const dir of [app,library]){await mkdir(dir);execFileSync('git',['init','-b','test/extraction',dir],{stdio:'ignore'});await writeFile(join(dir,'source.txt'),'before');}
 const workspace=createWorkspace({...example,root:app,sourceRoots:[library]});const before=await workspace.identity();
 assert.equal(before.baseRevision,'');assert.equal(before.branch,'test/extraction');
 await writeFile(join(library,'source.txt'),'changed');assert.notEqual((await workspace.identity()).sourceDigest,before.sourceDigest);
});
