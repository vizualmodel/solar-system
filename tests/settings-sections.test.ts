import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { settingsSections,setSectionOpen } from '../src/lib/settings-sections';

test('section preferences are independent and survive panel subscription changes',()=>{
 settingsSections.set({});
 const unsubscribe=settingsSections.subscribe(()=>{});
 setSectionOpen('eclipse',false);setSectionOpen('scale',true);
 unsubscribe();
 let remounted:Record<string,boolean>={};
 const stop=settingsSections.subscribe(value=>remounted=value);
 assert.deepEqual(remounted,{eclipse:false,scale:true});
 setSectionOpen('eclipse',true);
 assert.equal(get(settingsSections).scale,true);assert.equal(get(settingsSections).eclipse,true);
 stop();
});
