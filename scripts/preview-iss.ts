// Offline geometry/material QA; this is a software preview, not the WebGL renderer.
import {writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {Mesh,MeshStandardMaterial,Vector3,Matrix3,PerspectiveCamera} from 'three';
import {loadSatelliteAsset} from '../tests/helpers/satellite-asset';
import {normalizeSatelliteModel,disposeSatelliteModel} from '../src/lib/satellite-model';
const model=normalizeSatelliteModel((await loadSatelliteAsset('iss')).scene,'iss');model.updateMatrixWorld(true);
const w=1100,h=760,pixels=Buffer.alloc(w*h*4),depth=new Float64Array(w*h).fill(Infinity);
for(let i=0;i<w*h;i++){pixels[i*4]=8;pixels[i*4+1]=13;pixels[i*4+2]=20;pixels[i*4+3]=255;}
const camera=new PerspectiveCamera(40,w/h,0.1,10000);camera.position.set(130,150,170);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
const light=new Vector3(0.4,1,0.8).normalize();
model.traverse(object=>{if(!(object instanceof Mesh))return;
 const g=object.geometry,index=g.index!,p=g.getAttribute('position'),normals=g.getAttribute('normal'),normalMatrix=new Matrix3().getNormalMatrix(object.matrixWorld);
 const points:number[][]=[],normal:Vector3[]=[];
 for(let i=0;i<p.count;i++){
  const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld).project(camera);
  points.push([(v.x+1)*w/2,(1-v.y)*h/2,v.z]);normal.push(new Vector3().fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize());
 }
 const m=object.material as MeshStandardMaterial;
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],a=points[ids[0]],b=points[ids[1]],c=points[ids[2]];
  if([a,b,c].some(v=>v[2]<-1||v[2]>1))continue;
  const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(area)<0.001)continue;
  const shade=0.2+0.8*Math.abs(normal[ids[0]].clone().add(normal[ids[1]]).add(normal[ids[2]]).normalize().dot(light));
  const color=m.color.clone().multiplyScalar(shade).convertLinearToSRGB(),rgb=[color.r*255,color.g*255,color.b*255];
  for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));y<=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));y++){
   for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));x<=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0])));x++){
    const u=((b[0]-x)*(c[1]-y)-(b[1]-y)*(c[0]-x))/area,v=((c[0]-x)*(a[1]-y)-(c[1]-y)*(a[0]-x))/area,t=1-u-v;
    if(u<0||v<0||t<0)continue;const z=u*a[2]+v*b[2]+t*c[2],at=y*w+x;if(z>=depth[at])continue;
    depth[at]=z;for(let k=0;k<3;k++)pixels[at*4+k]=Math.min(255,Math.max(0,Math.round(rgb[k])));
   }
  }
 }
});
function crc32(buffer:Buffer){let crc=0xffffffff;for(const b of buffer){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(name:string,data:Buffer){const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),out.length-4);return out;}
const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
const scanlines=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)pixels.copy(scanlines,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
const output=process.argv[2]??'C:/dev/iss-preview.png';writeFileSync(output,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]));
disposeSatelliteModel(model);console.log(output);
