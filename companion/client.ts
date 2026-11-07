import {missionReady,missionViewStatus} from '../src/lib/mission-ui';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { createCompanionClient } from '@vizualmodel/companion/browser';
import { simulationState } from '../src/lib/store';
import { validateSimulationState, STORAGE_KEY } from '../src/lib/simulation-state';
import { applyBrowserRequest } from './browser-adapter';
import { snapshot, assertRestored, restorationReceipt } from './state';
import { renderedViews, failedViews, requireVisibleForActivation } from './readiness';
import { positions, type Ephemeris } from '../src/lib/ephemeris';
import { withSatellitePositions } from '../src/lib/satellites';
let orbitalData:Promise<Ephemeris>|undefined;
async function ready() {
  const started = Date.now();
  const deadline = started + 60000;
  while (Date.now() < deadline) {
    if (get(simulationState).mission ? Object.values(get(missionViewStatus)).includes('error') : failedViews.size) throw new Error('A simulation view failed to render.');
    if (get(simulationState).mission ? get(missionReady) : get(simulationState).views.every(v => renderedViews.has(v.id))) { await tick(); if (Date.now() - started > 1000) console.info(`Solar renderer readiness: ${Date.now() - started} ms; visibility=${document.visibilityState}.`); return; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Simulation readiness timed out after 60 seconds; visibility=${document.visibilityState}; rendered=${renderedViews.size}; expected=${get(simulationState).views.length}. No readiness acknowledgement was sent.`);
}

export const client = createCompanionClient({
 ready,
 capture() { window.dispatchEvent(new Event('solar:save-cameras')); return snapshot({ schema: 1, simulationState: get(simulationState) }); },
 preserve(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(state).simulationState)); },
 loadSaved(state) { simulationState.set(snapshot(state).simulationState); },
 captureForActivation() { requireVisibleForActivation(document.visibilityState); const state = this.capture(); simulationState.update(s => ({ ...s, playing: false,...(s.mission?{mission:{...s.mission,playing:false}}:{}) })); return state; },
 async restore(value) {
  const expected = snapshot(value); simulationState.set({ ...expected.simulationState, playing: false,...(expected.simulationState.mission?{mission:{...expected.simulationState.mission,playing:false}}:{}) });
  await tick(); await ready(); window.dispatchEvent(new Event('solar:save-cameras'));
  const observed=get(simulationState);
  const actual = snapshot({ schema: 1, simulationState: { ...observed, playing: expected.simulationState.playing,...(observed.mission?{mission:{...observed.mission,playing:expected.simulationState.mission!.playing}}:{}) } });
  assertRestored(expected, actual); simulationState.set(actual.simulationState); return restorationReceipt(value as any, actual);
 },
 async execute(method, params, request) {
  window.dispatchEvent(new Event('solar:save-cameras'));
  let context = {};
  if(method==='camera'||method==='charts'&&params?.settings?.nextClosestApproach){
   orbitalData??=fetch('/data/ephemeris.json').then(r=>{if(!r.ok)throw new Error('Orbital data unavailable.');return r.json();}).catch(e=>{orbitalData=undefined;throw e;});
   const data=await orbitalData;context={data,positions:withSatellitePositions(positions(data,get(simulationState).time),get(simulationState).time)};
  }
  const result=applyBrowserRequest({ ...params, id:request.id, expiresAt:request.expiresAt, method } as any,context);
  await tick();await ready();
  return { ...result, viewCount: get(simulationState).views.length,
   ...(params?.detail === 'full' ? { state: snapshot({ schema: 1, simulationState: get(simulationState) }) } : {}) };
 }
}, { bootstrapGlobal: '__SOLAR_COMPANION__', protocol: 'solar-companion', storagePrefix: 'solar-companion' });
export const { panel, action, start: startClient } = client;
