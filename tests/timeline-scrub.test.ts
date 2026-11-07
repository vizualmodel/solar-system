import test from 'node:test';
import assert from 'node:assert/strict';
import { beginScrub, moveScrub, scrubDivisor } from '../src/lib/timeline-scrub';

const normal = { ctrlKey: false, shiftKey: false };
const fine = { ctrlKey: true, shiftKey: false };
const extraFine = { ctrlKey: true, shiftKey: true };
const start = Date.parse('2025-01-01T00:00:00Z');
const end = Date.parse('2030-01-01T00:00:00Z');
const time = (start + end) / 2;
const width = 1000;

test('normal clicks select a position; fine clicks anchor at the current time', () => {
  assert.equal(beginScrub(260, time, start, end, 10, width, normal).time, start + (end - start) / 4);
  for (const modifiers of [fine, extraFine]) {
    assert.equal(beginScrub(260, time, start, end, 10, width, modifiers).time, time);
  }
  assert.equal(scrubDivisor({ ctrlKey: false, shiftKey: true }), 1);
});

test('multi-year drags use exactly 1/10 and 1/100 sensitivity in either direction', () => {
  for (const modifiers of [normal, fine, extraFine]) {
    const drag = { x: 500, time };
    for (const dx of [-100, 100]) {
      const moved = moveScrub(drag, drag.x + dx, start, end, width, modifiers);
      assert.equal(moved.time, time + dx / width * (end - start) / scrubDivisor(modifiers));
    }
  }
});

test('changing modifiers mid-drag has no jump, and subsequent motion uses the new sensitivity', () => {
  let drag = { x: 500, time };
  for (const modifiers of [normal, fine, extraFine, fine, normal]) {
    assert.deepEqual(moveScrub(drag, drag.x, start, end, width, modifiers), drag);
    const moved = moveScrub(drag, drag.x + 10, start, end, width, modifiers);
    assert.equal(moved.time, drag.time + 10 / width * (end - start) / scrubDivisor(modifiers));
    drag = moved;
  }
});

test('dragging clamps to both limits and reverses immediately after overshoot', () => {
  for (const modifiers of [normal, fine, extraFine]) {
    const upper = moveScrub({ x: 500, time: end - 1 }, 10000, start, end, width, modifiers);
    assert.equal(upper.time, end);
    assert.ok(moveScrub(upper, upper.x - 1, start, end, width, modifiers).time < end);
    const lower = moveScrub({ x: 500, time: start + 1 }, -10000, start, end, width, modifiers);
    assert.equal(lower.time, start);
    assert.ok(moveScrub(lower, lower.x + 1, start, end, width, modifiers).time > start);
  }
});

test('fine motion retains sub-millisecond increments until the final time is selected', () => {
  let drag = { x: 0, time: 500 };
  for (let x = 1; x <= 100; x++) drag = moveScrub(drag, x, 0, 1000, 1000, extraFine);
  assert.equal(Math.round(drag.time), 501);
});
