export type ScrubModifiers = { ctrlKey: boolean; shiftKey: boolean };
export type ScrubDrag = { x: number; time: number };

export function scrubDivisor({ ctrlKey, shiftKey }: ScrubModifiers): number {
  return ctrlKey ? (shiftKey ? 100 : 10) : 1;
}

export function beginScrub(x: number, time: number, start: number, end: number,
  left: number, width: number, modifiers: ScrubModifiers): ScrubDrag {
  const selected = scrubDivisor(modifiers) === 1
    ? start + (x - left) / Math.max(1, width) * (end - start) : time;
  return { x, time: Math.max(start, Math.min(end, selected)) };
}

export function moveScrub(drag: ScrubDrag, x: number, start: number, end: number,
  width: number, modifiers: ScrubModifiers): ScrubDrag {
  const time = drag.time + (x - drag.x) / Math.max(1, width) * (end - start) / scrubDivisor(modifiers);
  return { x, time: Math.max(start, Math.min(end, time)) };
}
