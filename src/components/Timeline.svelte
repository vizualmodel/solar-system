<script lang="ts">
 import { Play,Pause,SkipBack,SkipForward,RotateCcw,ClockArrowUp } from 'lucide-svelte';
 import { simulationState,command,status } from '../lib/store';
 import { MIN_TIME,MAX_TIME } from '../lib/simulation-state';
 import { playbackSpeeds,speedLabel } from '../lib/playback';
 import { localTimelineTime } from '../lib/timeline-time';
 import { beginScrub,moveScrub,scrubDivisor,type ScrubDrag } from '../lib/timeline-scrub';
 let scrubber:HTMLInputElement;
 let drag:ScrubDrag|null=null;
 let pointerId:number|null=null;
 let divisor=$state(1);
 function selectScrubTime(){if(drag)command({type:'time',value:Math.round(drag.time)});}
 function startScrub(e:PointerEvent){
  if(!e.isPrimary||e.button!==0)return;
  e.preventDefault();scrubber.focus();scrubber.setPointerCapture(e.pointerId);pointerId=e.pointerId;
  const rect=scrubber.getBoundingClientRect();
  drag=beginScrub(e.clientX,$simulationState.time,$simulationState.start,$simulationState.end,rect.left+8,rect.width-16,e);
  divisor=scrubDivisor(e);selectScrubTime();
 }
 function updateScrub(e:PointerEvent){
  if(!drag||e.pointerId!==pointerId)return;
  drag=moveScrub(drag,e.clientX,$simulationState.start,$simulationState.end,scrubber.getBoundingClientRect().width-16,e);
  divisor=scrubDivisor(e);selectScrubTime();
 }
 function endScrub(){
  if(pointerId!==null&&scrubber.hasPointerCapture(pointerId))scrubber.releasePointerCapture(pointerId);
  drag=null;pointerId=null;divisor=1;
 }
 function modifiers(e:KeyboardEvent){if(drag)divisor=scrubDivisor(e);}
 function scrubKey(e:KeyboardEvent){
  if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){
   e.preventDefault();const direction=e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1;
   command({type:'time',value:$simulationState.time+direction*1000});
  }
 }
 const iso=(ms:number)=>new Date(ms).toISOString().slice(0,16);
 const display=(ms:number)=>new Date(ms).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
 function range(which:'start'|'end',value:string){const time=Date.parse(value+'Z');if(!Number.isFinite(time))return;simulationState.update(s=>{const next={...s,[which]:time};if(next.start<MIN_TIME||next.end>MAX_TIME||next.start>=next.end){status.set('Choose an ordered time range within 1990–2030.');return s;}next.time=Math.min(next.end,Math.max(next.start,next.time));return next;});}
</script>
<svelte:window onkeydown={modifiers} onkeyup={modifiers} onblur={endScrub}/>
<footer class="timeline">
 <div class="timeline-top"><div class="time-heading"><span class="eyebrow">SIMULATION TIME <span class="utc">UTC</span></span><div class="time-values"><div class="time-picker"><input class="current-time" aria-label="Simulation date and time UTC" type="datetime-local" min={iso($simulationState.start)} max={iso($simulationState.end)} value={iso($simulationState.time)} onchange={e=>{const t=Date.parse(e.currentTarget.value+'Z');if(Number.isFinite(t))command({type:'time',value:t});}}/><button class="current-time-action" title="Go to current time and pause" aria-label="Go to current time and pause" onclick={()=>command({type:'now'})}><ClockArrowUp size={17} aria-hidden="true"/></button></div><span class="local-time">Local <time datetime={new Date($simulationState.time).toISOString()}>{localTimelineTime($simulationState.time)}</time></span></div></div>
 <div class="playback"><button aria-label="Go to start" title="Go to start" onclick={()=>command({type:'time',value:$simulationState.start})}><SkipBack size={17}/></button><button class="play-button" aria-label={$simulationState.playing?'Pause':'Play'} onclick={()=>command({type:'play',value:!$simulationState.playing})}>{#if $simulationState.playing}<Pause size={19} fill="currentColor"/>{:else}<Play size={19} fill="currentColor"/>{/if}</button><button aria-label="Go to end" title="Go to end" onclick={()=>command({type:'time',value:$simulationState.end})}><SkipForward size={17}/></button><div class="divider"></div><select aria-label="Simulation speed" value={$simulationState.speed} onchange={e=>command({type:'speed',value:+e.currentTarget.value})}>{#each playbackSpeeds as speed}<option value={speed}>{speedLabel(speed)}</option>{/each}</select></div>
 <div class="timeline-note"><span class="live-dot"></span>All views synchronized</div></div>
 <input bind:this={scrubber} class="scrubber" aria-label="Time scrubber" aria-describedby="scrub-hint" type="range" min={$simulationState.start} max={$simulationState.end} step="1" value={$simulationState.time} onkeydown={scrubKey} onpointerdown={startScrub} onpointermove={updateScrub} onpointerup={e=>{if(e.pointerId===pointerId){updateScrub(e);endScrub();}}} onpointercancel={endScrub} onlostpointercapture={endScrub} oncontextmenu={e=>{if(drag)e.preventDefault();}} oninput={e=>{if(!drag)command({type:'time',value:+e.currentTarget.value});}}/>
 <div id="scrub-hint" class="scrub-hint" class:fine={divisor>1} aria-live="polite">{divisor>1?`Fine scrubbing · ${divisor}×`:'Ctrl + drag: 10× finer · Ctrl + Shift + drag: 100× finer'}</div>
 <div class="timeline-bottom"><label>FROM <input aria-label="Start date UTC" type="datetime-local" min={iso(MIN_TIME)} max={iso(MAX_TIME)} value={iso($simulationState.start)} onchange={e=>range('start',e.currentTarget.value)}/></label><span>{display($simulationState.time)}</span><label>TO <input aria-label="End date UTC" type="datetime-local" min={iso(MIN_TIME)} max={iso(MAX_TIME)} value={iso($simulationState.end)} onchange={e=>range('end',e.currentTarget.value)}/></label><button title="Reset time range" aria-label="Reset time range" onclick={()=>simulationState.update(s=>({...s,start:MIN_TIME,end:MAX_TIME}))}><RotateCcw size={13}/></button></div>
</footer>

<style>
 .timeline-top{flex-wrap:wrap;}
 .time-heading{min-width:0;}
 .time-values{display:flex;align-items:center;flex-wrap:wrap;gap:4px 12px;}
 .time-picker{display:flex;align-items:center;min-width:0;max-width:100%;}
 .current-time{max-width:calc(100% - 34px);}
 .current-time-action{flex-shrink:0;width:34px;height:34px;color:var(--muted);}
 .local-time{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;}
 .timeline-bottom{flex-wrap:wrap;}
 @media(max-width:700px){.local-time{font-size:10px;}}
 .scrubber{touch-action:none;}
 .scrubber::-webkit-slider-thumb{width:16px;height:16px;}
 .scrubber::-moz-range-thumb{width:16px;height:16px;box-sizing:border-box;}
 .scrub-hint{color:var(--muted);font-size:9px;margin:0 0 8px;}
 .scrub-hint.fine{color:var(--gold);}
</style>
