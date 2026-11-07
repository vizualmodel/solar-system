import type { StatePolicy } from './contracts';

export interface ActivationHost {
  capture(): Promise<unknown>;
  select(build: any, state: any): Promise<void>;
  reload(): void;
  restore(build: any, state: any): Promise<unknown>;
  commit(build: any, previous: any): Promise<void>;
}
/** Build rollback deliberately never touches source files or Git. */
export async function activate(host: ActivationHost, candidate: any, previous: any, policy: StatePolicy) {
  const { snapshot, assertRestored } = policy;
  const state = snapshot(await host.capture());
  try {
    await host.select(candidate, state); host.reload();
    assertRestored(state, await host.restore(candidate, state));
    await host.commit(candidate, previous);
    return { activated: candidate.id, restored: true, previous: previous.id };
  } catch (error) {
    try {
      await host.select(previous, state); host.reload();
      assertRestored(state, await host.restore(previous, state));
      await host.commit(previous, previous);
    } catch (recovery) { throw new Error(`Activation failed: ${error}. Previous build selected but recovery needs attention: ${recovery}. Captured state and source edits retained.`); }
    throw new Error(`Activation failed: ${error}. Previous build restored with captured state; source edits retained.`);
  }
}
