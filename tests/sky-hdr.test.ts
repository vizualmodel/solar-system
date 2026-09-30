import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { DataUtils,HalfFloatType,LinearSRGBColorSpace } from 'three';

test('bundled NASA 2020 EXR decodes at full 8K resolution with linear HDR samples',()=>{
  const file=readFileSync(new URL('../public/textures/sky/starmap_2020_8k.exr',import.meta.url));
  const buffer=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength) as ArrayBuffer;
  const map=new EXRLoader().parse(buffer);
  assert.equal(map.width,8192);assert.equal(map.height,4096);
  assert.equal(map.type,HalfFloatType);assert.equal(map.colorSpace,LinearSRGBColorSpace);
  assert.equal(map.data.length,8192*4096*4);
  let faint=0,bright=0;
  for(let i=0;i<map.data.length;i+=400){
    const value=DataUtils.fromHalfFloat(map.data[i]);
    assert.ok(Number.isFinite(value)&&value>=0);
    if(value>0&&value<0.01)faint++;
    if(value>0.2)bright++;
  }
  assert.ok(faint>1000&&bright>100,'Map must contain both faint structure and bright stars');
});
