import { writable } from 'svelte/store';
export const workspaceUi = writable({settings:true,charts:false,companion:false,about:false,tab:'scene' as 'scene'|'camera',from:'earth',to:'mars'});
