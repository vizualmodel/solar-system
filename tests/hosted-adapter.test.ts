import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHostedAdapter, type HostedRequest } from '../hosted/adapter';
import { defaultSimulationState, MAX_TIME } from '../src/lib/simulation-state';
import { nextClosestApproach } from '../src/lib/closest-approach';
import type { Ephemeris } from '../src/lib/ephemeris';

// Existing controls transitively import the browser store. These globals only
// permit domain unit tests; this fixture is not browser acceptance evidence.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => {} } });
Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '' } });
const { applyControl } = await import('../companion/controls');

const data = JSON.parse(readFileSync(new URL('../public/data/ephemeris.json', import.meta.url), 'utf8')) as Ephemeris;
function fixture() {
  let state = defaultSimulationState(), revision = 1, applies = 0;
  const adapter = createHostedAdapter({ modelBuild: 'test-build', dataVersion: 'test-data', read: () => ({ state, revision }),
    async apply(method, params) { state = applyControl(state, method, params); revision++; applies++; },
    async investigate(after, until) { return nextClosestApproach(data, 'earth', 'mars', after, until); },
  });
  const target = { sessionId: 'test-tab', generation: 1, read: true, operate: true };
  let sequence = 0;
  const request = (action: HostedRequest['action'], inputs = {}): HostedRequest => ({ protocol: 1, id: 'request-' + ++sequence, sessionId: target.sessionId, generation: 1, deadline: Date.now() + 30000, action, inputs });
  return { adapter, target, request, get state() { return state; }, get applies() { return applies; }, manual() { revision++; } };
}
test('absolute controls use existing dispatcher, preserve playback and deduplicate a request', async () => {
  const f = fixture(), playing = f.state.playing;
  const p = f.request('set_time', { time: '2026-01-01T00:00:00Z', expectedRevision: 1 });
  const first = await f.adapter.execute(p, f.target);
  assert.equal(await f.adapter.execute(p, f.target), first);
  assert.equal(f.applies, 1); assert.equal(f.state.time, Date.parse('2026-01-01T00:00:00Z')); assert.equal(f.state.playing, playing);
  await f.adapter.execute(f.request('set_view_options', { viewId: f.state.active, labels: false, expectedRevision: 2 }), f.target);
  assert.equal(f.state.views[0].labels, false);
  assert.throws(() => f.adapter.execute({ ...p, inputs: { time: '2027-01-01T00:00:00Z', expectedRevision: 1 } }, f.target), /reused/);
});
test('wrong tab/generation, expiry, read-only consent, unknown fields and manual races fail before mutation', async () => {
  const f = fixture(), p = f.request('set_time', { time: '2026-01-01T00:00:00Z', expectedRevision: 1 });
  for (const target of [{ ...f.target, sessionId: 'other' }, { ...f.target, generation: 2 }, { ...f.target, operate: false }]) assert.throws(() => f.adapter.execute(p, target));
  assert.throws(() => f.adapter.execute({ ...p, deadline: Date.now() - 1 }, f.target), /deadline/);
  await assert.rejects(f.adapter.execute(f.request('set_time', { ...p.inputs, shell: 'no' }), f.target), /Unsupported/);
  f.manual();
  await assert.rejects(f.adapter.execute(p, f.target), /State changed/);
  assert.equal(f.applies, 0);
});
test('Earth–Mars adapter agrees exactly with the existing calculation and does not change state', async () => {
  const f = fixture(), before = structuredClone(f.state);
  const after = '2026-01-01T00:00:00Z', until = new Date(MAX_TIME).toISOString();
  const direct = nextClosestApproach(data, 'earth', 'mars', Date.parse(after), MAX_TIME)!;
  const response = await f.adapter.execute(f.request('investigate_earth_mars', { after, until }), f.target) as any;
  assert.equal(response.result.time, new Date(direct.time).toISOString());
  assert.equal(response.result.distance, direct.distanceAU);
  assert.equal(response.result.units.distance, 'AU');
  assert.deepEqual(f.state, before); assert.equal(f.applies, 0);
  assert.equal(response.modelBuild, 'test-build');
  assert.equal(response.effectiveInputs.after, new Date(after).toISOString());
  console.info(JSON.stringify({ evidence: 'direct-domain-test-not-browser-or-ChatGPT', after, until, result: direct }));
});
