import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { defaultScenario } from '../src/lib/scenario';

// A Node store integration test, not a real-browser or visible-UI test.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '' } });
const { scenario, command } = await import('../src/lib/store');
const { applyBrowserRequest } = await import('../src/dev/browser-adapter');
const { compareReload } = await import('../src/dev/reload-preservation');
const request = { id: 'store-test', expiresAt: Date.now() + 60_000 };

test('adapter changes and reads the actual UI store, preserving playback', () => {
  scenario.set({ ...defaultScenario(), playing: true });
  const actual = applyBrowserRequest({ ...request, method: 'set_simulation_time', time: '2027-01-01T01:00:00+01:00' });
  assert.deepEqual(actual, { time: '2027-01-01T00:00:00.000Z', playing: true });
  assert.equal(get(scenario).time, Date.parse(actual.time));
  command({ type: 'time', value: Date.parse('2028-06-15T12:34:00Z') });
  command({ type: 'play', value: false });
  assert.deepEqual(applyBrowserRequest({ ...request, method: 'get_simulation_state' }), { time: '2028-06-15T12:34:00.000Z', playing: false });
});

test('expired, invalid, and narrowed-range commands do not mutate the scenario', () => {
  const initial = { ...defaultScenario(), start: Date.parse('2026-01-01T00:00:00Z'), end: Date.parse('2028-01-01T00:00:00Z'), time: Date.parse('2027-01-01T00:00:00Z') };
  scenario.set(initial);
  assert.throws(() => applyBrowserRequest({ ...request, method: 'set_simulation_time', time: '2029-01-01T00:00:00Z' }), /FROM\/TO/);
  assert.throws(() => applyBrowserRequest({ ...request, method: 'set_simulation_time', time: '2027-02-30T00:00:00Z' }), /Invalid/);
  assert.throws(() => applyBrowserRequest({ ...request, expiresAt: Date.now() - 1, method: 'set_simulation_time', time: '2026-06-01T00:00:00Z' }), /expired/);
  assert.deepEqual(get(scenario), initial);
});

test('reload verification checks date, cameras, view settings, layout and active view', () => {
  const before = defaultScenario();
  const after = structuredClone(before);
  assert.deepEqual(compareReload(before, after), { time: new Date(before.time).toISOString(), views: 1, datePreserved: true, camerasAndViewsPreserved: true });
  after.time += 1000;
  assert.equal(compareReload(before, after).datePreserved, false);
  after.views[0].camera[0] += 1;
  assert.equal(compareReload(before, after).camerasAndViewsPreserved, false);
});
