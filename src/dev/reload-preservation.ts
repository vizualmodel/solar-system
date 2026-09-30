import { get } from 'svelte/store';
import { scenario, command } from '../lib/store';
import { STORAGE_KEY, validateScenario, type Scenario } from '../lib/scenario';

const KEY = 'solar-observatory.dev-reload';
export interface ReloadVerification { time: string; views: number; datePreserved: boolean; camerasAndViewsPreserved: boolean }
let verification: ReloadVerification | undefined;
export const getReloadVerification = () => verification;

export function compareReload(before: Scenario, after: Scenario): ReloadVerification {
  return {
    time: new Date(after.time).toISOString(), views: after.views.length,
    datePreserved: before.time === after.time,
    camerasAndViewsPreserved: JSON.stringify(before.views) === JSON.stringify(after.views) &&
      JSON.stringify(before.layout) === JSON.stringify(after.layout) && before.active === after.active,
  };
}

export function installReloadPreservation(): () => void {
  // A one-use reload receipt: the actual scenario remains in the existing save slot.
  try {
    const receipt = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (receipt) verification = compareReload(validateScenario(JSON.parse(receipt)), validateScenario(get(scenario)));
  } catch { console.warn('[Local bridge] Could not verify the previous reload.'); }
  const prepare = () => {
    try {
      window.dispatchEvent(new Event('solar:save-cameras'));
      const before = validateScenario(get(scenario));
      // Freeze at the date we save. Normal session loading also restores paused.
      command({ type: 'play', value: false });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validateScenario(get(scenario))));
      sessionStorage.setItem(KEY, JSON.stringify(before));
    } catch { console.warn('[Local bridge] Reload state could not be saved.'); }
  };
  import.meta.hot?.on('vite:beforeFullReload', prepare);
  window.addEventListener('pagehide', prepare);
  return () => { import.meta.hot?.off('vite:beforeFullReload', prepare); window.removeEventListener('pagehide', prepare); };
}
