import { bodies } from './catalog';
export type Vec3 = [number,number,number];
export type Elements = [number,number,number,number,number,number,number,number];
export interface Ephemeris { start:string; end:string; bodies:Record<string,Elements[]>; }
export const DAY = 86400000;
const RAD = Math.PI/180;
// UTC -> TT (37 leap seconds + 32.184 s); TDB's periodic millisecond term is omitted.
export const julianDate = (ms:number) => ms/DAY + 2440587.5 + 69.184/86400;
export function eccentricAnomaly(mean:number,e:number) {
 const m=((mean+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
 let E=e<0.8?m:Math.sign(m||1)*Math.PI;
 for(let i=0;i<30;i++){const delta=(E-e*Math.sin(E)-m)/(1-e*Math.cos(E)); E-=delta; if(Math.abs(delta)<1e-13)break;}
 return E;
}
export function orbitalPoint(row:Elements,mean:number):Vec3 {
 const [,e,inc,node,peri,,,a]=row;
 const E=eccentricAnomaly(mean,e),x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E);
 const O=node*RAD,w=peri*RAD,I=inc*RAD;
 return [(Math.cos(O)*Math.cos(w)-Math.sin(O)*Math.sin(w)*Math.cos(I))*x+(-Math.cos(O)*Math.sin(w)-Math.sin(O)*Math.cos(w)*Math.cos(I))*y,
 (Math.sin(O)*Math.cos(w)+Math.cos(O)*Math.sin(w)*Math.cos(I))*x+(-Math.sin(O)*Math.sin(w)+Math.cos(O)*Math.cos(w)*Math.cos(I))*y,
 Math.sin(w)*Math.sin(I)*x+Math.cos(w)*Math.sin(I)*y];
}
export function bracket(rows:Elements[],jd:number) {
 let lo=0,hi=rows.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid][0]<=jd)lo=mid;else hi=mid;}
 return [rows[lo],rows[hi]];
}
export function propagate(row:Elements,jd:number):Vec3 {return orbitalPoint(row,(row[6]+row[5]*(jd-row[0]))*RAD);}
export function relativePosition(rows:Elements[],jd:number):Vec3 {
 const [a,b]=bracket(rows,jd),f=Math.max(0,Math.min(1,(jd-a[0])/(b[0]-a[0])));
 const p=propagate(a,jd),q=propagate(b,jd);
 // Smoothly join independently propagated osculating states at adjacent source epochs.
 const t=f*f*(3-2*f);
 return p.map((v,i)=>v*(1-t)+q[i]*t) as Vec3;
}
export function positions(data:Ephemeris,ms:number):Record<string,Vec3> {
 const result:Record<string,Vec3>={sun:[0,0,0]},jd=julianDate(ms);
 for(const b of bodies)if(b.parent){const p=relativePosition(data.bodies[b.id],jd),origin=result[b.parent];result[b.id]=p.map((v,i)=>v+origin[i]) as Vec3;}
 return result;
}
export const distance = (a:Vec3,b:Vec3) => Math.hypot(...a.map((v,i)=>v-b[i]));
