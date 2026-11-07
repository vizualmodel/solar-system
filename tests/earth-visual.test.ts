import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {EARTH_RADIUS_METRES,CLOUD_RADIUS,ATMOSPHERE_RADIUS,earthDetailLevel,earthTextureResolution,cloudAnimation,raySphere} from '../src/lib/earth-math';
import {createEarthTexturePool} from '../src/lib/earth-textures';
import {EarthVisual} from '../src/lib/earth-visual';
import {DAY} from '../src/lib/ephemeris';
import {AU} from '../src/lib/catalog';

test('Earth geometry detail responds to projected size with hysteresis',()=>{
 assert.equal(earthDetailLevel(10),0);assert.equal(earthDetailLevel(100),1);assert.equal(earthDetailLevel(1000),2);assert.equal(earthDetailLevel(3000),3);
 assert.equal(earthDetailLevel(610,1),1);assert.equal(earthDetailLevel(590,2),2);
 assert.equal(earthDetailLevel(10,3),0);
 assert.equal(earthTextureResolution(16384,8),8192);assert.equal(earthTextureResolution(16384,4),4096);assert.equal(earthTextureResolution(4096,16),4096);
 assert.equal(earthTextureResolution(2048,8),2048);
 assert.equal(earthTextureResolution(16384,8,3),4096);assert.equal(earthTextureResolution(16384,8,6),2048);
});

test('cloud drift is slow, bounded and determined by simulation time, including reverse scrubbing',()=>{
 const time=Date.parse('2026-10-06T00:20:47Z'),before=cloudAnimation(time);
 cloudAnimation(time+DAY);cloudAnimation(time-DAY);assert.deepEqual(cloudAnimation(time),before);
 const after=cloudAnimation(time+1000);assert.ok(Math.abs(after[0]-before[0]-1/(30*86400))<1e-12);
 for(const t of [Date.UTC(1990,0,1),Date.UTC(2000,0,1),Date.UTC(2031,0,1)]){const phase=cloudAnimation(t);assert.ok(phase[0]>=0&&phase[0]<1&&phase[1]>=0&&phase[1]<2*Math.PI);}
 assert.ok(Math.abs((CLOUD_RADIUS-1)*EARTH_RADIUS_METRES-12000)<1e-8);
});

test('atmosphere entry stays behind a nearby ISS and rays work from inside the atmosphere',()=>{
 const camera=[0,0,1+420000/EARTH_RADIUS_METRES],ray=[0,0,-1];
 const atmosphere=raySphere(camera,ray,ATMOSPHERE_RADIUS)!,ground=raySphere(camera,ray,1)!;
 assert.ok(atmosphere[0]*EARTH_RADIUS_METRES>250000);assert.ok(atmosphere[0]>300/EARTH_RADIUS_METRES,'300 m foreground ISS wins the depth test');
 assert.ok(atmosphere[0]<ground[0]);
 const surface=[0,1+232/EARTH_RADIUS_METRES,0];assert.equal(raySphere(surface,[0,1,0],ATMOSPHERE_RADIUS)![0],0);
 assert.equal(raySphere(camera,[0,0,1],ATMOSPHERE_RADIUS),null);
 assert.ok(raySphere(surface,[1,0,0],ATMOSPHERE_RADIUS)![1]>0);
});

test('Earth texture pool shares concurrent loads and disposes only after the final view releases',async()=>{
 let loaded=0,disposed=0;const texture=new THREE.Texture();texture.addEventListener('dispose',()=>disposed++);
 const pool=createEarthTexturePool(async()=>{loaded++;return texture;});
 const a=pool.acquire('day'),b=pool.acquire('day');assert.equal(a.promise,b.promise);await a.promise;assert.equal(loaded,1);
 a.release();a.release();await Promise.resolve();assert.equal(disposed,0);
 b.release();await Promise.resolve();assert.equal(disposed,1);
});

test('closing an Earth view while a map loads cannot dispose another view’s lease',async()=>{
 let resolve!:(t:THREE.Texture)=>void;const texture=new THREE.Texture();let disposed=0;texture.addEventListener('dispose',()=>disposed++);
 const pool=createEarthTexturePool(()=>new Promise(r=>resolve=r));const a=pool.acquire('clouds'),b=pool.acquire('clouds');
 a.release();resolve(texture);await b.promise;assert.equal(disposed,0);b.release();await Promise.resolve();assert.equal(disposed,1);
});

