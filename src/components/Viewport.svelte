<script lang="ts">
 import { renderedViews, failedViews } from '../../companion/readiness';
 import { onMount } from 'svelte';
 import { Columns2,Rows2,X,Crosshair } from 'lucide-svelte';
 import { simulationState,status,updateView,split,close } from '../lib/store';
 import { byId } from '../lib/catalog';
 import { SolarRenderer } from '../lib/renderer';
 import { focus } from '../lib/focus';
 import { satelliteAccuracy } from '../lib/satellites';
 import PopulationCard from './PopulationCard.svelte';
 import {population,populationMatches,populationIllustrative} from '../lib/population';
 import type { Ephemeris,Vec3 } from '../lib/ephemeris';
 let { id,data,positions }: {id:string;data:Ephemeris;positions:Record<string,Vec3>}=$props();
 let host:HTMLDivElement;let renderer:SolarRenderer|undefined;let error=$state('');
 const view=$derived($simulationState.views.find(v=>v.id===id)!);
 const focusId=$derived(view.satelliteFocus??view.focus);
 const illustrativePopulation=$derived((view.populationGroups?.length??0)>0&&population.some(row=>populationMatches(row,view.populationGroups??[])&&populationIllustrative(row,$simulationState.time)));
 onMount(()=>{const capture=()=>renderer?.captureCamera();window.addEventListener('solar:save-cameras',capture);return ()=>window.removeEventListener('solar:save-cameras',capture);});
 onMount(()=>{try{renderer=new SolarRenderer(host,view,data,(camera,target,patch)=>updateView(id,{camera,target,...patch}),body=>focus(id,body),message=>status.set(message));renderer.draw($simulationState.time,positions);renderedViews.add(id);}catch(e){failedViews.add(id);error='3D rendering could not start. This browser needs WebGL 2 support.';console.error(e);}return ()=>{renderedViews.delete(id);failedViews.delete(id);renderer?.dispose();};});
 $effect(()=>{const v=view;if(renderer)renderer.configure(v);});
 // OrbitControls damping continues while the shared simulation is paused.
 onMount(()=>{let frame:number;const draw=()=>{renderer?.draw($simulationState.time,positions);frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);return ()=>cancelAnimationFrame(frame);});
</script>
<section class:active={$simulationState.active===id} class="viewport" onpointerdown={()=>simulationState.update(s=>({...s,active:id}))} aria-label={`${byId[focusId].name} view`}>
 <div class="viewport-toolbar"><span class="view-index">{String($simulationState.views.findIndex(v=>v.id===id)+1).padStart(2,'0')}</span><span>{byId[focusId].name==='Sun'?'Solar system':byId[focusId].name}</span><span class="view-mode">{view.follow?'TRACKING':'FIXED'}</span><div class="spacer"></div><button title="Reset camera" aria-label="Reset camera" onclick={()=>focus(id,focusId)}><Crosshair size={15}/></button><button title="Split side by side" aria-label="Split side by side" onclick={()=>split(id,'row')}><Columns2 size={15}/></button><button title="Split above and below" aria-label="Split above and below" onclick={()=>split(id,'column')}><Rows2 size={15}/></button><button title="Close view" aria-label="Close view" disabled={$simulationState.views.length===1} onclick={()=>close(id)}><X size={15}/></button></div>
 <div class="space-canvas" bind:this={host}></div>
 <PopulationCard {view}/>
 {#if illustrativePopulation}<div class="population-notice">Satellite population: illustrative orbits · cached epochs differ from this date by more than 3 days.</div>{/if}
 {#if error}<div class="render-error">{error}</div>{/if}
 {#if view.satelliteFocus&&!positions[view.satelliteFocus]}<div class="satellite-notice">{byId[view.satelliteFocus].name} is not yet in orbit at this date.</div>
 {:else if view.satelliteFocus&&satelliteAccuracy($simulationState.time,view.satelliteFocus)==='illustrative'}<div class="satellite-notice">Illustrative orbit · historical position and spacecraft configuration are not reconstructed.</div>{/if}
 <div class="view-caption"><span class="live-dot"></span> {view.size===1?'True body scale':`Bodies enlarged ×${view.size}`}<span>·</span>{view.moonScale===1?'True orbital distances':`Moon distances ×${view.moonScale}`}</div>
 <div class="axis-key"><span>Y</span><i></i><b>X</b><small>J2000 ECLIPTIC</small></div>
</section>

<style>
 .population-notice{position:absolute;left:16px;bottom:55px;max-width:calc(100% - 32px);font-size:11px;color:var(--gold);pointer-events:none;}
 .satellite-notice{position:absolute;top:54px;left:16px;right:16px;color:var(--gold);font-size:11px;pointer-events:none;}
</style>
