import data from '../data/rotation.json';
import { julianDate,type Vec3 } from './ephemeris';
import { J2000_OBLIQUITY } from './sky-coordinates';

interface RotationModel {ra:number[];dec:number[];w:number[];}
export const rotationModels:Record<string,RotationModel>=data.models;
const RAD=Math.PI/180;
const polynomial=(c:number[],t:number)=>c[0]+t*(c[1]+t*c[2]);
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function toScene([x,y,z]:Vec3):Vec3 {
 const c=Math.cos(J2000_OBLIQUITY),s=Math.sin(J2000_OBLIQUITY);
 return [x,-s*y+c*z,-c*y-s*z];
}

/** Approximate IAU orientation, recomputed from the timestamp (never accumulated). */
export function bodyOrientation(id:string,time:number):{x:Vec3;y:Vec3;z:Vec3} {
 const model=rotationModels[id];
 if(!model)throw new Error(`No rotation model for ${id}`);
 const d=julianDate(time)-2451545,T=d/36525;
 const ra=polynomial(model.ra,T)*RAD,dec=polynomial(model.dec,T)*RAD;
 const w=(polynomial(model.w,d)%360)*RAD;
 const pole:Vec3=[Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)];
 const node:Vec3=[-Math.sin(ra),Math.cos(ra),0];
 const transverse=cross(pole,node);
 const prime=node.map((v,i)=>v*Math.cos(w)+transverse[i]*Math.sin(w)) as Vec3;
 // SphereGeometry uses +Y at north, +X at map center, and -Z toward east.
 return {x:toScene(prime),y:toScene(pole),z:toScene(cross(prime,pole))};
}
