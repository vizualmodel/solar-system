<script lang="ts">
 import { onMount } from 'svelte';
 import { Columns2,Rows2,X,Crosshair } from 'lucide-svelte';
 import { scenario,status,updateView,split,close } from '../lib/store';
 import { byId } from '../lib/catalog';
 import { SolarRenderer } from '../lib/renderer';
 import { focus } from '../lib/focus';
 import type { Ephemeris,Vec3 } from '../lib/ephemeris';
 let { id,data,positions }: {id:string;data:Ephemeris;positions:Record<string,Vec3>}=$props();
 let host:HTMLDivElement;let renderer:SolarRenderer|undefined;let error=$state('');
 const view=$derived($scenario.views.find(v=>v.id===id)!);
 onMount(()=>{try{renderer=new SolarRenderer(host,view,data,(camera,target)=>updateView(id,{camera,target}),body=>focus(id,body),message=>status.set(message));renderer.draw($scenario.time,positions);}catch(e){error='3D rendering could not start. This browser needs WebGL 2 support.';console.error(e);}return ()=>renderer?.dispose();});
 $effect(()=>{const v=view;if(renderer)renderer.configure(v);});
 // OrbitControls damping continues while the shared simulation is paused.
 onMount(()=>{let frame:number;const draw=()=>{renderer?.draw($scenario.time,positions);frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);return ()=>cancelAnimationFrame(frame);});
</script>
<section class:active={$scenario.active===id} class="viewport" onpointerdown={()=>scenario.update(s=>({...s,active:id}))} aria-label={`${byId[view.focus].name} view`}>
 <div class="viewport-toolbar"><span class="view-index">{String($scenario.views.findIndex(v=>v.id===id)+1).padStart(2,'0')}</span><span>{byId[view.focus].name==='Sun'?'Solar system':byId[view.focus].name}</span><span class="view-mode">{view.follow?'TRACKING':'FIXED'}</span><div class="spacer"></div><button title="Reset camera" aria-label="Reset camera" onclick={()=>focus(id,view.focus)}><Crosshair size={15}/></button><button title="Split side by side" aria-label="Split side by side" onclick={()=>split(id,'row')}><Columns2 size={15}/></button><button title="Split above and below" aria-label="Split above and below" onclick={()=>split(id,'column')}><Rows2 size={15}/></button><button title="Close view" aria-label="Close view" disabled={$scenario.views.length===1} onclick={()=>close(id)}><X size={15}/></button></div>
 <div class="space-canvas" bind:this={host}></div>
 {#if error}<div class="render-error">{error}</div>{/if}
 <div class="view-caption"><span class="live-dot"></span> {view.size===1?'True body scale':`Bodies enlarged ×${view.size}`}<span>·</span>{view.moonScale===1?'True orbital distances':`Moon distances ×${view.moonScale}`}</div>
 <div class="axis-key"><span>Y</span><i></i><b>X</b><small>J2000 ECLIPTIC</small></div>
</section>
