<script lang="ts">
 import {onMount} from 'svelte';
 import {X,ArrowUpRight} from 'lucide-svelte';
 import {objectDetails} from '../lib/object-details';
 import {simulationState} from '../lib/store';
 import {satelliteAccuracy,satelliteSnapshots} from '../lib/satellites';
 import type {SatelliteId} from '../lib/catalog';
 let {objectId,onclose}:{objectId:string;onclose:()=>void}=$props();
 let dialog:HTMLDialogElement;
 const info=$derived(objectDetails(objectId));
 const satellite=$derived(objectId==='iss'||objectId==='hubble');
 onMount(()=>{dialog.showModal();});
 function backdrop(event:MouseEvent){
  if(event.target!==dialog)return;
  const r=dialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
 }
</script>

<dialog bind:this={dialog} aria-labelledby={`object-title-${objectId}`} onclose={onclose} onclick={backdrop} onkeydown={e=>{if(e.key==='Escape'){e.preventDefault();dialog.close();}}} style={`--object-accent:${info.color}`}>
 <div class="hero">
  <img src={info.image.src} alt={info.name} width="640" height="240"/>
  <button type="button" class="close" aria-label="Close object information" onclick={()=>dialog.close()}><X size={20}/></button>
  <span class="category">{info.category}</span>
 </div>
 <article>
  <h2 id={`object-title-${objectId}`}>{info.name}</h2>
  <p class="summary">{info.summary}</p>
  <p class="highlight">{info.highlight}</p>
  <table aria-label={`${info.name} key facts`}><caption>At a glance</caption><tbody>{#each info.facts as [label,value]}<tr><th scope="row">{label}</th><td>{value}</td></tr>{/each}</tbody></table>
  <p class="approximation">Values are approximate. Orbital periods are relative to the parent body.</p>
  {#if satellite}
   {@const snapshot=satelliteSnapshots[objectId as SatelliteId]}
   <section class="simulation-note" aria-label="In this simulation"><h3>In this simulation</h3>
    <p>Snapshot: {new Date(snapshot.epoch).toISOString().slice(0,10)} · NORAD {snapshot.norad}.</p>
    <p>{satelliteAccuracy($simulationState.time,objectId as SatelliteId)==='snapshot'?'The selected date is within the bundled SGP4 snapshot window (±3 days). Positions remain approximate.':satelliteAccuracy($simulationState.time,objectId as SatelliteId)==='unavailable'?'This spacecraft is not yet in orbit at the selected date.':'The selected date uses an illustrative orbit; historical position, altitude and manoeuvres are not reconstructed.'} Attitude and historical spacecraft configuration are illustrative.</p>
   </section>
  {/if}
  <nav aria-label="Learn more"><a href={info.wikipediaUrl} target="_blank" rel="noreferrer">Read on Wikipedia <ArrowUpRight size={15}/></a><a href={info.source} target="_blank" rel="noreferrer">NASA reference <ArrowUpRight size={15}/></a></nav>
  <a class="image-credit" href={info.image.source} target="_blank" rel="noreferrer">{info.image.credit}</a>
 </article>
</dialog>

<style>
 dialog{padding:0;width:min(640px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;border:1px solid #ffffff24;border-radius:16px;background:#101a27;color:#adbdcf;box-shadow:0 28px 100px #000b;color-scheme:dark;}
 dialog::backdrop{background:#02060bd4;backdrop-filter:blur(8px);}
 .hero{position:relative;background:#070d16;border-bottom:1px solid #ffffff10;}
 img{display:block;width:100%;height:240px;object-fit:contain;}
 .close{position:absolute;top:12px;right:12px;display:flex;background:#07101cdd;border:1px solid #ffffff20;border-radius:50%;padding:8px;color:#e7edf5;}
 .category{position:absolute;bottom:14px;left:24px;padding:5px 10px;border:1px solid #ffffff1b;border-radius:20px;background:#08111ce8;color:var(--object-accent);font-size:10px;letter-spacing:1px;text-transform:uppercase;}
 article{padding:24px 28px 26px;}
 h2{margin:0 0 14px;color:#edf1f6;font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:400;letter-spacing:-.6px;}
 p{font-size:13px;line-height:1.75;}
 .summary{margin:0 0 18px;}
 .highlight{padding:12px 16px;background:#ffffff04;border-left:2px solid var(--object-accent);color:#d7dfeb;}
 table{width:100%;border-collapse:collapse;margin-top:24px;font-size:12px;}
 caption{text-align:left;text-transform:uppercase;letter-spacing:1.4px;color:var(--object-accent);font-size:10px;padding-bottom:12px;}
 th,td{padding:11px 0;border-bottom:1px solid #ffffff0c;text-align:left;vertical-align:top;}
 th{width:45%;font-weight:400;color:#879bb2;padding-right:16px;}td{color:#dae3ee;}
 .approximation{font-size:10px;color:#8193a8;margin:10px 0 20px;}
 .simulation-note{background:#070f19;border:1px solid #ffffff0c;border-radius:8px;padding:14px 16px;margin:18px 0;}
 h3{margin:0 0 6px;font-size:11px;color:#d6c2a1;font-weight:500;}.simulation-note p{margin:5px 0;font-size:11px;}
 nav{display:flex;gap:10px;flex-wrap:wrap;padding-top:7px;}nav a{display:inline-flex;align-items:center;gap:5px;padding:10px 13px;border:1px solid #ffffff18;border-radius:7px;color:#e4cfad;text-decoration:none;font-size:12px;background:#ffffff04;}nav a:hover{background:#ffffff0c;}
 .image-credit{display:inline-block;margin-top:18px;font-size:9px;color:#8193a8;}
 @media(max-width:480px){img{height:190px;}article{padding:20px;}h2{font-size:24px;}}
 @media(prefers-reduced-motion:reduce){dialog::backdrop{backdrop-filter:none;}}
</style>
