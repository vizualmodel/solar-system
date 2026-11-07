import test from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE_PER_SECOND,playbackSpeeds,speedLabel } from '../src/lib/playback';
import { DAY } from '../src/lib/ephemeris';
import { defaultSimulationState,validateSimulationState } from '../src/lib/simulation-state';
test('one minute per second is selectable, advances exactly 60 seconds, and survives saving',()=>{
 assert.ok(playbackSpeeds.includes(MINUTE_PER_SECOND));
 assert.equal(speedLabel(MINUTE_PER_SECOND),'1 min / sec');
 assert.equal(MINUTE_PER_SECOND*DAY,60000);
 const s=defaultSimulationState();s.speed=MINUTE_PER_SECOND;
 assert.equal(validateSimulationState(JSON.parse(JSON.stringify(s))).speed,MINUTE_PER_SECOND);
});
