import { byId,AU } from './catalog';
import { updateView } from './store';
export function focus(id:string,body:string,preset:'system'|'portrait'='system') {
 const b=byId[body];const distances:Record<string,number>={sun:38,mercury:0.0008,venus:0.0015,earth:0.012,mars:0.0008,jupiter:0.035,saturn:0.045,uranus:0.018,neptune:0.018};
 const d=preset==='portrait'?b.radius/AU*7:(distances[body]??b.radius/AU*9);
 updateView(id,{focus:body,follow:true,camera:[0,d*0.55,d*0.85],target:[0,0,0],size:body==='sun'&&preset==='system'?60:1,moonScale:1});
}
