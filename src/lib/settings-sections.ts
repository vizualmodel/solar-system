import { writable } from 'svelte/store';

// Panel navigation is shared across mounts, independent of simulation/simulationState state.
export const settingsSections=writable<Record<string,boolean>>({});
export function setSectionOpen(id:string,open:boolean){settingsSections.update(sections=>({...sections,[id]:open}));}
