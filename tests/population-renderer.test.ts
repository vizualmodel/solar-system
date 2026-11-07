import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,PerspectiveCamera,Vector3} from 'three';
import {PopulationRenderer} from '../src/lib/population-renderer';
import {population,populationState} from '../src/lib/population';
import {defaultSimulationState} from '../src/lib/simulation-state';

test('population picking selects a visible dot, ignores drags, cancellation and disabled layers',()=>{
 const canvas=Object.assign(new EventTarget(),{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})});
 const scene=new Scene(),picked:(number|null)[]=[];
 const renderer=new PopulationRenderer(scene,canvas as unknown as HTMLCanvasElement,id=>picked.push(id));
 const row=population.find(row=>row.groups.includes('geo'))!;
 const p=populationState(row,row.epoch)!.position;
 const position=new Vector3(p[0],p[2],-p[1]);
 const camera=new PerspectiveCamera(45,800/600,1e-8,1);
 camera.position.copy(position).multiplyScalar(2);camera.lookAt(position);camera.updateMatrixWorld(true);
 const view={...defaultSimulationState('earth').views[0],populationGroups:['geo'] as ['geo']};
 renderer.draw(view,row.epoch,new Vector3(),camera,800,600);
 const send=(type:string,x=400,y=300,button=0)=>canvas.dispatchEvent(Object.assign(new Event(type),{clientX:x,clientY:y,button}));
 send('pointerdown');send('pointerup');assert.deepEqual(picked,[row.id]);picked.length=0;
 renderer.draw({...view,populationSelection:row.id},row.epoch,new Vector3(),camera,800,600);
 const orbit=scene.children.find(object=>object.type==='Line')!;
 assert.equal(orbit.visible,true);
 send('pointerdown',-100,-100);send('pointerup',-100,-100);assert.deepEqual(picked,[null]);picked.length=0;
 renderer.draw({...view,populationSelection:null},row.epoch,new Vector3(),camera,800,600);
 assert.equal(orbit.visible,false);
 // Returning to the starting point after orbiting must still count as a drag.
 send('pointerdown');send('pointermove',450);send('pointermove');send('pointerup');
 send('pointerdown');send('pointercancel');send('pointerup');
 send('pointerdown',400,300,2);send('pointerup');
 assert.deepEqual(picked,[]);
 renderer.draw({...view,populationGroups:[]},row.epoch,new Vector3(),camera,800,600);
 send('pointerdown');send('pointerup');assert.deepEqual(picked,[null]);picked.length=0;
 renderer.draw(view,row.epoch,new Vector3(),camera,800,600);
 renderer.dispose();send('pointerdown');send('pointerup');assert.deepEqual(picked,[]);
 scene.traverse(object=>{const mesh=object as any;mesh.geometry?.dispose();mesh.material?.dispose();});
});
