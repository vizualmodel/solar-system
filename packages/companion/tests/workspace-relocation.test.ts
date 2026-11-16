import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWorkspace} from '../src/workspace';
import {config as example} from '../examples/counter/config';

test('explicit relocation preserves build, conversation and working-copy identity; live source and wrong owner are rejected',async t=>{
 const root=await mkdtemp(join(tmpdir(),'companion-relocation-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const previous=join(root,'old'),current=join(root,'new');await mkdir(current);
 const workspace=createWorkspace({...example,root:current});await mkdir(workspace.storage,{recursive:true});
 const original={application:example.application.id,checkout:previous,workingCopyId:'kept',threadId:'native-history',activeBuild:{id:'accepted',sourceDigest:'original-build-source'},candidate:{id:'candidate'}};
 await workspace.saveWorkspace(original);
 await mkdir(previous);await assert.rejects(workspace.relocateWorkspace(previous),/still exists/);await rm(previous,{recursive:true});
 await assert.rejects(workspace.relocateWorkspace(join(root,'wrong')),/does not belong/);
 await workspace.relocateWorkspace(previous);
 assert.deepEqual(await workspace.loadWorkspace(),{...original,checkout:current});
 assert.equal(await readFile(join(workspace.storage,'workspace.json'),'utf8').then(s=>JSON.parse(s).activeBuild.sourceDigest),'original-build-source');
 await assert.rejects(workspace.relocateWorkspace(previous),/does not belong/);
});