test('layered Earth keeps physical radius, shares geometry, retains eclipse hooks and loads details lazily',async()=>{
 let loads=0,textureDisposals=0,geometryDisposals=0,hookCalls=0;
 const pool=createEarthTexturePool(async()=>{loads++;const t=new THREE.Texture();t.addEventListener('dispose',()=>textureDisposals++);return t;});
 const material=new THREE.MeshStandardMaterial();material.onBeforeCompile=shader=>{hookCalls++;shader.fragmentShader+='\n// existing eclipse hook';};
 const options={maxTextureSize:8192,deviceMemory:8,anisotropy:8,acquire:(url:string)=>pool.acquire(url)};
 const earth=new EarthVisual(material,options,assert.fail),other=new EarthVisual(new THREE.MeshStandardMaterial(),options,assert.fail);
 earth.geometry.addEventListener('dispose',()=>geometryDisposals++);assert.equal(earth.geometry,other.geometry);assert.equal(loads,1,'one shared fallback map');
 earth.position.set(0,0,0);earth.scale.setScalar(6371/AU);
 const camera=new THREE.PerspectiveCamera(45,1,1e-11,10000);camera.position.set(0,0,6771/AU);
 const sun=new THREE.Vector3(1,0,0),moon=new THREE.Vector3(0.0025,0,0),time=Date.UTC(2026,9,6);
 earth.updateAppearance(time,camera,20,sun,moon,1737.4/AU,695700/AU);assert.equal(loads,1);
 earth.updateAppearance(time,camera,2500,sun,moon,1737.4/AU,695700/AU);await Promise.resolve();await Promise.resolve();
 assert.equal(loads,6);assert.equal(earth.geometry.parameters.widthSegments,512);assert.equal(earth.geometry.parameters.radius,1);
 assert.ok(earth.material.map);assert.ok(earth.material.normalMap);assert.equal(earth.earthUniforms.earthCloudReady.value,1);assert.equal(earth.earthUniforms.earthNightReady.value,1);
 assert.ok(Math.abs(earth.earthUniforms.earthCameraLocal.value.z-6771/6371)<1e-12);
 const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
 material.onBeforeCompile(shader as any,{} as any);assert.equal(hookCalls,1);assert.ok(shader.fragmentShader.includes('existing eclipse hook'));
 const cloud=earth.children.find(o=>o.name==='Earth · animated clouds') as THREE.Mesh;
 assert.equal(cloud.geometry,earth.geometry);assert.equal(cloud.scale.x,CLOUD_RADIUS);assert.equal((cloud.material as THREE.Material).depthWrite,false);
 assert.equal(earth.children.length,2);assert.ok(earth.children.every(o=>o.userData.earthOwned));
 earth.dispose();await Promise.resolve();assert.equal(geometryDisposals,0);assert.equal(textureDisposals,5,'fallback is still held by the other view');
 other.dispose();await Promise.resolve();assert.equal(geometryDisposals,1);assert.equal(textureDisposals,6);
});

function jpegSize(path:string){
 const bytes=readFileSync(path);let offset=2;
 while(offset<bytes.length){if(bytes[offset]!==255)throw new Error('Invalid JPEG marker');const marker=bytes[offset+1],length=bytes.readUInt16BE(offset+2);
  if([0xc0,0xc1,0xc2].includes(marker))return [bytes.readUInt16BE(offset+7),bytes.readUInt16BE(offset+5)];offset+=2+length;
 }throw new Error('No JPEG dimensions');
}
test('larger view layouts choose smaller Earth maps at their first detail load',async()=>{
 const urls:string[]=[],pool=createEarthTexturePool(async url=>{urls.push(url);return new THREE.Texture();});
 const options={maxTextureSize:16384,deviceMemory:16,anisotropy:4,acquire:(url:string)=>pool.acquire(url)};
 const views=Array.from({length:4},()=>new EarthVisual(new THREE.MeshStandardMaterial(),options,assert.fail));
 try{
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,0,2);
  views[0].updateAppearance(Date.UTC(2026,0,1),camera,2500,new THREE.Vector3(10,0,0),new THREE.Vector3(0,0,60),.27,.004);
  await Promise.resolve();await Promise.resolve();
  assert.ok(urls.includes('/textures/earth/clouds-2k.jpg'));assert.ok(urls.includes('/textures/earth/night-2k.jpg'));
  assert.equal(urls.some(url=>url.includes('8k')||url.includes('4k')),false);
  assert.deepEqual(views[0].earthUniforms.earthAtmosphereSamples.value.toArray(),[8,3]);
 }finally{views.forEach(view=>view.dispose());}
});
test('bundled Earth textures include a true 8K surface, separate 4K fallback/clouds and registered support maps',()=>{
 for(const [file,size] of [['day-8k.jpg',[8192,4096]],['day-4k.jpg',[4096,2048]],['clouds-4k.jpg',[4096,2048]],['clouds-2k.jpg',[2048,1024]],['night-4k.jpg',[4096,2048]],['night-2k.jpg',[2048,1024]]] as const){assert.deepEqual(jpegSize('public/textures/earth/'+file),size);}
 for(const file of ['normal-2k.png','ocean-2k.png']){const b=readFileSync('public/textures/earth/'+file);assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],[2048,1024]);}
 const credit=JSON.parse(readFileSync('public/textures/earth/sources.json','utf8'));assert.ok(credit.license.includes('creativecommons.org/licenses/by/4.0'));assert.equal(Object.keys(credit.maps).length,5);
});
