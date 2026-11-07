<script lang="ts">
 import { Camera } from 'lucide-svelte';
 import { simulationState,updateView } from '../lib/store';
 import { focus } from '../lib/focus';
 import { satellites,type SatelliteId } from '../lib/catalog';
 import { satelliteAvailable,satelliteMagnification } from '../lib/satellites';
 import { sharedSatelliteSize,satelliteSizePatch } from '../lib/satellite-settings';
 import ObjectInfoButton from './ObjectInfoButton.svelte';
 import type { ViewConfig } from '../lib/simulation-state';
 import {population,populationGroups,populationLabels,populationCounts,populationMatches,populationFetchedAt} from '../lib/population';
 let {view}:{view:ViewConfig}=$props();
 const size=$derived(sharedSatelliteSize(view));
 const enabled=$derived(view.populationGroups??[]);
 const count=$derived(population.filter(row=>populationMatches(row,enabled)).length);
 let search=$state('');
 const matches=$derived(search.trim()?population.filter(row=>populationMatches(row,enabled)&&(row.name.toLowerCase().includes(search.trim().toLowerCase())||String(row.id).includes(search.trim()))).slice(0,8):[]);
 function toggleGroup(group:typeof populationGroups[number]){updateView(view.id,{populationGroups:enabled.includes(group)?enabled.filter(g=>g!==group):[...enabled,group],populationSelection:null});}
 function toggle(id:string){const selected=view.satellites??[];updateView(view.id,{satellites:selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]});}
</script>

<h4>Satellite populations</h4>
{#each populationGroups as group}
 <div class="body-row"><label><input type="checkbox" checked={enabled.includes(group)} onchange={()=>toggleGroup(group)}/>{populationLabels[group]} <strong>{populationCounts[group].toLocaleString('en-GB')}</strong></label></div>
{/each}
<p class="hint">{count.toLocaleString('en-GB')} unique satellites enabled · {population.length.toLocaleString('en-GB')} in cache. Filters combine; Starlink is included in LEO and GPS in navigation.</p>
{#if enabled.length}
 <label class="search-label" for={`satellite-search-${view.id}`}>Find an enabled satellite</label>
 <input class="satellite-search" id={`satellite-search-${view.id}`} type="search" placeholder="Name or NORAD ID" bind:value={search}/>
 {#if search.trim()}
  <div class="search-results">{#each matches as row}<button onclick={()=>updateView(view.id,{populationSelection:row.id})}>{row.name} <small>#{row.id}</small></button>{:else}<p class="hint">No matching satellite in the enabled layers.</p>{/each}</div>
 {/if}
{/if}
<p class="hint">CelesTrak OMM cache · {new Date(populationFetchedAt).toISOString().slice(0,10)}. LEO: active catalogue, apogee ≤2,000 km. Navigation: GNSS orbits between 2,000 and 35,786 km. Dots use physical distances. Click a dot for its orbit and details. Beyond ±3 days of its epoch, the orbit is illustrative, including satellites not yet launched at the displayed date.</p>
<h4>Detailed spacecraft</h4>

{#each satellites as satellite}
 {@const id=satellite.id as SatelliteId}
 {@const available=satelliteAvailable($simulationState.time,id)}
 <div class="satellite-entry">
  <div class="body-row"><label><input type="checkbox" checked={(view.satellites??[]).includes(id)} onchange={()=>toggle(id)}/><span class="planet-swatch" style:background={satellite.color}></span>{satellite.name}</label><div class="object-actions"><button title={`Close-up of ${satellite.name}`} aria-label={`Close-up of ${satellite.name}`} disabled={!available} onclick={()=>focus(view.id,id)}><Camera size={13}/></button><ObjectInfoButton id={satellite.id}/></div></div>
 </div>
{/each}
<label class="range-label" for={`satellite-size-${view.id}`}>Satellite magnification <strong>{size===null?'Mixed':`×${size.toLocaleString('en-GB')}`}</strong></label>
<input id={`satellite-size-${view.id}`} aria-label="Satellite magnification" type="range" min="0" max="5" step="0.1" value={Math.log10(size??satelliteMagnification(view,view.satelliteFocus??'iss'))} oninput={e=>updateView(view.id,satelliteSizePatch(view,Math.round(10**(+e.currentTarget.value))))}/>
<div class="range-ends"><span>True size</span><span>Enhanced</span></div>
<p class="hint">Sets the same magnification for both satellites in this view. Orbital distances stay unchanged.{size===null?' Move the slider to give both satellites the same size multiplier.':''}</p>
<p class="hint">Use Scenarios to prepare a spacecraft view. Open an object’s information for facts, reference links and orbit accuracy.</p>

<style>
 .satellite-entry{margin:8px 0;}.body-row{align-items:flex-start;}.body-row label{font-size:10px;line-height:1.5;min-width:0;}
 .object-actions{display:flex;align-items:center;flex-shrink:0;}.range-label{margin-top:18px;}
 .search-label{display:block;font-size:11px;margin:10px 0 5px;}.satellite-search{box-sizing:border-box;width:100%;padding:7px;background:var(--panel,#101920);color:inherit;border:1px solid #3b505b;border-radius:4px;}.search-results{display:flex;flex-direction:column;gap:3px;margin:6px 0;}.search-results button{text-align:left;font-size:11px;padding:6px;}.search-results small{color:#a1afbe;}
</style>
