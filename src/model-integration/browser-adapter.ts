import { get } from 'svelte/store';
import { tick } from 'svelte';
import { simulationState } from '../lib/store';
import { applyBrowserRequest } from '../../companion/browser-adapter';
import { createModelAdapter } from './adapter';
import type { ClosestApproach } from '../lib/closest-approach';

// Constructed only after explicit tab approval. Uses the existing model dispatcher.
export function createBrowserActionAdapter(modelBuild: string, dataVersion: string) {
  let revision = 0, worker: Worker | undefined, pending = false, cancel: (() => void) | undefined;
  const unsubscribe = simulationState.subscribe(() => revision++);
  const adapter = createModelAdapter({ modelBuild, dataVersion,
    read: () => ({ state: get(simulationState), revision }),
    async apply(method, params, request) {
      window.dispatchEvent(new Event('solar:save-cameras'));
      applyBrowserRequest({ ...params, method, id: request.id, expiresAt: request.expiresAt });
      await tick();
    },
    investigate(after, until, deadline) {
      if (pending) return Promise.reject(Error('Investigation already running.'));
      pending = true;
      return new Promise<ClosestApproach | null>((resolve, reject) => {
        const id = crypto.randomUUID();
        worker ??= new Worker(new URL('./investigation.worker.ts', import.meta.url), { type: 'module' });
        const active = worker;
        const finish = () => { pending = false; cancel = undefined; clearTimeout(timeout); active.onmessage = null; active.onerror = null; };
        const timeout = setTimeout(() => { finish(); active.terminate(); worker = undefined; reject(Error('Investigation deadline expired; worker stopped.')); }, Math.max(1, deadline - Date.now()));
        active.onmessage = event => { if (event.data.id !== id) return; finish(); event.data.error ? reject(Error(event.data.error)) : resolve(event.data.result); };
        active.onerror = () => { finish(); active.terminate(); worker = undefined; reject(Error('Investigation worker unavailable.')); };
        cancel = () => { finish(); reject(Error('Agent access disconnected; investigation cancelled.')); };
        active.postMessage({ id, after, until, deadline });
      });
    },
  });
  return { ...adapter, dispose() { unsubscribe(); cancel?.(); worker?.terminate(); worker = undefined; } };
}
