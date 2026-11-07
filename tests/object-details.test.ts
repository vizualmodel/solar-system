import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {displayBodies} from '../src/lib/catalog';
import {objectDetails} from '../src/lib/object-details';
import {objectInfo} from '../src/data/object-info';

test('every selectable object has curated information, a bundled image and safe reference links',()=>{
 assert.deepEqual(Object.keys(objectInfo).sort(),displayBodies.map(b=>b.id).sort());
 for(const body of displayBodies){
  const info=objectDetails(body.id);assert.equal(info.name,body.name);
  assert.ok(info.summary.length>60);assert.ok(info.highlight.length>25);assert.ok(info.facts.length>=2);
  assert.ok(info.wikipediaUrl.startsWith('https://en.wikipedia.org/wiki/'));
  assert.equal(new URL(info.source).hostname.endsWith('nasa.gov'),true);
  assert.match(info.image.src,/^\/images\/objects\/[a-z]+\.(jpg|png|webp)$/);
  const file='public'+info.image.src;assert.ok(statSync(file).size>1000);
  const bytes=readFileSync(file);assert.ok(bytes[0]===0xff||bytes[0]===0x89||bytes.toString('ascii',0,4)==='RIFF','image has a raster file signature');
  assert.ok(info.image.credit);assert.equal(info.image.source,info.source);
 }
 assert.throws(()=>objectDetails('unknown'),/No information/);
});

test('spacecraft information shows physical dimensions instead of the renderer bounding radius',()=>{
 for(const id of ['iss','hubble'])assert.equal(objectDetails(id).facts.some(([label])=>label==='Mean radius'),false);
 assert.ok(objectDetails('iss').facts.some(([label,value])=>label==='Overall span'&&value.includes('109')));
 assert.ok(objectDetails('hubble').facts.some(([label,value])=>label==='Primary mirror'&&value==='2.4 m'));
 assert.ok(objectDetails('earth').facts.some(([label,value])=>label==='Mean radius'&&value.includes('6,371')));
});
