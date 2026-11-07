import * as T from 'three';
/** Metre-scale illustrative LC-39A platform, umbilical tower and flame trench. */
export function createLaunchPad(){
 const group=new T.Group(),steel=new T.MeshStandardMaterial({color:'#795d51',roughness:.85}),concrete=new T.MeshStandardMaterial({color:'#91918a',roughness:1});
 function box(x:number,y:number,z:number,w:number,h:number,d:number,mat=steel){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m);return m;}
 box(0,-1,0,230,2,200,concrete);box(0,3,0,42,6,48);box(0,6.5,16,42,1,16,concrete);box(0,6.5,-16,42,1,16,concrete);box(-17,6.5,0,8,1,20,concrete);box(17,6.5,0,8,1,20,concrete);
 box(0,.1,42,15,.3,65,new T.MeshStandardMaterial({color:'#343530'}));
 for(const x of [-23,-15])for(const z of [-5,5])box(x,57,z,1,114,1);
 for(let y=9;y<115;y+=8){box(-19,y,0,10,.6,12);for(const z of [-5,5]){const brace=box(-19,y+4,z,.4,11,.4);brace.rotation.z=.78;}}
 for(const y of [17,34,49,66,83,98]){const arm=box(-10,y,0,13,.7,2);arm.name='Umbilical arm';}
 box(-19,120,0,1,14,1);box(-12,114,0,15,.8,1);
 return group;
}
export function engineConfiguration(scene:string,met:number,p:number){
 if(scene==='launch')return met<164?{count:5,y:-54.8,radius:1.15,length:38,spread:3,warm:true}:met<555?{count:5,y:-13.3,radius:.65,length:18,spread:2,warm:false}:met<710?{count:1,y:12,radius:.7,length:16,spread:2.4,warm:false}:null;
 if(scene==='tli')return {count:1,y:-18,radius:.7,length:18,spread:2.4,warm:false};
 if(scene==='landing'&&p<.98||scene==='ascent'||scene==='lunar-orbit'||scene==='depart')return {count:1,y:scene==='landing'?-3:scene==='ascent'?-1:-6,radius:.35,length:5,spread:2.5,warm:false};
 return null;
}
/** Translucent, layered turbulent plumes; deterministic mission time freezes on pause. */
export class ApolloExhaust{
 group=new T.Group();private jets:T.Group[]=[];private materials:T.ShaderMaterial[]=[];
 constructor(){for(let i=0;i<5;i++){const jet=new T.Group();for(let layer=0;layer<2;layer++){
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0},warm:{value:1},core:{value:layer}},vertexShader:`varying vec2 vUv;\n#include <common>\n#include <logdepthbuf_pars_vertex>\nvoid main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);\n#include <logdepthbuf_vertex>\n}`,fragmentShader:`varying vec2 vUv;uniform float time,warm,core;\n#include <logdepthbuf_pars_fragment>\nvoid main(){\n#include <logdepthbuf_fragment>\nfloat axial=1.-vUv.y;float turbulence=.65+.35*sin(vUv.x*69.+time*26.+sin(vUv.y*35.-time*19.)*2.);float fade=pow(max(0.,1.-axial),.65);vec3 hot=mix(vec3(.25,.45,1.),vec3(1.,.22,.025),warm);gl_FragColor=vec4(mix(hot,vec3(1.,.96,.8),core*.8),fade*turbulence*(core>.5?.7:.32));}`});
  const mesh=new T.Mesh(new T.CylinderGeometry(layer?.35:1,layer?.05:3,1,28,24,true),material);mesh.position.y=-.5;jet.add(mesh);this.materials.push(material);
 }this.jets.push(jet);this.group.add(jet);}}
 update(scene:string,met:number,p:number){const e=engineConfiguration(scene,met,p);this.group.visible=!!e;if(!e)return;this.jets.forEach((j,i)=>{j.visible=i<e.count;const a=(i-1)*Math.PI/2,r=i===0?0:scene==='launch'&&met<164?3.25:2;j.position.set(Math.cos(a)*r,e.y,Math.sin(a)*r);j.scale.set(e.radius,e.length,e.radius);});this.materials.forEach(m=>{m.uniforms.time.value=met;m.uniforms.warm.value=e.warm?1:0;});}
}
export class LaunchSmoke{
 group=new T.Group();private sprites:T.Sprite[]=[];
 constructor(){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,r=Math.hypot((x-31.5)/32,(y-31.5)/32);data[i]=data[i+1]=data[i+2]=220;data[i+3]=Math.round(150*Math.max(0,1-r)**2);}const texture=new T.DataTexture(data,size,size);texture.needsUpdate=true;for(let i=0;i<100;i++){const s=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,color:i%3?'#ddd9d0':'#a9a69f'}));this.sprites.push(s);this.group.add(s);}}
 update(met:number){this.group.visible=met>=0&&met<100;if(!this.group.visible)return;this.sprites.forEach((s,i)=>{const age=((met+9+i*.63)%24),angle=i*2.39996,drift=age*(3+i%4);s.position.set(Math.cos(angle)*drift,2+age*(.7+i%3*.3),24+Math.sin(angle)*drift);s.scale.setScalar(8+age*2.5);(s.material as T.SpriteMaterial).opacity=Math.max(0,1-age/24)*Math.min(1,(100-met)/40);});}
}
