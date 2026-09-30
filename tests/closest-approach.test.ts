import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextClosestApproach } from '../src/lib/closest-approach';
import { DAY, julianDate, positions, distance, type Ephemeris, type Elements } from '../src/lib/ephemeris';
import { MIN_TIME, MAX_TIME } from '../src/lib/scenario';

const actual = JSON.parse(readFileSync(new URL('../public/data/ephemeris.json', import.meta.url), 'utf8')) as Ephemeris;
function circular(): Ephemeris {
  const rows = (period: number, radius: number): Elements[] => [MIN_TIME, MAX_TIME].map(time =>
    [julianDate(time), 0, 0, 0, 0, 360 / period, (time - MIN_TIME) / DAY * 360 / period, radius]);
  return { start: new Date(MIN_TIME).toISOString(), end: new Date(MAX_TIME).toISOString(), bodies: { mercury: rows(88, .4), earth: rows(365, 1) } };
}

test('finds the next analytic conjunction, including a minimum within the first sampling interval', () => {
  const data = circular();
  const period = DAY / (1 / 88 - 1 / 365);
  for (const after of [MIN_TIME + DAY, MIN_TIME + period - 60 * 60_000]) {
    const result = nextClosestApproach(data, 'mercury', 'earth', after, MAX_TIME)!;
    assert.ok(Math.abs(result.time - (MIN_TIME + period)) < 2000);
    assert.ok(Math.abs(result.distanceAU - .6) < 1e-10);
  }
});

test('repeated jumps move to successive events; reversed planet selection agrees', () => {
  const data = circular(), period = DAY / (1 / 88 - 1 / 365);
  const first = nextClosestApproach(data, 'mercury', 'earth', MIN_TIME, MAX_TIME)!;
  const second = nextClosestApproach(data, 'earth', 'mercury', first.time, MAX_TIME)!;
  assert.ok(Math.abs(second.time - first.time - period) < 2000);
  assert.deepEqual(first, nextClosestApproach(data, 'earth', 'mercury', MIN_TIME, MAX_TIME));
});

test('a descending range endpoint is not incorrectly reported as an approach', () => {
  const data = circular(), period = DAY / (1 / 88 - 1 / 365);
  assert.equal(nextClosestApproach(data, 'earth', 'mercury', MIN_TIME + period * .6, MIN_TIME + period * .9), null);
  assert.equal(nextClosestApproach(data, 'earth', 'mercury', MAX_TIME, MAX_TIME), null);
});

test('same body, moons, unknown bodies, and invalid intervals are rejected', () => {
  for (const [a, b] of [['earth', 'earth'], ['moon', 'earth'], ['unknown', 'earth'], ['sun', 'mars']]) {
    assert.throws(() => nextClosestApproach(actual, a, b, MIN_TIME, MAX_TIME), /different planets/);
  }
  for (const [a, b] of [[NaN, MAX_TIME], [MIN_TIME - 1, MAX_TIME], [MIN_TIME, MAX_TIME + 1], [MAX_TIME, MIN_TIME]]) {
    assert.throws(() => nextClosestApproach(actual, 'earth', 'mars', a, b), /interval/);
  }
});

test('real dataset results are local minima and agree with an independent hourly scan', () => {
  for (const [a, b] of [['earth', 'mars'], ['mercury', 'venus'], ['jupiter', 'saturn']]) {
    const after = Date.parse('2026-01-01T00:00:00Z');
    const result = nextClosestApproach(actual, a, b, after, MAX_TIME);
    const separation = (time: number) => { const p = positions(actual, time); return distance(p[a], p[b]); };
    let sampledMinimum: number | undefined;
    for (let time = after + DAY / 24; time < MAX_TIME - DAY / 24; time += DAY / 24) {
      if (separation(time) < separation(time - DAY / 24) && separation(time) < separation(time + DAY / 24)) { sampledMinimum = time; break; }
    }
    if (!sampledMinimum) { assert.equal(result, null); continue; }
    assert.ok(result);
    assert.ok(Math.abs(result.time - sampledMinimum) <= DAY / 24, `${a}/${b}`);
    assert.ok(separation(result.time) < separation(result.time - 600_000));
    assert.ok(separation(result.time) < separation(result.time + 600_000));
    assert.equal(result.distanceAU, separation(result.time));
  }
});
