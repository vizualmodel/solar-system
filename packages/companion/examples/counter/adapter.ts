import type { BrowserAdapter } from '../../src/contracts';
export function snapshot(value: any) { if (value?.schema !== 1 || !Number.isSafeInteger(value.count)) throw new Error('Invalid counter state'); return {schema: 1, count: value.count}; }
export const state = { snapshot, assertRestored(before: any, after: unknown) { if (snapshot(before).count !== snapshot(after).count) throw new Error('Counter not restored'); } };
export function counterAdapter(render: (count: number) => void = () => {}): BrowserAdapter {
 let count = 0;
 const loadSaved = (value: unknown) => { count = snapshot(value).count; render(count); };
 return { ready: async () => {}, capture: () => ({schema:1,count}), loadSaved,
 captureForActivation() {return this.capture();}, restore(value) {loadSaved(value);return this.capture();},
 execute(method, params) { if (method==='increment') { if (!Number.isSafeInteger(params.amount) || Math.abs(params.amount)>100) throw new Error('Invalid amount'); count += params.amount; render(count); } else if(method!=='get_count') throw new Error('Unknown counter tool'); return {count}; }
 };
}
