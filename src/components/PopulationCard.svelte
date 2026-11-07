<script lang="ts">
 import {populationById,populationConstellation,populationState,populationIllustrative,populationFetchedAt,populationMatches} from '../lib/population';
 import {simulationState,updateView} from '../lib/store';
 import type {ViewConfig} from '../lib/simulation-state';
 let {view}:{view:ViewConfig}=$props();
 const selected=$derived(view.populationSelection?populationById.get(view.populationSelection):undefined);
 const row=$derived(selected&&populationMatches(selected,view.populationGroups??[])?selected:undefined);
 const state=$derived(row?populationState(row,$simulationState.time):null);
</script>
{#if row}
 <aside class="population-card" aria-label="Satellite details">
  <button class="dismiss" aria-label="Close satellite details" onclick={()=>updateView(view.id,{populationSelection:null})}>×</button>
  <strong>{row.name}</strong>
  <dl>
   <dt>NORAD ID</dt><dd>{row.id}</dd>
   <dt>Constellation</dt><dd>{populationConstellation(row)}</dd>
   <dt>Altitude¹</dt><dd>{state?`${state.altitude.toFixed(1)} km`:'Unavailable'}</dd>
   <dt>Inertial speed</dt><dd>{state?`${state.speed.toFixed(3)} km/s`:'Unavailable'}</dd>
   <dt>Period</dt><dd>{(1440/Number(row.elements.MEAN_MOTION)).toFixed(2)} min</dd>
   <dt>Inclination</dt><dd>{Number(row.elements.INCLINATION).toFixed(2)}°</dd>
   <dt>Orbital epoch</dt><dd>{new Date(row.epoch).toISOString()}</dd>
   <dt>Cache timestamp</dt><dd>{populationFetchedAt}</dd>
  </dl>
  <p>¹ Radius above Earth’s equatorial reference sphere.</p>
  {#if populationIllustrative(row,$simulationState.time)}<p class="accuracy">Illustrative orbit · displayed date is more than 3 days from the orbital epoch. Historical positions, launches and manoeuvres are not reconstructed.</p>{:else}<p>SGP4 near the cached epoch; not a live tracking feed.</p>{/if}
  <a href="https://celestrak.org/NORAD/documentation/gp-data-formats.php" target="_blank" rel="noreferrer">CelesTrak OMM data</a>
 </aside>
{/if}
<style>
 .population-card{position:absolute;top:54px;left:16px;z-index:4;width:min(310px,calc(100% - 32px));box-sizing:border-box;max-height:calc(100% - 110px);overflow:auto;padding:16px;background:#111c2af2;border:1px solid #637483;border-radius:8px;color:#e0e8ef;font-size:12px;box-shadow:0 8px 24px #0008;}
 strong{display:block;padding-right:25px;}dl{display:grid;grid-template-columns:95px 1fr;gap:7px;margin:14px 0;}dt{color:#a1afbe;}dd{margin:0;overflow-wrap:anywhere;}p{font-size:11px;line-height:1.5;}a,.accuracy{color:#edc787;}.dismiss{position:absolute;right:8px;top:6px;font-size:22px;min-width:28px;min-height:28px;}
</style>
