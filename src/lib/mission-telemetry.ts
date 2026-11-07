import {missionPose,METRES_PER_AU,type MissionContext} from './mission-flight';
import {missionById,missionTime,type MissionState} from './mission';
export function missionTelemetry(context:MissionContext,m:MissionState){
 const duration=missionById.get(m.id)!.chapters[m.chapter].duration;
 const a={...m,elapsed:Math.max(0,m.elapsed-.02)},b={...m,elapsed:Math.min(duration,m.elapsed+.02)};
 const p=missionPose(context,m),seconds=(missionTime(b)-missionTime(a))/1000;
 return {speed:seconds>0?missionPose(context,b).position.distanceTo(missionPose(context,a).position)*METRES_PER_AU/seconds/1000:0,earthAltitude:Math.max(0,p.position.length()*METRES_PER_AU/1000-6371),moonAltitude:Math.max(0,p.position.distanceTo(p.moon)*METRES_PER_AU/1000-1737.4)};
}
