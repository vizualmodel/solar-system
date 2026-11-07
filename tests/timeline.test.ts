import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { get } from 'svelte/store';
import { defaultSimulationState } from '../src/lib/simulation-state';
import { beginScrub, moveScrub } from '../src/lib/timeline-scrub';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '' } });
const { simulationState, command, split } = await import('../src/lib/store');

test('current-time icon follows the UTC picker, with accessible name and tooltip, outside playback', () => {
  const source = readFileSync(new URL('../src/components/Timeline.svelte', import.meta.url), 'utf8');
  const heading = source.slice(source.indexOf('<div class="time-heading">'), source.indexOf('<div class="playback">'));
  assert.match(heading, /<input class="current-time"[^\n]*?\/><button class="current-time-action"/);
  assert.match(heading, /title="Go to current time and pause" aria-label="Go to current time and pause" onclick=\{\(\)=>command\(\{type:'now'\}\)\}><ClockArrowUp size=\{17\} aria-hidden="true"\/><\/button>/);
  assert.equal((source.match(/command\(\{type:'now'\}\)/g) ?? []).length, 1);
  assert.doesNotMatch(source.slice(source.indexOf('<div class="playback">')), /type:'now'/);
  assert.match(heading, /<\/button><\/div><span class="local-time">Local <time datetime=\{new Date\(\$simulationState.time\).toISOString\(\)\}>\{localTimelineTime\(\$simulationState.time\)\}<\/time>/);
});

test('local timeline time follows the user timezone, DST, fractional offsets and local date boundaries', () => {
  const formatter = new URL('../src/lib/timeline-time.ts', import.meta.url).href;
  const instants = ['2026-01-15T12:34:00Z', '2026-07-15T12:34:00Z', '2026-01-15T23:45:00Z'];
  for (const [timezone, expected] of [
    ['Europe/Brussels', ['15 Jan 2026, 13:34 GMT+1', '15 Jul 2026, 14:34 GMT+2', '16 Jan 2026, 00:45 GMT+1']],
    ['Asia/Kolkata', ['15 Jan 2026, 18:04 GMT+5:30', '15 Jul 2026, 18:04 GMT+5:30', '16 Jan 2026, 05:15 GMT+5:30']],
    ['UTC', ['15 Jan 2026, 12:34 GMT', '15 Jul 2026, 12:34 GMT', '15 Jan 2026, 23:45 GMT']],
  ] as const) {
    const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
      `import { localTimelineTime } from ${JSON.stringify(formatter)}; console.log(JSON.stringify(${JSON.stringify(instants)}.map(value => localTimelineTime(Date.parse(value)))));`,
    ], { env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
    // ICU versions differ in spelling the zero offset (GMT or GMT+0).
    assert.deepEqual(JSON.parse(output).map((value: string) => value.replace(/GMT\+0$/, 'GMT')), expected, timezone);
  }
});

for (const playing of [false, true]) {
  for (const range of ['includes now', 'before now', 'after now']) {
    test(`now selects the current instant and pauses: playing=${playing}, range ${range}`, t => {
      const now = Date.parse('2026-10-29T12:34:56.789Z');
      t.mock.timers.enable({ apis: ['Date'], now });
      const start = Date.parse(range === 'after now' ? '2027-01-01T00:00:00Z' : '2025-01-01T00:00:00Z');
      const end = Date.parse(range === 'before now' ? '2026-01-01T00:00:00Z' : '2028-01-01T00:00:00Z');
      simulationState.set({ ...defaultSimulationState(), name: 'Now test', playing, speed: -10, start, end, time: start });
      split(get(simulationState).active, 'row');
      const before = structuredClone(get(simulationState));

      command({ type: 'now' });

      assert.deepEqual(get(simulationState), {
        ...before, time: now, playing: false, start: Math.min(start, now), end: Math.max(end, now),
      });
      t.mock.timers.tick(5000);
      assert.equal(get(simulationState).time, now);
      assert.equal(get(simulationState).playing, false);
      command({ type: 'play', value: true });
      assert.equal(get(simulationState).playing, true);
      command({ type: 'now' });
      assert.equal(get(simulationState).time, now + 5000);
      assert.equal(get(simulationState).playing, false);
    });
  }
}

for (const playing of [false, true]) {
  test('timeline time commands preserve the complete simulationState, playing=' + playing, () => {
    simulationState.set({ ...defaultSimulationState(), name: 'Timeline test', playing, speed: -10,
      start: Date.parse('2027-03-01T00:00:00Z'), end: Date.parse('2027-04-01T00:00:00Z'),
      time: Date.parse('2027-03-28T00:30:12.345Z') });
    split(get(simulationState).active, 'row');
    const before = structuredClone(get(simulationState));
    const selectedTime = Date.parse('2027-03-15T12:34:56.789Z');
    for (const shiftKey of [false, true]) {
      const modifiers = { ctrlKey: true, shiftKey };
      const drag = beginScrub(500, before.time, before.start, before.end, 0, 1000, modifiers);
      const moved = moveScrub(drag, 530, before.start, before.end, 1000, modifiers);
      command({ type: 'time', value: Math.round(moved.time) });
      assert.deepEqual(get(simulationState), { ...before, time: Math.round(moved.time) });
    }
    for (const [value, expectedTime] of [
      [selectedTime, selectedTime],
      [before.start, before.start],
      [before.end, before.end],
      [before.start - 1000, before.start],
      [before.end + 1000, before.end],
    ]) {
      command({ type: 'time', value });
      assert.deepEqual(get(simulationState), { ...before, time: expectedTime });
    }
  });
}
