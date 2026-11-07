import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSimulationTime } from '../companion/simulation-protocol';
const state = { time: '2027-01-01T00:00:00.000Z' };

test('timestamps require timezone, validate calendar, and normalize offsets', () => {
  assert.equal(parseSimulationTime('2027-01-01T01:00:00+01:00'), Date.parse(state.time));
  assert.equal(parseSimulationTime('2028-02-29T00:00:00Z'), Date.parse('2028-02-29T00:00:00Z'));
  for (const value of ['2027-01-01', '2027-01-01T00:00:00', '2027-02-29T00:00:00Z', '2028-02-30T00:00:00Z',
    '2027-04-31T00:00:00Z', '2027-13-01T00:00:00Z', '2027-01-01T24:00:00Z', '2027-01-01T00:00:60Z',
    '2027-01-01T00:00:00+24:00', '2027-01-01T00:00:00+01:60', '', 'garbage', null]) {
    assert.throws(() => parseSimulationTime(value), Error, String(value));
  }
});

test('supported interval is inclusive and checked after timezone conversion', () => {
  for (const value of ['1990-01-01T00:00:00Z', '2031-01-01T00:00:00Z']) assert.ok(Number.isFinite(parseSimulationTime(value)));
  for (const value of ['1989-12-31T23:59:59.999Z', '2031-01-01T00:00:00.001Z', '1990-01-01T00:00:00+01:00']) {
    assert.throws(() => parseSimulationTime(value), /supported interval/);
  }
});
