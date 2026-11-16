import {missionReady,missionViewStatus} from '../src/lib/mission-ui';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { createModelDevelopmentClient } from '@vizualmodel/model-development/browser';
import { simulationState } from '../src/lib/store';
import { validateSimulationState, STORAGE_KEY } from '../src/lib/simulation-state';
import { applyBrowserRequest } from './browser-adapter';
import { snapshot, assertRestored, restorationReceipt } from './state';
import { renderedViews, failedViews, requireVisibleForActivation } from './readiness';
import { positions, type Ephemeris } from '../src/lib/ephemeris';
import { withSatellitePositions } from '../src/lib/satellites';
let orbitalData:Promise<Ephemeris>|undefined;
import {waitForModelReady as ready} from '../src/model-integration/readiness';
import {executeModelControl} from '../src/model-integration/control-adapter';

export const client = createModelDevelopmentClient({
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
 execute:executeModelControl
}, { bootstrapGlobal: '__SOLAR_COMPANION__', protocol: 'solar-companion', storagePrefix: 'solar-companion' });
export const { panel, action, start: startClient } = client;
