/// <reference lib="webworker" />
import { nextClosestApproach } from '../src/lib/closest-approach';
import type { Ephemeris } from '../src/lib/ephemeris';
let data: Promise<Ephemeris> | undefined;
self.onmessage = async (event: MessageEvent<{ id: string; after: number; until: number; deadline: number }>) => {
  const { id, after, until, deadline } = event.data;
  try {
    if (!Number.isFinite(deadline) || Date.now() >= deadline) throw Error('Investigation expired.');
    data ??= fetch('/data/ephemeris.json').then(r => { if (!r.ok) throw Error('Orbital data unavailable.'); return r.json(); });
    const ephemeris = await data;
    if (Date.now() >= deadline) throw Error('Investigation expired.');
    const result = nextClosestApproach(ephemeris, 'earth', 'mars', after, until);
    if (Date.now() >= deadline) throw Error('Investigation expired.');
    self.postMessage({ id, result });
  } catch { data = undefined; self.postMessage({ id, error: 'Investigation unavailable or expired; no state changed.' }); }
};
