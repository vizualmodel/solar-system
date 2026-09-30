import { byId } from './catalog';
import { DAY, distance, julianDate, relativePosition, type Ephemeris } from './ephemeris';
import { MIN_TIME, MAX_TIME } from './scenario';

export interface ClosestApproach { time: number; distanceAU: number }

// First future local minimum, not the absolute minimum over the whole interval.
// Six-hour slope brackets are sufficient for the eight planets' orbital timescales.
// Refinement is numerical precision within our approximate ephemeris, not accuracy against Horizons.
export function nextClosestApproach(data: Ephemeris, from: string, to: string, after: number, until: number): ClosestApproach | null {
  if (from === to || byId[from]?.parent !== 'sun' || byId[to]?.parent !== 'sun') throw new Error('Choose two different planets.');
  if (![after, until].every(Number.isFinite) || after < MIN_TIME || until > MAX_TIME || after > until) throw new Error('Invalid closest-approach search interval.');
  if (!data.bodies[from]?.length || !data.bodies[to]?.length) throw new Error('Planet orbital data is unavailable.');
  const separation = (time: number) => {
    const jd = julianDate(time);
    return distance(relativePosition(data.bodies[from], jd), relativePosition(data.bodies[to], jd));
  };
  const slope = (time: number) => separation(Math.min(MAX_TIME, time + 30_000)) - separation(Math.max(MIN_TIME, time - 30_000));
  // Skip the current event (one-minute numerical tolerance) on repeated clicks.
  let left = after + 60_000;
  if (left >= until) return null;
  let before = slope(left);
  while (left < until) {
    const right = Math.min(until, left + DAY / 4);
    const afterSlope = slope(right);
    if (before < 0 && afterSlope >= 0) {
      let lo = left, hi = right;
      while (hi - lo > 1000) {
        const mid = (lo + hi) / 2;
        if (slope(mid) < 0) lo = mid; else hi = mid;
      }
      const time = Math.round((lo + hi) / 2);
      // The dataset edge alone cannot establish an interior closest approach.
      if (time < MAX_TIME && time <= until) return { time, distanceAU: separation(time) };
    }
    left = right;
    before = afterSlope;
  }
  return null;
}
