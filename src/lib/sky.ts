import * as THREE from 'three';
import { J2000_OBLIQUITY, SKY_EQUATORIAL_GLSL } from './sky-coordinates';
import { acquireStarMap,releaseStarMap } from './sky-texture';

/** A separate sky pass: directions at infinity, no camera translation or depth writes. */
export class SkyBackground {
  private scene=new THREE.Scene();
  private camera=new THREE.Camera();
  private material:THREE.ShaderMaterial;
  private geometry=new THREE.PlaneGeometry(2,2);
  private textures:THREE.Texture[]=[];
  private disposed=false;

  constructor(onWarning:(message:string)=>void) {
    this.material=new THREE.ShaderMaterial({
      depthTest:false,depthWrite:false,
      uniforms:{
        inverseProjection:{value:new THREE.Matrix4()},cameraRotation:{value:new THREE.Matrix3()},
        obliquity:{value:J2000_OBLIQUITY},starMap:{value:null},figureMap:{value:null},
        showStars:{value:false},showFigures:{value:false},starsReady:{value:false},figuresReady:{value:false},
      },
      vertexShader:`varying vec2 screenPosition;
        void main(){screenPosition=position.xy;gl_Position=vec4(position.xy,0.0,1.0);}`,
      fragmentShader:`
        uniform mat4 inverseProjection; uniform mat3 cameraRotation;
        uniform float obliquity;
        uniform sampler2D starMap,figureMap;
        uniform bool showStars,showFigures,starsReady,figuresReady;
        varying vec2 screenPosition;
        ${SKY_EQUATORIAL_GLSL}
        vec3 crispStars(vec2 uv){
          vec2 texel=1.0/vec2(textureSize(starMap,0));
          vec3 center=texture2D(starMap,uv).rgb;
          vec3 left=texture2D(starMap,uv-vec2(texel.x,0.0)).rgb;
          vec3 right=texture2D(starMap,uv+vec2(texel.x,0.0)).rgb;
          vec3 above=texture2D(starMap,uv+vec2(0.0,texel.y)).rgb;
          vec3 below=texture2D(starMap,uv-vec2(0.0,texel.y)).rgb;
          vec3 average=(left+right+above+below)*0.25;
          vec3 ceiling=max(center,max(max(left,right),max(above,below)));
          // Mild, bounded sharpening counteracts texture interpolation softness.
          return clamp(center+0.35*(center-average),vec3(0.0),ceiling);
        }
        void main(){
          vec4 projected=inverseProjection*vec4(screenPosition,1.0,1.0);
          vec3 direction=normalize(cameraRotation*projected.xyz);
          vec3 equatorial=sceneToEquatorial(direction);
          vec2 uv=vec2(fract(0.5-atan(equatorial.y,equatorial.x)/6.28318530718),
                       0.5+asin(clamp(equatorial.z,-1.0,1.0))/3.14159265359);
          // A near-black floor avoids lifting the entire sky into a blue-gray haze.
          vec3 color=vec3(0.00008,0.00012,0.0002);
          if(showStars && starsReady){
            vec3 hdr=crispStars(uv);
            float peak=max(max(hdr.r,hdr.g),hdr.b);
            // Darken faint haze while letting stellar cores approach white.
            // Apply one gain to RGB to preserve the catalog's relative star colors.
            float mapped=pow(1.0-exp(-2.2*peak),1.3);
            color+=hdr*(mapped/max(peak,0.000001));
          }
          if(showFigures && figuresReady){
            float ink=texture2D(figureMap,uv).r;
            color+=vec3(0.24,0.48,0.72)*ink;
          }
          gl_FragColor=vec4(color,1.0);
          #include <colorspace_fragment>
        }`,
    });
    const quad=new THREE.Mesh(this.geometry,this.material);quad.frustumCulled=false;this.scene.add(quad);
    void acquireStarMap().then(texture=>{
      if(this.disposed)return;
      this.material.uniforms.starMap.value=texture;
      this.material.uniforms.starsReady.value=true;
    },()=>{if(!this.disposed)onWarning('The 2020 HDR star map could not load. Run npm run sky-data to restore it.');});
    this.load('constellation_figures.jpg','figureMap','figuresReady',false,onWarning);
  }

  private load(file:string,map:string,ready:string,color:boolean,onWarning:(message:string)=>void){
    const texture=new THREE.TextureLoader().load(`/textures/sky/${file}`,loaded=>{
      if(this.disposed){loaded.dispose();return;}
      // Bound GPU memory per view; NASA's 8K figure map is resampled to 4K.
      const image=loaded.image as HTMLImageElement;
      if(image.width>4096){const canvas=document.createElement('canvas');canvas.width=4096;canvas.height=2048;const ctx=canvas.getContext('2d');if(ctx){ctx.drawImage(image,0,0,canvas.width,canvas.height);loaded.image=canvas;}}
      loaded.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
      loaded.wrapS=THREE.RepeatWrapping;loaded.minFilter=THREE.LinearFilter;
      loaded.generateMipmaps=false;loaded.needsUpdate=true;
      this.material.uniforms[map].value=loaded;this.material.uniforms[ready].value=true;
    },undefined,()=>{if(!this.disposed)onWarning('Sky map could not load. Run npm run sky-data to restore the NASA assets.');});
    this.textures.push(texture);
  }

  draw(renderer:THREE.WebGLRenderer,camera:THREE.PerspectiveCamera,stars:boolean,figures:boolean){
    if(!stars&&!figures)return;
    this.material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    this.material.uniforms.cameraRotation.value.setFromMatrix4(camera.matrixWorld);
    this.material.uniforms.showStars.value=stars;
    this.material.uniforms.showFigures.value=figures;
    renderer.render(this.scene,this.camera);
  }

  dispose(){this.disposed=true;releaseStarMap();this.textures.forEach(t=>t.dispose());this.geometry.dispose();this.material.dispose();}
}
