import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { AU } from '../src/lib/catalog';
import { DAY } from '../src/lib/ephemeris';
import { satelliteState,satelliteSnapshots,satelliteRelativePosition,satelliteOrbitPath,satelliteAvailable,SATELLITE_WINDOW,withSatellitePositions,satelliteMagnification,hubbleState,hubbleEpoch } from '../src/lib/satellites';
import { defaultSimulationState,newView,splitLayout,validateSimulationState } from '../src/lib/simulation-state';
import { exploreSatellite } from '../src/lib/satellite-demo';
import { createIssMesh } from '../src/lib/iss-mesh';
import { displayPosition,changeTracking } from '../src/lib/presentation';

const epoch=satelliteSnapshots.iss.epoch;
test('ISS has a plausible orbit and its own validity window and propagation cache',()=>{
 assert.equal(satelliteSnapshots.iss.norad,25544);
 assert.ok(satelliteSnapshots.iss.period/60000>90&&satelliteSnapshots.iss.period/60000<95);
 const before=structuredClone(hubbleState(hubbleEpoch));
 for(let i=0;i<=24;i++){
  const t=epoch+(i/24-0.5)*2*SATELLITE_WINDOW,state=satelliteState('iss',t)!;
  assert.ok(state);
  const radius=Math.hypot(...Object.values(state.position));assert.ok(radius>6650&&radius<6950);
  assert.ok(Math.abs(Math.asin(state.position.z/radius)*180/Math.PI)<52);
  assert.ok(Math.hypot(...Object.values(state.velocity))>7&&Math.hypot(...Object.values(state.velocity))<8);
 }
 assert.deepEqual(hubbleState(hubbleEpoch),before);
 assert.equal(satelliteAvailable(epoch+SATELLITE_WINDOW,'iss'),true);
 assert.equal(satelliteAvailable(epoch+SATELLITE_WINDOW+1,'iss'),true);
 assert.ok(satelliteRelativePosition('iss',epoch+365*DAY));
});
test('ISS and Hubble coexist without orbit scaling or cache interference',()=>{
 const positions=withSatellitePositions({earth:[1,2,3]},epoch);
 assert.ok(positions.hubble&&positions.iss);assert.notDeepEqual(positions.iss,positions.hubble);
 assert.deepEqual(displayPosition('iss',positions,1),displayPosition('iss',positions,100));
 const point=satelliteRelativePosition('iss',epoch)!;
 assert.ok(Math.hypot(...point)*AU>6650);
 const path=satelliteOrbitPath('iss',epoch,[0,0.0001,0.00015],0.001);
 assert.ok(path.some(p=>p.every(v=>v===0)));assert.ok(path.every(p=>p.every(Number.isFinite)));
 satelliteRelativePosition('iss',epoch+DAY);satelliteRelativePosition('hubble',hubbleEpoch);
 assert.deepEqual(satelliteRelativePosition('iss',epoch),point);
});
test('ISS exploration and magnification preserve existing Hubble and other views',()=>{
 const s=defaultSimulationState();s.views[0].satellites=['hubble'];s.views[0].satelliteSize=15000;
 s.views.push(newView('other'));s.layout=splitLayout(s.layout,'primary','other','row');
 const demo=exploreSatellite(s,'primary','iss');
 assert.equal(demo.time,epoch);assert.equal(demo.playing,false);
 assert.deepEqual(demo.views[0].satellites,['hubble','iss']);assert.deepEqual(demo.views[1],s.views[1]);
 assert.equal(satelliteMagnification(demo.views[0],'hubble'),15000);assert.equal(satelliteMagnification(demo.views[0],'iss'),1000);
 demo.views[0].satelliteFocus='iss';demo.views[0].satelliteSizes!.iss=2000;
 assert.deepEqual(validateSimulationState(JSON.parse(JSON.stringify(demo))),demo);
 assert.equal(satelliteMagnification(demo.views[0],'hubble'),15000);
 const p=withSatellitePositions({earth:[1,2,3]},epoch),origin=displayPosition('iss',p,1);
 assert.deepEqual(changeTracking(demo.views[0],p).camera,demo.views[0].camera.map((v,i)=>v+origin[i]));
 for(const values of [{iss:0},{iss:NaN},{iss:100001},{unknown:1000}]){const invalid=structuredClone(demo);invalid.views[0].satelliteSizes=values;assert.throws(()=>validateSimulationState(invalid));}
});
test('ISS silhouette contains modules and eight solar-array wings at approximate NASA dimensions',()=>{
 const mesh=createIssMesh(),box=new Box3().setFromObject(mesh);
 assert.ok(mesh.children.length>20);assert.ok(Math.abs(box.max.x-box.min.x-109)<0.5);
 assert.ok(Math.abs(box.max.z-box.min.z-73)<0.5);
 mesh.traverse(object=>{const part=object as import('three').Mesh;part.geometry?.dispose();if(part.material)for(const material of Array.isArray(part.material)?part.material:[part.material])material.dispose();});
});
