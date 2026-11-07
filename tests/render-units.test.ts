import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Scene,Mesh,SphereGeometry,MeshBasicMaterial} from 'three';
import {RENDER_UNITS_PER_AU,updateRenderCamera} from '../src/lib/render-units';

test('metre render camera preserves apparent positions and clipping without changing the saved AU camera',()=>{
 const camera=new PerspectiveCamera(45,1.6,1e-11,10000);
 camera.position.set(180,140,200).divideScalar(RENDER_UNITS_PER_AU);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const before=camera.toJSON(),renderCamera=new PerspectiveCamera();updateRenderCamera(camera,renderCamera);
 assert.deepEqual(camera.toJSON(),before);
 for(const point of [[0,0,0],[30,5,-40],[1000000,10000,-2000000]]){
  const au=new Vector3(...point).divideScalar(RENDER_UNITS_PER_AU).project(camera),metres=new Vector3(...point).project(renderCamera);
  assert.ok(au.distanceTo(metres)<1e-12);
 }
 assert.equal(renderCamera.near,camera.near*RENDER_UNITS_PER_AU);assert.equal(renderCamera.far,camera.far*RENDER_UNITS_PER_AU);
});

test('actual log-depth float32 calculation separates nearby ISS surfaces at metre units',()=>{
 const logDepth=(distance:number,scale:number)=>Math.round(Math.fround(Math.log2(Math.fround(1+Math.fround(distance*scale)))/Math.log2(1+10000*RENDER_UNITS_PER_AU*scale))*(2**24-1));
 // This is the previous failure: even surfaces metres apart collapse to identical depth.
 assert.equal(logDepth(150,1/RENDER_UNITS_PER_AU),logDepth(151,1/RENDER_UNITS_PER_AU));
 for(const distance of [2,20,150,300]){
  assert.ok(logDepth(distance,1)<logDepth(distance+0.001,1),`1 mm separation at ${distance} m`);
 }
 assert.ok(logDepth(1000,1)<logDepth(1000.01,1),'1 cm separation at 1 km in a 24-bit depth buffer');
});

test('scene scaling keeps body-relative eclipse coordinates in AU',()=>{
 const scene=new Scene();scene.scale.setScalar(RENDER_UNITS_PER_AU);
 const mesh=new Mesh(new SphereGeometry(),new MeshBasicMaterial());mesh.position.set(1,0,0);mesh.scale.setScalar(6371/149597870.7);scene.add(mesh);scene.updateMatrixWorld(true);
 const transformed=new Vector3(1,0,0).applyMatrix4(mesh.matrixWorld),centre=mesh.getWorldPosition(new Vector3());
 assert.ok(Math.abs(transformed.sub(centre).length()/RENDER_UNITS_PER_AU-6371/149597870.7)<1e-15);
 mesh.geometry.dispose();mesh.material.dispose();
});
