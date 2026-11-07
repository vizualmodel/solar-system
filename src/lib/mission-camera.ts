import {Vector3} from 'three';
import {missionById,type MissionState} from './mission';
import type {MissionView} from './mission-views';
import {missionPose,surfaceDirection,METRES_PER_AU,type MissionContext} from './mission-flight';
export function missionCameraFrame(data:MissionContext,state:MissionState,view:MissionView){
 const pose=missionPose(data,state),chapter=missionById.get(state.id)!.chapters[state.chapter];
 const mode=view.mode==='guided'?(chapter.camera==='overview'?(pose.scene==='parking'?'earth':'overview'):'spacecraft'):view.mode;
 let origin=pose.position.clone(),distance=chapter.distance,up=pose.up.clone(),direction=pose.forward.clone().multiplyScalar(.9).addScaledVector(up,.3).normalize();
 if(mode==='overview'){origin=pose.moon.clone().multiplyScalar(.5);distance=470000000;up.set(0,1,0);direction.set(.2,.75,1).normalize();}
 if(mode==='earth'){origin=new Vector3();distance=18000000;up.set(0,1,0);direction.copy(pose.position).normalize().add(new Vector3(0,.4,.5)).normalize();}
 if(mode==='moon'){origin=pose.moon.clone();distance=5500000;up.set(0,1,0);direction.copy(pose.position).sub(pose.moon).normalize().add(new Vector3(.2,.5,.3)).normalize();}
 if(mode==='spacecraft'&&view.mode!=='guided')distance=chapter.camera==='overview'?90:chapter.distance;
 if(mode==='pad'){up=surfaceDirection('earth',pose.time,28.608,-80.604);origin=up.clone().multiplyScalar((6371000+55)/METRES_PER_AU);direction=new Vector3().crossVectors(up,new Vector3(0,1,0)).normalize().addScaledVector(up,.25).normalize();distance=330;}
 return {pose,origin,up,direction,distance,overview:['overview','earth','moon','pad'].includes(mode)};
}
