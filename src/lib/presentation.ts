import { byId } from './catalog';
import type { Vec3 } from './ephemeris';
import type { ViewConfig } from './scenario';
// Convert physical ecliptic coordinates to the renderer's Y-up basis.
export function displayPosition(id:string,positions:Record<string,Vec3>,moonScale:number):Vec3 {
 const p=[...positions[id]] as Vec3,body=byId[id];
 if(body.parent&&body.parent!=='sun'){const parent=positions[body.parent];for(let i=0;i<3;i++)p[i]=parent[i]+(p[i]-parent[i])*moonScale;}
 return [p[0],p[2],-p[1]];
}
export function changeTracking(view:ViewConfig,positions:Record<string,Vec3>):Partial<ViewConfig> {
 const origin=displayPosition(view.focus,positions,view.moonScale),sign=view.follow?1:-1;
 return {follow:!view.follow,camera:view.camera.map((v,i)=>v+sign*origin[i]) as Vec3,target:view.target.map((v,i)=>v+sign*origin[i]) as Vec3};
}
