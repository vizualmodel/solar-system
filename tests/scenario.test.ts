import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSimulationState,validateSimulationState,splitLayout,removeLayout,MAX_TIME,newView } from '../src/lib/simulation-state';
test('save and restore preserves time, independent views, scale and camera pose',()=>{const s=defaultSimulationState();const v=newView('second');v.orbits=false;v.camera=[1,2,3];s.views.push(v);s.layout=splitLayout(s.layout,'primary','second','row');assert.deepEqual(validateSimulationState(JSON.parse(JSON.stringify(s))),s);});
test('nested split removal promotes the complete sibling subtree',()=>{let layout=splitLayout(defaultSimulationState().layout,'primary','second','row');layout=splitLayout(layout,'second','third','column');assert.deepEqual(removeLayout(layout,'primary'),{kind:'split',direction:'column',children:[{kind:'view',id:'second'},{kind:'view',id:'third'}]});assert.deepEqual(removeLayout(removeLayout(layout,'primary')!,'second'),{kind:'view',id:'third'});});
test('invalid imports are rejected before replacing a working session',()=>{for(const mutate of [(s:any)=>s.time=NaN,(s:any)=>s.end=MAX_TIME+1,(s:any)=>s.views[0].focus='unknown',(s:any)=>s.views[0].camera=[null,0,1],(s:any)=>s.views[0].size=-1,(s:any)=>s.layout={kind:'view',id:'missing'},(s:any)=>s.speed=Infinity]){const s=defaultSimulationState();mutate(s);assert.throws(()=>validateSimulationState(s));}});
test('duplicate leaves and oversized layouts are rejected',()=>{const s=defaultSimulationState();s.views.push(newView('second'));s.layout=splitLayout(s.layout,'primary','primary','row');assert.throws(()=>validateSimulationState(s));});
test('Moon umbra selection persists independently and old sessions default to hidden',()=>{
 const s=defaultSimulationState();s.views[0].moonUmbra=true;
 const second=newView('second');s.views.push(second);s.layout=splitLayout(s.layout,'primary','second','row');
 assert.deepEqual(validateSimulationState(JSON.parse(JSON.stringify(s))),s);
 const old=defaultSimulationState();delete (old.views[0] as Partial<typeof second>).moonUmbra;
 assert.equal(validateSimulationState(old).views[0].moonUmbra,false);
 (old.views[0] as any).moonUmbra='yes';assert.throws(()=>validateSimulationState(old));
});
test('penumbra saves independently of umbra and legacy scenarios default to hidden',()=>{
 const s=defaultSimulationState();s.views[0].moonPenumbra=true;s.views.push(newView('second'));
 s.layout=splitLayout(s.layout,'primary','second','row');
 const restored=validateSimulationState(JSON.parse(JSON.stringify(s)));
 assert.equal(restored.views[0].moonPenumbra,true);assert.equal(restored.views[0].moonUmbra,false);
 assert.equal(restored.views[1].moonPenumbra,false);
 delete (s.views[0] as Partial<typeof s.views[0]>).moonPenumbra;
 assert.equal(validateSimulationState(s).views[0].moonPenumbra,false);
 (s.views[0] as any).moonPenumbra=1;assert.throws(()=>validateSimulationState(s));
});
