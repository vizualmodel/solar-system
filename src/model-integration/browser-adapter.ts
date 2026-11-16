import { get } from 'svelte/store';
import { tick } from 'svelte';
import { simulationState } from '../lib/store';
import { applyBrowserRequest } from '../../model-service/browser-adapter';
import { createModelAdapter } from './adapter';
import type { ClosestApproach } from '../lib/closest-approach';
import type {ModelRequest,ModelTarget} from '@vizualmodel/bridge-model-client';
import {controlSchemas} from '../../model-service/control-schema';
import {executeModelControl} from './control-adapter';
import {operateScenario} from './scenarios';

// Constructed only after explicit tab approval. Uses the existing model dispatcher.
export function createBrowserActionAdapter(modelBuild: string, dataVersion: string) {
  let revision = 0, worker: Worker | undefined, pending = false, cancel: (() => void) | undefined, active = true;
  const assertActive = () => { if (!active) throw Error('Agent access disconnected; no new model command applied.'); };
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
  return {execute(request:ModelRequest,target:ModelTarget){
    assertActive();
    if(request.action==='scenarios'||Object.hasOwn(controlSchemas,request.action)){
      if(request.protocol!==1||request.sessionId!==target.sessionId||request.generation!==target.generation||!target.read||request.action!=='get_simulation_state'&&!target.operate||!Number.isFinite(request.deadline)||request.deadline<=Date.now())throw Error('Invalid, expired or unauthorized model request.');
      return request.action==='scenarios'?operateScenario(request.inputs):executeModelControl(request.action,request.inputs,{id:request.id,expiresAt:request.deadline},assertActive);
    }
    return adapter.execute(request as import('./adapter').ModelRequest,target);
  },dispose() { active = false; unsubscribe(); cancel?.(); worker?.terminate(); worker = undefined; } };
}
