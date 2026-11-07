import { interpolatedOrbit,type Elements,type Vec3 } from './ephemeris';

export const ORBIT_PIXEL_ERROR=0.2;
const BASE_SEGMENTS=32,MAX_DEPTH=16;

/** Closed instantaneous orbit using the body's same blended states and phase.
 * Refine to a fraction of a pixel near the camera; distant arcs need fewer vertices.
 * Coordinates are relative to the body to preserve float32 accuracy at close zoom. */
export function orbitPath(rows:Elements[],jd:number,cameraFromBody:Vec3,pixelAngle:number,scale=1):Vec3[]{
 const curve=interpolatedOrbit(rows,jd),body=curve(0);
 function point(phase:number):Vec3{
  const p=curve(phase);
  return [(p[0]-body[0])*scale,(p[2]-body[2])*scale,-(p[1]-body[1])*scale];
 }
 const points:Vec3[]=[[0,0,0]];
 function refine(start:number,a:Vec3,end:number,b:Vec3,depth:number){
  const middle=(start+end)/2,m=point(middle);
  const error=Math.hypot(...m.map((v,i)=>v-(a[i]+b[i])/2));
  const distance=Math.min(...[a,m,b].map(p=>Math.hypot(...p.map((v,i)=>v-cameraFromBody[i]))));
  const tolerance=ORBIT_PIXEL_ERROR*pixelAngle*Math.max(distance,1e-10);
  if(error>tolerance&&depth<MAX_DEPTH){refine(start,a,middle,m,depth+1);refine(middle,m,end,b,depth+1);}
  else points.push(b);
 }
 for(let i=0;i<BASE_SEGMENTS;i++){
  const start=i/BASE_SEGMENTS*Math.PI*2,end=(i+1)/BASE_SEGMENTS*Math.PI*2;
  refine(start,points.at(-1)!,end,i===BASE_SEGMENTS-1?[0,0,0]:point(end),0);
 }
 points.pop(); // LineLoop closes back to the body's exact position.
 return points;
}
