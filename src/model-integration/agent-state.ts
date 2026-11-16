import {writable} from 'svelte/store';
export const agentState=writable({connected:false,ready:false});
