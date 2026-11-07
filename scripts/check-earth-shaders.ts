import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {EarthVisual} from '../src/lib/earth-visual';
const output='C:/dev/earth-shader-check/generated';mkdirSync(output,{recursive:true});
const earth=new EarthVisual(new THREE.MeshStandardMaterial(),{maxTextureSize:8192,deviceMemory:8,anisotropy:4,
 acquire:()=>({promise:Promise.resolve(new THREE.Texture()),release(){}})},console.warn);
const surface=earth.material,cloud=earth.children.find(m=>m.name==='Earth · animated clouds') as THREE.Mesh;
const atmosphere=earth.children.find(m=>m.name==='Earth · atmospheric scattering') as THREE.Mesh;
for(const [name,material,normalMap] of [['surface',surface,false],['surface-normal',surface,true],['cloud',cloud.material,false],['atmosphere',atmosphere.material,false]] as const){
 const custom=material instanceof THREE.ShaderMaterial;
 const shader={uniforms:{},vertexShader:custom?material.vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:custom?material.fragmentShader:THREE.ShaderLib.standard.fragmentShader};
 material.onBeforeCompile(shader as any,{} as any);
 const files:string[]=[];
 const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createProgram:()=>({}),createShader:(type:number)=>({type}),
  // Khronos reserves "average" as a qualifier; Three's existing helper uses it
  // as a function name. Alpha-rename that helper for this offline compiler only.
  shaderSource(s:{type:number},source:string){const file=`${output}/${name}.${s.type===35633?'vert':'frag'}`;writeFileSync(file,source.replace(/\baverage\b/g,'three_average'));files.push(file);},
  compileShader(){},attachShader(){},linkProgram(){},bindAttribLocation(){} };
 const parameters={vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader,defines:{},precision:'highp',
  shaderType:material.type,shaderName:name,isRawShaderMaterial:false,isShaderMaterial:custom,
  logarithmicDepthBuffer:true,rendererExtensionParallelShaderCompile:false,outputColorSpace:THREE.SRGBColorSpace,toneMapping:THREE.NoToneMapping,
  numDirLights:0,numPointLights:custom?0:1,numSpotLights:0,numSpotLightMaps:0,numSpotLightShadows:0,numSpotLightShadowsWithMaps:0,
  numRectAreaLights:0,numHemiLights:0,numDirLightShadows:0,numPointLightShadows:0,numClippingPlanes:0,numClipIntersection:0,
  map:name.startsWith('surface'),mapUv:'uv',normalMap,normalMapTangentSpace:normalMap,normalMapUv:'uv',vertexUvs:true,
  doubleSided:name==='cloud',flipSided:name==='atmosphere',alphaTest:name==='cloud',opaque:!material.transparent};
 new WebGLProgram({getContext:()=>gl,debug:{checkShaderErrors:false}} as any,name,parameters as any,{});
 const validator=process.argv[2]??'C:/dev/earth-shader-check/compiler/bin/glslang.exe';
 console.log(execFileSync(validator,['-l',...files],{encoding:'utf8',windowsHide:true}).trim());
}
earth.dispose();console.log('All Earth shader variants compiled and linked as GLSL ES 3.00.');
