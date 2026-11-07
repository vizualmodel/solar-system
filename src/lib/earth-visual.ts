import * as THREE from 'three';
import {RENDER_UNITS_PER_AU} from './render-units';
import {CLOUD_RADIUS,EARTH_LEVELS,cloudAnimation,earthDetailLevel,earthTextureResolution} from './earth-math';
import {acquireEarthTexture,type EarthTextureLease} from './earth-textures';
import {cloudGLSL,atmosphereVertex,atmosphereFragment} from './earth-shaders';

let geometryUsers=0;
const geometries=new Map<number,THREE.SphereGeometry>();
function geometry(segments:number){let g=geometries.get(segments);if(!g){g=new THREE.SphereGeometry(1,segments,segments/2);geometries.set(segments,g);}return g;}
function releaseGeometry(){if(--geometryUsers===0){geometries.forEach(g=>g.dispose());geometries.clear();}}
type Options={maxTextureSize:number;deviceMemory?:number;anisotropy:number;acquire?:typeof acquireEarthTexture};
export class EarthVisual extends THREE.Mesh<THREE.SphereGeometry,THREE.MeshStandardMaterial>{
 private level=0;
 private dead=false;
 private detailStarted=false;
 private leases:EarthTextureLease[]=[];
 private inverse=new THREE.Quaternion();
 private clouds:THREE.Mesh<THREE.SphereGeometry,THREE.MeshStandardMaterial>;
 private atmosphere:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
 private shellGeometry=new THREE.SphereGeometry(1.04,64,32);
 readonly earthUniforms={
  earthCloudMap:{value:null as THREE.Texture|null},earthCloudPhase:{value:new THREE.Vector2()},earthCloudReady:{value:0},
  earthNightMap:{value:null as THREE.Texture|null},earthNightReady:{value:0},
  earthOceanMap:{value:null as THREE.Texture|null},earthOceanReady:{value:0},
  earthSunDirection:{value:new THREE.Vector3(1,0,0)},earthCameraLocal:{value:new THREE.Vector3()},
  earthMoonLocal:{value:new THREE.Vector3(60,0,0)},earthMoonRadius:{value:0.2727},earthSunAngle:{value:0.00465},
  earthLogDepthFactor:{value:1/Math.log2(10000*RENDER_UNITS_PER_AU+1)},
  earthAtmosphereSamples:{value:new THREE.Vector2(8,3)},
 };
 constructor(material:THREE.MeshStandardMaterial,private options:Options,private warning:(message:string)=>void){
  super(geometry(64),material);geometryUsers++;this.name='Earth · surface, clouds and atmosphere';this.userData.earthOwned=true;
  const eclipse=material.onBeforeCompile;
  material.roughness=0.9;material.normalScale.set(0.22,0.22);
  material.onBeforeCompile=(shader,renderer)=>{
   eclipse.call(material,shader,renderer);Object.assign(shader.uniforms,this.earthUniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 earthMapUV;\nvarying vec3 earthLocalPoint;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nearthMapUV=uv;earthLocalPoint=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec2 earthMapUV;
varying vec3 earthLocalPoint;
uniform vec3 earthSunDirection;
uniform sampler2D earthNightMap;
uniform float earthNightReady;
uniform sampler2D earthOceanMap;
uniform float earthOceanReady;
${cloudGLSL}`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
float ocean=earthOceanReady*texture2D(earthOceanMap,earthMapUV).r;
roughnessFactor=mix(0.94,0.22,ocean);`)
    .replace('#include <opaque_fragment>',`
vec3 earthN=normalize(earthLocalPoint);
float earthDay=dot(earthN,earthSunDirection);
float cloudT=-earthDay+sqrt(earthDay*earthDay+${(CLOUD_RADIUS*CLOUD_RADIUS-1).toFixed(10)});
vec2 cloudShadowUV=earthUV(normalize(earthN+earthSunDirection*cloudT));
float coverage=cloudCoverage(cloudShadowUV);
outgoingLight*=1.0-0.30*coverage*smoothstep(0.0,0.12,earthDay);
outgoingLight*=mix(0.12,1.0,smoothstep(-0.15,0.25,earthDay));
vec3 citySample=texture2D(earthNightMap,earthMapUV).rgb;
vec3 cityLights=max(vec3(0.0),citySample-vec3(0.025));
float night=1.0-smoothstep(-0.14,0.08,earthDay);
outgoingLight+=1.5*cityLights*night*(1.0-0.85*cloudCoverage(earthMapUV))*earthNightReady;
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'earth-surface-v1';
  const cloudMaterial=new THREE.MeshStandardMaterial({color:0xf3f7ff,roughness:1,transparent:true,opacity:0.9,depthWrite:false,side:THREE.DoubleSide,alphaTest:0.015});
  cloudMaterial.forceSinglePass=true;
  cloudMaterial.onBeforeCompile=(shader,renderer)=>{
   eclipse.call(cloudMaterial,shader,renderer);Object.assign(shader.uniforms,this.earthUniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 earthCloudUV;\nvarying vec3 earthCloudPoint;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nearthCloudUV=uv;earthCloudPoint=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec2 earthCloudUV;\nvarying vec3 earthCloudPoint;\nuniform vec3 earthSunDirection;\n${cloudGLSL}`)
    .replace('#include <alphatest_fragment>','diffuseColor.a*=cloudCoverage(earthCloudUV);\n#include <alphatest_fragment>')
    .replace('#include <opaque_fragment>','outgoingLight*=mix(0.03,1.0,smoothstep(-0.1,0.15,dot(normalize(earthCloudPoint),earthSunDirection)));\n#include <opaque_fragment>');
  };
  cloudMaterial.customProgramCacheKey=()=> 'earth-clouds-v1';
  this.clouds=new THREE.Mesh(this.geometry,cloudMaterial);this.clouds.scale.setScalar(CLOUD_RADIUS);this.clouds.userData.earthOwned=true;this.clouds.name='Earth · animated clouds';this.clouds.visible=false;
  const atmosphereMaterial=new THREE.ShaderMaterial({uniforms:this.earthUniforms,vertexShader:atmosphereVertex,fragmentShader:atmosphereFragment,
   transparent:true,depthWrite:false,side:THREE.BackSide});
  this.atmosphere=new THREE.Mesh(this.shellGeometry,atmosphereMaterial);this.atmosphere.userData.earthOwned=true;
  this.atmosphere.name='Earth · atmospheric scattering';this.atmosphere.renderOrder=5;
  this.add(this.clouds,this.atmosphere);
  this.load('/textures/earth_daymap.jpg',texture=>{if(!this.detailMapLoaded){material.map=texture;material.color.set(0xffffff);material.needsUpdate=true;}});
 }
 private detailMapLoaded=false;
 private load(url:string,apply:(texture:THREE.Texture)=>void){
  const lease=(this.options.acquire??acquireEarthTexture)(url);this.leases.push(lease);
  void lease.promise.then(texture=>{
   if(this.dead)return;texture.anisotropy=Math.min(8,this.options.anisotropy);
   apply(texture);
  },()=>{if(!this.dead)this.warning(`Earth detail map could not load: ${url}. Showing available detail.`);});
 }
 updateAppearance(time:number,camera:THREE.PerspectiveCamera,diameterPixels:number,sun:THREE.Vector3,moon:THREE.Vector3,moonRadius:number,sunRadius:number){
  const next=earthDetailLevel(diameterPixels,this.level);
  if(next!==this.level){this.level=next;this.geometry=geometry(EARTH_LEVELS[next]);this.clouds.geometry=this.geometry;}
  this.inverse.copy(this.quaternion).invert();
  const uniforms=this.earthUniforms;
  uniforms.earthCameraLocal.value.copy(camera.position).sub(this.position).applyQuaternion(this.inverse).divideScalar(this.scale.x);
  const sunDistance=sun.distanceTo(this.position);
  uniforms.earthSunDirection.value.copy(sun).sub(this.position).normalize().applyQuaternion(this.inverse);
  uniforms.earthMoonLocal.value.copy(moon).sub(this.position).applyQuaternion(this.inverse).divideScalar(this.scale.x);
  uniforms.earthMoonRadius.value=moonRadius/this.scale.x;
  uniforms.earthSunAngle.value=sunRadius/sunDistance;
  uniforms.earthLogDepthFactor.value=1/Math.log2(camera.far*RENDER_UNITS_PER_AU+1);
  uniforms.earthCloudPhase.value.fromArray(cloudAnimation(time));
  const textureSize=earthTextureResolution(this.options.maxTextureSize,this.options.deviceMemory,geometryUsers),highQuality=textureSize>=8192;
  uniforms.earthAtmosphereSamples.value.set(highQuality&&diameterPixels>600?12:8,highQuality?4:3);
  this.atmosphere.visible=diameterPixels>12;
  if(diameterPixels<80||this.detailStarted)return;
  this.detailStarted=true;
  const resolution=highQuality?'8k':'4k',support=highQuality?'4k':'2k';
  this.load(textureSize<=2048?'/textures/earth_daymap.jpg':`/textures/earth/day-${resolution}.jpg`,texture=>{this.detailMapLoaded=true;this.material.map=texture;this.material.color.set(0xffffff);this.material.needsUpdate=true;});
  this.load('/textures/earth/normal-2k.png',texture=>{this.material.normalMap=texture;this.material.needsUpdate=true;});
  this.load('/textures/earth/ocean-2k.png',texture=>{uniforms.earthOceanMap.value=texture;uniforms.earthOceanReady.value=1;});
  this.load(`/textures/earth/night-${support}.jpg`,texture=>{uniforms.earthNightMap.value=texture;uniforms.earthNightReady.value=1;});
  this.load(`/textures/earth/clouds-${support}.jpg`,texture=>{uniforms.earthCloudMap.value=texture;uniforms.earthCloudReady.value=1;this.clouds.visible=true;});
 }
 dispose(){
  if(this.dead)return;this.dead=true;this.leases.forEach(l=>l.release());releaseGeometry();
  this.material.dispose();this.clouds.material.dispose();this.atmosphere.material.dispose();this.shellGeometry.dispose();
 }
}
