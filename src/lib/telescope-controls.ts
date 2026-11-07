import { PerspectiveCamera,Quaternion,Vector3 } from 'three';

/** Optical zoom: change the lens only, never translate the camera. */
export function zoomTelescope(camera:PerspectiveCamera,delta:number){
 const tangent=Math.tan(camera.fov*Math.PI/360)*Math.exp(Math.max(-200,Math.min(200,delta))*0.001);
 camera.fov=Math.max(0.1,Math.min(100,Math.atan(tangent)*360/Math.PI));camera.updateProjectionMatrix();
}
/** Aim about the camera mount. Sensitivity scales with the visible angular field. */
export function aimTelescope(camera:PerspectiveCamera,target:Vector3,dx:number,dy:number,height:number){
 const direction=target.clone().sub(camera.position),distance=direction.length();direction.normalize();
 const up=camera.up.clone().normalize(),right=new Vector3().crossVectors(direction,up).normalize();
 const radians=camera.fov*Math.PI/180*0.7/Math.max(1,height);
 direction.applyQuaternion(new Quaternion().setFromAxisAngle(up,-dx*radians));
 right.crossVectors(direction,up).normalize();
 const pitched=direction.clone().applyQuaternion(new Quaternion().setFromAxisAngle(right,-dy*radians));
 if(Math.abs(pitched.dot(up))<0.9999)direction.copy(pitched);
 target.copy(camera.position).addScaledVector(direction,distance);camera.lookAt(target);
}

export class TelescopeControls {
 private pointers=new Map<number,{x:number;y:number}>();
 constructor(private camera:PerspectiveCamera,private target:Vector3,private element:HTMLElement,private enabled:()=>boolean,private start:()=>void,private end:()=>void){
  element.addEventListener('pointerdown',this.down);element.addEventListener('pointermove',this.move);
  element.addEventListener('pointerup',this.up);element.addEventListener('pointercancel',this.up);
  element.addEventListener('wheel',this.wheel,{passive:false});
  element.addEventListener('contextmenu',this.contextMenu);
 }
 private down=(e:PointerEvent)=>{if(!this.enabled()||e.button>2)return;e.preventDefault();this.start();this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.element.setPointerCapture(e.pointerId);};
 private move=(e:PointerEvent)=>{
  const previous=this.pointers.get(e.pointerId);if(!this.enabled()||!previous)return;e.preventDefault();
  const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)?.[1];
  if(other){const before=Math.hypot(previous.x-other.x,previous.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(before>0&&after>0)zoomTelescope(this.camera,Math.log(before/after)/0.001);}
  else aimTelescope(this.camera,this.target,e.clientX-previous.x,e.clientY-previous.y,this.element.clientHeight);
  this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.end();
 };
 private up=(e:PointerEvent)=>{if(!this.pointers.delete(e.pointerId))return;if(this.element.hasPointerCapture(e.pointerId))this.element.releasePointerCapture(e.pointerId);this.end();};
 private wheel=(e:WheelEvent)=>{if(!this.enabled())return;e.preventDefault();this.start();zoomTelescope(this.camera,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?this.element.clientHeight:1));this.end();};
 private contextMenu=(e:Event)=>{if(this.enabled())e.preventDefault();};
 dispose(){this.element.removeEventListener('pointerdown',this.down);this.element.removeEventListener('pointermove',this.move);this.element.removeEventListener('pointerup',this.up);this.element.removeEventListener('pointercancel',this.up);this.element.removeEventListener('wheel',this.wheel);this.element.removeEventListener('contextmenu',this.contextMenu);this.pointers.clear();}
}
