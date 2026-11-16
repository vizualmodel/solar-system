import test from 'node:test';import assert from 'node:assert/strict';import {observation,toolSummary} from '../model-service/observation';
test('summary observations omit full simulationState but retain identity; full observations preserve it', () => {
  const state = { schema: 1, simulationState: { views: [{ camera: [1,2,3] }] } };
  const value = { time: '2027-01-01T00:00:00.000Z', playing: false, workspace: 'workspace', build: { id: 'build', sourceDigest: 'dirty-source' }, state };
  const small = observation(value); assert.equal(small.viewCount, 1); assert.ok(!('state' in small)); assert.equal(small.build.sourceDigest, 'dirty-source');
  assert.deepEqual(observation(value, 'full').state, state);
  assert.match(toolSummary('get_simulation_state', small), /2027-01-01.*paused.*build/);
});
