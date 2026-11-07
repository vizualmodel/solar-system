import * as THREE from 'three';
export type EarthTextureLease={promise:Promise<THREE.Texture>;release:()=>void};
export function createEarthTexturePool(load:(url:string)=>Promise<THREE.Texture>){
 const entries=new Map<string,{users:number;promise:Promise<THREE.Texture>}>();
 return {acquire(url:string):EarthTextureLease{
  let entry=entries.get(url);
  if(!entry){entry={users:0,promise:load(url)};entries.set(url,entry);}
  entry.users++;const current=entry;let released=false;
  return {promise:entry.promise,release(){
   if(released)return;released=true;
   if(--current.users===0){if(entries.get(url)===current)entries.delete(url);void current.promise.then(t=>t.dispose(),()=>{});}
  }};
 }};
}
const pool=createEarthTexturePool(url=>new THREE.TextureLoader().loadAsync(url).then(texture=>{
 texture.colorSpace=/day-|daymap|night-/.test(url)?THREE.SRGBColorSpace:THREE.NoColorSpace;
 texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 return texture;
}));
export const acquireEarthTexture=(url:string)=>pool.acquire(url);
