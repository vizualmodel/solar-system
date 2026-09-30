import { MIN_TIME, MAX_TIME } from '../lib/scenario';

export const BRIDGE_ORIGIN = 'http://127.0.0.1:5173';
export const BRIDGE_URL = 'ws://127.0.0.1:5174/bridge';
export const BRIDGE_PROTOCOL = 'solar-bridge';
export interface SimulationState { time: string; playing: boolean }
export type BridgeOperation = { method: 'get_simulation_state' } | { method: 'set_simulation_time'; time: string };
export type BridgeRequest = BridgeOperation & { id: string; expiresAt: number };

// Date.parse alone silently normalizes impossible calendar dates, such as Feb 30.
export function parseSimulationTime(value: unknown): number {
  if (typeof value !== 'string') throw new Error('Time must be an ISO timestamp with an explicit timezone.');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error('Use YYYY-MM-DDTHH:mm:ss[.SSS]Z or an explicit ±HH:mm timezone.');
  const [, year, month, day, hour, minute, second, , zone] = match;
  const days = new Date(Date.UTC(+year, +month, 0)).getUTCDate();
  if (+month < 1 || +month > 12 || +day < 1 || +day > days || +hour > 23 || +minute > 59 || +second > 59 ||
      (zone !== 'Z' && (+zone.slice(1, 3) > 23 || +zone.slice(4, 6) > 59))) {
    throw new Error('Invalid calendar date, clock time, or timezone offset.');
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Invalid timestamp.');
  if (time < MIN_TIME || time > MAX_TIME) throw new Error('Time is outside the supported interval: 2025-01-01T00:00:00Z through 2031-01-01T00:00:00Z (inclusive).');
  return time;
}

export function isSimulationState(value: unknown): value is SimulationState {
  if (!value || typeof value !== 'object') return false;
  const state = value as SimulationState;
  try {
    return typeof state.playing === 'boolean' && new Date(parseSimulationTime(state.time)).toISOString() === state.time;
  } catch { return false; }
}
