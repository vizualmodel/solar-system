import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {population} from '../src/lib/population';

const script=new URL('../scripts/fetch-population-data.mjs',import.meta.url).href;
test('refresh accepts --cache-proxy without treating it as an output path and retains the newest duplicate epoch',()=>{
 const root=mkdtempSync(join(tmpdir(),'solar-population-'));
 try{
  mkdirSync(join(root,'src/data'),{recursive:true});
  const elements={...population[0].elements,EPOCH:'2026-10-16T00:00:00Z'};
  const code=`process.argv=['node','fetch-population-data.mjs','--cache-proxy'];let calls=0;globalThis.fetch=async url=>{if(!url.startsWith('https://retlector.eu/'))throw Error('Unexpected source');calls++;return {ok:true,json:async()=>[{...${JSON.stringify(elements)},EPOCH:calls===1?'2026-10-16T00:00:00Z':'2026-10-15T00:00:00Z'}]};};await import(${JSON.stringify(script)});if(calls!==3)throw Error('Expected three groups');`;
  const run=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:root,encoding:'utf8',windowsHide:true});
  assert.equal(run.status,0,run.stderr);
  assert.equal(existsSync(join(root,'--cache-proxy')),false);
  const cache=JSON.parse(readFileSync(join(root,'src/data/satellite-population.json'),'utf8'));
  assert.equal(cache.records.length,1);assert.equal(cache.records[0].elements.EPOCH,elements.EPOCH);
  assert.deepEqual(cache.records[0].groups,['active','geo','gnss']);
  // A fresh accepted cache must not trigger a provider request.
  const again=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:root,encoding:'utf8',windowsHide:true});
  assert.notEqual(again.status,0);assert.match(again.stderr,/less than two hours old/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('an invalid provider record leaves the accepted cache intact',()=>{
 const root=mkdtempSync(join(tmpdir(),'solar-population-'));
 try{
  const path=join(root,'accepted.json'),before=JSON.stringify({fetchedAt:'2020-01-01T00:00:00Z',records:[]});
  writeFileSync(path,before);
  const code=`process.argv=['node','fetch-population-data.mjs',${JSON.stringify(path)}];globalThis.fetch=async()=>({ok:true,json:async()=>[{...${JSON.stringify(population[0].elements)},NORAD_CAT_ID:null}]});await import(${JSON.stringify(script)});`;
  const run=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:root,encoding:'utf8',windowsHide:true});
  assert.notEqual(run.status,0);assert.match(run.stderr,/Invalid OMM/);assert.equal(readFileSync(path,'utf8'),before);
 }finally{rmSync(root,{recursive:true,force:true});}
});
