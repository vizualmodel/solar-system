// Offline CPU approximation for art/physics QA. It is not a browser screenshot.
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {PerspectiveCamera,Vector3} from 'three';
import {raySphere,CLOUD_RADIUS,ATMOSPHERE_RADIUS,cloudAnimation} from '../src/lib/earth-math';
const staging='C:/dev/earth-shader-check/preview';mkdirSync(staging,{recursive:true});
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`
 Add-Type -AssemblyName System.Drawing
 foreach($name in @('day-4k','clouds-4k','night-4k','ocean-2k')) {
  $extension=if($name -eq 'ocean-2k'){'png'}else{'jpg'}
  $image=[Drawing.Image]::FromFile((Join-Path $pwd "public/textures/earth/$name.$extension"))
  $bitmap=[Drawing.Bitmap]::new(1024,512,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics=[Drawing.Graphics]::FromImage($bitmap);$graphics.DrawImage($image,0,0,1024,512)
  $data=$bitmap.LockBits([Drawing.Rectangle]::new(0,0,1024,512),[Drawing.Imaging.ImageLockMode]::ReadOnly,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes=[byte[]]::new(1024*512*4);[Runtime.InteropServices.Marshal]::Copy($data.Scan0,$bytes,0,$bytes.Length)
  [IO.File]::WriteAllBytes('${staging}/'+$name+'.rgba',$bytes)
  $bitmap.UnlockBits($data);$graphics.Dispose();$bitmap.Dispose();$image.Dispose()
 }
`],{windowsHide:true});
const maps=Object.fromEntries(['day-4k','clouds-4k','night-4k','ocean-2k'].map(name=>[name,readFileSync(`${staging}/${name}.rgba`)]));
const clamp=(n:number)=>Math.max(0,Math.min(1,n)),dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=(p:number[])=>{const l=Math.hypot(...p);return p.map(v=>v/l);};
const add=(p:number[],d:number[],t:number)=>p.map((v,i)=>v+d[i]*t);
const uv=(n:number[])=>[.5+Math.atan2(-n[2],n[0])/(2*Math.PI),.5+Math.asin(Math.max(-1,Math.min(1,n[1])))/Math.PI];
function sample(name:string,u:number,v:number){
 const fx=((u%1+1)%1)*1024-.5,fy=(1-clamp(v))*512-.5,x=Math.floor(fx),y=Math.floor(fy),a=fx-x,b=fy-y;
 const at=(dx:number,dy:number,k:number)=>maps[name][(Math.min(511,Math.max(0,y+dy))*1024+((x+dx+1024)%1024))*4+(2-k)]/255;
 return [0,1,2].map(k=>(1-b)*((1-a)*at(0,0,k)+a*at(1,0,k))+b*((1-a)*at(0,1,k)+a*at(1,1,k)));
}
const phase=cloudAnimation(Date.UTC(2026,9,6));
const smooth=(a:number,b:number,x:number)=>{const f=clamp((x-a)/(b-a));return f*f*(3-2*f);};
function cloud(u:number,v:number){const pole=Math.sin(v*Math.PI);return smooth(.08,.86,sample('clouds-4k',u+phase[0]+.0025*pole*Math.sin(v*18+phase[1]),clamp(v+.0015*pole*Math.sin(u*8*Math.PI+phase[1])))[0]);}
const linear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4,srgb=(v:number)=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
const beta=[36.9518,86.0085,210.8801];
function density(p:number[]){const h=Math.max(0,Math.hypot(...p)-1);return [Math.exp(-h/.00125569),Math.exp(-h/.000188354)];}
function atmosphere(c:number[],ray:number[],sun:number[]){
 const atmo=raySphere(c,ray,ATMOSPHERE_RADIUS);if(!atmo)return null;
 const start=atmo[0],ground=raySphere(c,ray,1),end=ground?Math.min(atmo[1],ground[0]):atmo[1];if(end<=start)return null;
 const view=[0,0],sumR=[0,0,0],sumM=[0,0,0],mu=dot(ray,sun),g=.76;
 const pr=.0596831*(1+mu*mu),pm=.1193662*(1-g*g)*(1+mu*mu)/((2+g*g)*Math.max(.001,1+g*g-2*g*mu)**1.5);
 for(let i=0;i<12;i++){
  let a=i/12,b=(i+1)/12;if(Math.hypot(...c)<ATMOSPHERE_RADIUS){a*=a;b*=b;}
  const p=add(c,ray,start+.5*(a+b)*(end-start)),dt=(b-a)*(end-start),d=density(p).map(x=>x*dt);view[0]+=d[0]*.5;view[1]+=d[1]*.5;
  const lightEnd=raySphere(p,sun,ATMOSPHERE_RADIUS)?.[1]??0,light=[0,0];
  for(let j=0;j<4;j++){const la=(j/4)**2,lb=((j+1)/4)**2,ld=density(add(p,sun,.5*(la+lb)*lightEnd));light[0]+=ld[0]*(lb-la)*lightEnd;light[1]+=ld[1]*(lb-la)*lightEnd;}
  const occulted=raySphere(p,sun,1);
  if(!occulted||occulted[0]<.000001)for(let k=0;k<3;k++){const t=Math.exp(-beta[k]*(view[0]+light[0])-140.162*(view[1]+light[1]));sumR[k]+=t*d[0];sumM[k]+=t*d[1];}
  view[0]+=d[0]*.5;view[1]+=d[1]*.5;
 }
 const color=beta.map((v,k)=>1-Math.exp(-18*(sumR[k]*v*pr+sumM[k]*127.42*pm))),alpha=Math.min(.98,1-beta.reduce((s,v)=>s+Math.exp(-v*view[0]-140.162*view[1]),0)/3);
 return {color,alpha};
}
const size=480,w=size*3,h=size,pixels=Buffer.alloc(w*h*4);
const cases=[{camera:[2.9,.35,0],target:[0,0,0],sun:[1,.2,.8]},{camera:[1.065,.10,0],target:[.70,.15,1],sun:[1,.3,.8]},{camera:[2.9,.35,0],target:[0,0,0],sun:[-1,.1,.12]}];
for(let panel=0;panel<cases.length;panel++){
 const c=cases[panel],sun=unit(c.sun),camera=new PerspectiveCamera(43,1,.001,100);camera.position.fromArray(c.camera);if(panel===1)camera.up.copy(camera.position).normalize();camera.lookAt(new Vector3(...c.target));camera.updateMatrixWorld(true);
 for(let y=0;y<h;y++)for(let x=0;x<size;x++){
  const ray=new Vector3(2*(x+.5)/size-1,1-2*(y+.5)/h,.5).unproject(camera).sub(camera.position).normalize().toArray(),ground=raySphere(c.camera,ray,1);
  let color=[.002,.003,.006];
  if(ground){const p=add(c.camera,ray,ground[0]),n=unit(p),[u,v]=uv(n),day=dot(n,sun),albedo=sample('day-4k',u,v).map(linear),night=sample('night-4k',u,v).map(linear);
   const ct=-day+Math.sqrt(day*day+CLOUD_RADIUS*CLOUD_RADIUS-1),cu=uv(unit(add(n,sun,ct))),shade=1-.3*cloud(...cu as [number,number])*smooth(0,.12,day);
   color=albedo.map((channel,k)=>srgb(clamp(channel*(.065+.96*Math.max(0,day))*shade*(.12+.88*smooth(-.15,.25,day))+1.5*Math.max(0,night[k]-.025)*(1-smooth(-.14,.08,day))*(1-.85*cloud(u,v)))));
  }
  const clouds=raySphere(c.camera,ray,CLOUD_RADIUS);if(clouds){const p=add(c.camera,ray,clouds[0]),n=unit(p),coords=uv(n),a=.9*cloud(...coords as [number,number]),day=dot(n,sun),light=srgb(clamp((.065+.96*Math.max(0,day))*(.03+.97*smooth(-.1,.15,day))));color=color.map(v=>v*(1-a)+a*light);}
  const air=atmosphere(c.camera,ray,sun);if(air&&air.alpha>.0001)color=color.map((v,k)=>v*(1-air.alpha)+air.alpha*srgb(clamp(air.color[k]/air.alpha)));
  const at=(y*w+panel*size+x)*4;for(let k=0;k<3;k++)pixels[at+k]=Math.round(clamp(color[k])*255);pixels[at+3]=255;
 }
}
function crc32(b:Buffer){let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(name:string,data:Buffer){const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),out.length-4);return out;}
const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
const rows=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)pixels.copy(rows,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
const file=process.argv[2]??'C:/dev/earth-preview.png';writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));console.log(file);
