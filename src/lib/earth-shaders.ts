// Cloud coordinates are shared by the shell, ground shadows and night-light attenuation.
export const cloudGLSL=/* glsl */`
uniform sampler2D earthCloudMap;
uniform vec2 earthCloudPhase;
uniform float earthCloudReady;
vec2 earthUV(vec3 n) {
 return vec2(0.5 + atan(-n.z,n.x)/6.28318530718, 0.5 + asin(clamp(n.y,-1.0,1.0))/3.14159265359);
}
float cloudCoverage(vec2 uv) {
 float pole=sin(uv.y*3.14159265359);
 vec2 warped=vec2(uv.x+earthCloudPhase.x+0.0025*pole*sin(uv.y*18.0+earthCloudPhase.y),
  clamp(uv.y+0.0015*pole*sin(uv.x*25.1327412287+earthCloudPhase.y),0.0,1.0));
 return earthCloudReady*smoothstep(0.08,0.86,texture2D(earthCloudMap,warped).r);
}
`;
export const atmosphereVertex=/* glsl */`
varying vec3 earthAtmoPoint;
varying vec3 earthAtmoView;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
 earthAtmoPoint=position;
 vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
 earthAtmoView=mvPosition.xyz;
 gl_Position=projectionMatrix*mvPosition;
 #include <logdepthbuf_vertex>
}
`;
export const atmosphereFragment=/* glsl */`
varying vec3 earthAtmoPoint;
varying vec3 earthAtmoView;
uniform vec3 earthCameraLocal;
uniform vec3 earthSunDirection;
uniform vec3 earthMoonLocal;
uniform float earthMoonRadius;
uniform float earthSunAngle;
uniform float earthLogDepthFactor;
uniform vec2 earthAtmosphereSamples;
const float ATMO=1.025113797;
const vec3 BETA_R=vec3(36.9518,86.0085,210.8801);
const vec3 BETA_M=vec3(127.42);
vec2 sphereInterval(vec3 p,vec3 d,float radius){
 float b=dot(p,d),q=b*b-dot(p,p)+radius*radius;
 if(q<0.0)return vec2(1.0,-1.0);
 float root=sqrt(q);return vec2(-b-root,-b+root);
}
vec2 density(vec3 p){
 float height=max(0.0,length(p)-1.0);
 return exp(-height/vec2(0.00125569,0.000188354));
}
float sunVisibility(vec3 p){
 // Earth blocks sunlight below the local horizon. Sample Moon occultation too,
 // so the existing eclipse scenes are not filled with an unshadowed blue haze.
 vec2 ground=sphereInterval(p,earthSunDirection,1.0);
 if(ground.y>0.0&&ground.x>0.000001)return 0.0;
 vec3 moon=earthMoonLocal-p;float dist=length(moon);
 float separation=length(moon/max(dist,0.000001)-earthSunDirection);
 float moonAngle=earthMoonRadius/max(dist,0.000001);
 return smoothstep(max(0.0,moonAngle-earthSunAngle),moonAngle+earthSunAngle,separation);
}
void main(){
 vec3 ray=normalize(earthAtmoPoint-earthCameraLocal);
 vec2 interval=sphereInterval(earthCameraLocal,ray,ATMO);
 float start=max(0.0,interval.x),end=interval.y;
 vec2 ground=sphereInterval(earthCameraLocal,ray,1.0);
 if(ground.x>0.0)end=min(end,ground.x);
 if(end<=start)discard;
 // Depth-test at the atmosphere entry, rather than at the back of its shell.
 // This lets haze cover the ground but keeps nearby spacecraft in front of it.
 float viewDepth=start*max(0.0,-earthAtmoView.z)/max(length(earthAtmoPoint-earthCameraLocal),0.000001);
 gl_FragDepth=log2(1.0+viewDepth)*earthLogDepthFactor;
 float mu=dot(ray,earthSunDirection),g=0.76;
 float phaseR=0.0596831*(1.0+mu*mu);
 float phaseM=0.1193662*(1.0-g*g)*(1.0+mu*mu)/((2.0+g*g)*pow(max(0.001,1.0+g*g-2.0*g*mu),1.5));
 vec2 viewDepths=vec2(0.0);vec3 sumR=vec3(0.0),sumM=vec3(0.0);
 bool inside=length(earthCameraLocal)<ATMO;
 for(int i=0;i<12;i++){
  if(float(i)>=earthAtmosphereSamples.x)break;
  float a=float(i)/earthAtmosphereSamples.x,b=float(i+1)/earthAtmosphereSamples.x;
  if(inside){a*=a;b*=b;}
  float dt=(b-a)*(end-start);
  vec3 p=earthCameraLocal+ray*(start+0.5*(a+b)*(end-start));
  vec2 localDensity=density(p)*dt;viewDepths+=localDensity*0.5;
  float lightEnd=max(0.0,sphereInterval(p,earthSunDirection,ATMO).y);
  vec2 lightDepths=vec2(0.0);
  for(int j=0;j<4;j++){
   if(float(j)>=earthAtmosphereSamples.y)break;
   float la=float(j)/earthAtmosphereSamples.y,lb=float(j+1)/earthAtmosphereSamples.y;la*=la;lb*=lb;
   lightDepths+=density(p+earthSunDirection*(0.5*(la+lb)*lightEnd))*(lb-la)*lightEnd;
  }
  vec3 extinction=exp(-BETA_R*(viewDepths.x+lightDepths.x)-BETA_M*1.1*(viewDepths.y+lightDepths.y));
  float lit=sunVisibility(p);
  sumR+=extinction*localDensity.x*lit;sumM+=extinction*localDensity.y*lit;
  viewDepths+=localDensity*0.5;
 }
 vec3 scattering=vec3(1.0)-exp(-18.0*(sumR*BETA_R*phaseR+sumM*BETA_M*phaseM));
 vec3 transmission=exp(-BETA_R*viewDepths.x-BETA_M*1.1*viewDepths.y);
 float alpha=clamp(1.0-dot(transmission,vec3(0.3333333)),0.0,0.98);
 if(alpha<0.0001)discard;
 gl_FragColor=vec4(scattering/max(alpha,0.0001),alpha);
 #include <colorspace_fragment>
}
`;
