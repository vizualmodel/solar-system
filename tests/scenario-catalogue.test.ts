import test from 'node:test';import assert from 'node:assert/strict';
import {createScenarioCatalogue} from '../src/lib/scenario-catalogue';
test('public-model scenarios persist without a local service or agent and require current revision for replacement',async()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 const initial={id:'orbit',title:'Orbit',prompt:'Read the state first.',revision:'bundled'};
 const a=createScenarioCatalogue([initial],storage);assert.equal((await a.list()).length,1);
 await assert.rejects(a.save({title:'Orbit',prompt:'Changed'}),/already exists/);
 const saved=await a.save({title:'Fly by',prompt:'Preserve the current date.'});
 const b=createScenarioCatalogue([initial],storage);assert.deepEqual(await b.get(saved.id),saved);
 await assert.rejects(b.save({...saved,prompt:'Changed',expectedRevision:'stale'}),/changed/);
 const changed=await b.save({...saved,prompt:'Changed',expectedRevision:saved.revision});assert.notEqual(changed.revision,saved.revision);
});
test('corrupt or unavailable browser storage never gets silently replaced',async()=>{
 let writes=0;const store=createScenarioCatalogue([],{getItem:()=>'{bad',setItem:()=>{writes++;}});
 await assert.rejects(store.save({title:'Test',prompt:'Task'}));assert.equal(writes,0);
 const denied=createScenarioCatalogue([],{getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}});
 await assert.rejects(denied.save({title:'Test',prompt:'Task'}),/Storage unavailable/);
});
