import {writable,derived} from 'svelte/store';
import {simulationState} from './store';
import {missionViews} from './mission-views';
export const missionViewStatus=writable<Record<string,'loading'|'ready'|'error'>>({});
export const missionReady=derived([simulationState,missionViewStatus],([$state,$status])=>!!$state.mission&&missionViews($state.mission).every(v=>$status[v.id]==='ready'));
