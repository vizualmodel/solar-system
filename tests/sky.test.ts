import test from 'node:test';
import assert from 'node:assert/strict';
import { equatorialToScene,skyUV,J2000_OBLIQUITY } from '../src/lib/sky-coordinates';
import { defaultScenario,validateScenario,newView } from '../src/lib/scenario';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('NASA sky mapping has RA zero at the center and increases leftward',()=>{
 for(const [ra,u] of [[0,.5],[Math.PI/2,.25],[Math.PI,0],[-Math.PI/2,.75]]){
  const uv=skyUV(equatorialToScene(ra,0));near(uv[0],u);near(uv[1],.5);
 }
});
test('equatorial poles and ecliptic north are aligned using J2000 obliquity',()=>{
 near(skyUV(equatorialToScene(0,Math.PI/2))[1],1);
 near(skyUV(equatorialToScene(0,-Math.PI/2))[1],0);
 near(skyUV([0,1,0])[1],1-J2000_OBLIQUITY/Math.PI);
 const north=equatorialToScene(0,Math.PI/2);near(north[1],Math.cos(J2000_OBLIQUITY));near(north[2],-Math.sin(J2000_OBLIQUITY));
});
test('legacy scenarios gain a disabled constellation layer without losing the session',()=>{
 const legacy=defaultScenario();delete (legacy.views[0] as Partial<typeof legacy.views[0]>).constellations;
 const migrated=validateScenario(legacy);assert.equal(migrated.views[0].constellations,false);assert.equal(migrated.time,legacy.time);assert.deepEqual(migrated.views[0].camera,legacy.views[0].camera);assert.equal(legacy.views[0].constellations,undefined);
});
test('sky switches save independently and malformed values are rejected',()=>{
 for(const stars of [false,true])for(const constellations of [false,true]){const s=defaultScenario();Object.assign(s.views[0],{stars,constellations});assert.deepEqual(validateScenario(JSON.parse(JSON.stringify(s))),s);}
 const s=defaultScenario();Object.assign(s.views[0],{constellations:'yes'});assert.throws(()=>validateScenario(s));
 assert.equal(newView().constellations,false);
});
