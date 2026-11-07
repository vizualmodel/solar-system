import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BufferGeometry,BufferAttribute} from 'three';

// Geometry inspection without WebGL. Raster decoding remains browser-owned.
Object.defineProperty(globalThis,'self',{configurable:true,value:globalThis});
Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:async()=>({width:1,height:1,close(){}})});
Object.defineProperty(globalThis,'ProgressEvent',{configurable:true,value:class{constructor(public type:string){}}});
const factory=runInNewContext(readFileSync('public/models/draco/draco_decoder.js','utf8')+';DracoDecoderModule',{console,TextDecoder,TextEncoder,setTimeout});
const draco:any=await new Promise(resolve=>factory({onModuleLoaded:(d:any)=>resolve({module:d})})).then((v:any)=>v.module);
const decoder={preload(){},decodeDracoFile(buffer:ArrayBuffer,done:(g:BufferGeometry)=>void,ids:Record<string,number>){
 const d=new draco.Decoder(),mesh=new draco.Mesh(),bytes=new Int8Array(buffer),status=d.DecodeArrayToMesh(bytes,bytes.byteLength,mesh);
 assert.ok(status.ok(),status.error_msg());const geometry=new BufferGeometry();
 for(const [name,id] of Object.entries(ids)){
  const a=d.GetAttributeByUniqueId(mesh,id),count=mesh.num_points()*a.num_components(),ptr=draco._malloc(count*4);
  d.GetAttributeDataArrayForAllPoints(mesh,a,draco.DT_FLOAT32,count*4,ptr);
  const values=new Float32Array(count);values.set(draco.HEAPF32.subarray(ptr/4,ptr/4+count));draco._free(ptr);
  geometry.setAttribute(name,new BufferAttribute(values,a.num_components()));
 }
 const count=mesh.num_faces()*3,ptr=draco._malloc(count*4);d.GetTrianglesUInt32Array(mesh,count*4,ptr);
 const indices=new Uint32Array(count);indices.set(draco.HEAPU32.subarray(ptr/4,ptr/4+count));draco._free(ptr);geometry.setIndex(new BufferAttribute(indices,1));
 draco.destroy(mesh);draco.destroy(d);done(geometry);return Promise.resolve();
}};
export async function loadSatelliteAsset(id:'iss'|'hubble'|'apollo/saturn'|'apollo/lm'){
 const bytes=readFileSync(`public/models/${id}.glb`),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 return new GLTFLoader().setDRACOLoader(decoder as any).parseAsync(buffer,'');
}
