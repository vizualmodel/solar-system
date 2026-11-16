import { validateSimulationState, type SimulationState } from '../src/lib/simulation-state';
export interface Snapshot { schema: 1; simulationState: SimulationState }
export function snapshot(value: unknown): Snapshot {
  const s = value as Snapshot & { scenario?: SimulationState };
  if (s?.schema !== 1) throw new Error('Unsupported companion state schema; state was not reset.');
  if(s.simulationState&&s.scenario&&canonical(s.simulationState)!==canonical(s.scenario))throw new Error('Conflicting simulation state fields.');
  return { schema: 1, simulationState: validateSimulationState(s.simulationState ?? s.scenario) };
}
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function assertRestored(before: Snapshot, after: unknown) {
  before=snapshot(before);
  const actual = snapshot(after);
  const comparable = structuredClone(actual);
  // OrbitControls may round floating-point coordinates when restoring its pose.
  // Only camera/target coordinates allow this numerical tolerance; all other state is exact.
  for (const view of comparable.simulationState.views) {
    const expected = before.simulationState.views.find(v => v.id === view.id);
    if (!expected) continue;
    for (const key of ['camera', 'target'] as const) {
      if (view[key].every((value, index) => Math.abs(value - expected[key][index]) <= 1e-10 * Math.max(1, Math.abs(expected[key][index])))) view[key] = [...expected[key]];
    }
  }
  const missionCamera=comparable.simulationState.mission?.camera,expectedMissionCamera=before.simulationState.mission?.camera;
  if(missionCamera&&expectedMissionCamera)for(const key of ['position','target'] as const){if(missionCamera[key].every((value,index)=>Math.abs(value-expectedMissionCamera[key][index])<=1e-8*Math.max(1e-12,Math.abs(expectedMissionCamera[key][index]))))missionCamera[key]=[...expectedMissionCamera[key]];}
  for(const view of comparable.simulationState.mission?.views??[]){
   const expected=before.simulationState.mission?.views?.find(v=>v.id===view.id)?.camera;
   if(view.camera&&expected)for(const key of ['position','target','up'] as const){const a=view.camera[key],b=expected[key];if(a&&b&&a.every((n,i)=>Math.abs(n-b[i])<=1e-8*Math.max(1e-12,Math.abs(b[i]))))view.camera[key]=[...b];}
  }
  if (canonical(before) !== canonical(comparable)) throw new Error('State readback differs from captured state. Activation rejected.');
 return actual;
}

/** Older companion processes compare the captured field set exactly. Newly
 * defaulted display switches stay in the UI, but need not expand that receipt. */
export function restorationReceipt(captured:any,actual:Snapshot):any {
 const receipt=structuredClone(actual);
 for(const view of receipt.simulationState.views){
  const previous=(captured.simulationState??captured.scenario).views.find((v:SimulationState['views'][number])=>v.id===view.id);
  if(previous&&!Object.hasOwn(previous,'moonPenumbra')&&view.moonPenumbra===false)delete (view as Partial<typeof view>).moonPenumbra;
 }
 return Object.hasOwn(captured,'scenario')&&!Object.hasOwn(captured,'simulationState')?{schema:1,scenario:receipt.simulationState}:receipt;
}
