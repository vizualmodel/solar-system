import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

// Decode the large EXR once, including when several views open during loading.
let cached:Promise<THREE.DataTexture>|null=null;
let users=0;
export function acquireStarMap(){
  users++;
  if(!cached)cached=new EXRLoader().loadAsync('/textures/sky/starmap_2020_8k.exr').then(texture=>{
    texture.wrapS=THREE.RepeatWrapping;
    texture.minFilter=THREE.LinearFilter;
    texture.magFilter=THREE.LinearFilter;
    texture.generateMipmaps=false;
    // EXRLoader returns linear half floats and flips scanlines during decoding.
    texture.needsUpdate=true;
    return texture;
  });
  return cached;
}
export function releaseStarMap(){
  if(--users===0){const previous=cached;cached=null;void previous?.then(texture=>texture.dispose(),()=>{});}
}
