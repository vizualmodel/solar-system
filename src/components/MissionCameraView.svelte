<script lang="ts">
 import {onMount,untrack} from 'svelte';
 import {Columns2,Rows2,X,Crosshair} from 'lucide-svelte';
 import {simulationState,status} from '../lib/store';
 import {MissionRenderer} from '../lib/mission-renderer';
 import {missionViews,missionViewModes,missionViewLabels,activeMissionView,updateMissionView,splitMissionView,closeMissionView,type MissionCamera,type MissionViewMode} from '../lib/mission-views';
 import {missionTrajectoriesVisible} from '../lib/mission-trajectories';
 import {missionViewStatus} from '../lib/mission-ui';
 import type {MissionContext} from '../lib/mission-flight';
 let {id,context}:{id:string;context:MissionContext}=$props();
 let host:HTMLDivElement,renderer:MissionRenderer|undefined,error=$state('');
 const mission=$derived($simulationState.mission!);
 const view=$derived(missionViews(mission).find(v=>v.id===id)!);
 function camera(value:MissionCamera){simulationState.update(s=>s.mission?({...s,mission:s.mission.views?updateMissionView(s.mission,id,{camera:value}):{...s.mission,camera:{position:value.position,target:value.target,...(s.mission.camera?.up?{up:value.up}:{})}}}):s);}
 function mode(mode:MissionViewMode){simulationState.update(s=>({...s,mission:updateMissionView(s.mission!,id,{mode,camera:undefined})}));}
 function split(direction:'row'|'column'){window.dispatchEvent(new Event('solar:save-cameras'));simulationState.update(s=>({...s,mission:splitMissionView(s.mission!,id,crypto.randomUUID(),direction)}));}
 onMount(()=>{
  let disposed=false,frame=0;missionViewStatus.update(s=>({...s,[id]:'loading'}));
  const initial=untrack(()=>mission),initialView=untrack(()=>view);
  void MissionRenderer.create(host,context,initial,camera,message=>status.set(message),initialView).then(result=>{if(disposed){result.dispose();return;}renderer=result;missionViewStatus.update(s=>({...s,[id]:'ready'}));}).catch(e=>{if(disposed)return;error=e.message;missionViewStatus.update(s=>({...s,[id]:'error'}));simulationState.update(s=>({...s,mission:{...s.mission!,playing:false}}));});
  const draw=()=>{if(renderer&&!error&&$simulationState.mission){const v=missionViews($simulationState.mission).find(v=>v.id===id);if(v)try{renderer.draw($simulationState.mission,v);}catch(e){error=(e as Error).message;missionViewStatus.update(s=>({...s,[id]:'error'}));simulationState.update(s=>({...s,mission:{...s.mission!,playing:false}}));}}frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);
  const capture=()=>renderer?.captureCamera();window.addEventListener('solar:save-cameras',capture);
  return()=>{disposed=true;cancelAnimationFrame(frame);window.removeEventListener('solar:save-cameras',capture);renderer?.dispose();missionViewStatus.update(s=>{const next={...s};delete next[id];return next;});};
 });
</script>
<section class:active={activeMissionView(mission)===id} class="mission-camera-view" aria-label={`${missionViewLabels[view.mode]} mission view`} onpointerdown={()=>simulationState.update(s=>({...s,mission:{...s.mission!,active:id,...(!s.mission!.views?{views:missionViews(s.mission!),layout:{kind:'view' as const,id}}:{})}}))}>
 <div class="camera-host" bind:this={host}></div>
 <div class="camera-toolbar"><select aria-label="Mission camera viewpoint" value={view.mode} onchange={e=>mode(e.currentTarget.value as MissionViewMode)}>{#each missionViewModes as mode}<option value={mode}>{missionViewLabels[mode]}</option>{/each}</select><div class="spacer"></div><button aria-label="Reset mission camera" title="Reset camera" onclick={()=>mode(view.mode)}><Crosshair size={14}/></button><button aria-label="Split mission side by side" title="Split side by side" disabled={missionViews(mission).length>=6} onclick={()=>split('row')}><Columns2 size={14}/></button><button aria-label="Split mission above and below" title="Split above and below" disabled={missionViews(mission).length>=6} onclick={()=>split('column')}><Rows2 size={14}/></button><button aria-label="Close mission view" title="Close view" disabled={missionViews(mission).length===1} onclick={()=>simulationState.update(s=>({...s,mission:closeMissionView(s.mission!,id)}))}><X size={14}/></button></div>
 {#if missionTrajectoriesVisible(mission,view)}<div class="trajectory-key" aria-label="Mission trajectory legend"><span class="craft">Spacecraft</span><span class="moon">Moon - mission arc</span><small>Earth-centred - fixed J2000 axes</small></div>{/if}
 {#if error}<div class="camera-error" role="alert">{error}<p>Close this view or stop the mission to return.</p></div>{:else if $missionViewStatus[id]!=='ready'}<div class="camera-error" role="status">Preparing spacecraft and camera…</div>{/if}
</section>
<style>
 .trajectory-key{position:absolute;bottom:10px;left:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:6px 9px;border-radius:4px;background:#0a121ddb;font-size:10px;pointer-events:none}.trajectory-key span:before{content:"";display:inline-block;width:16px;height:2px;margin-right:5px;vertical-align:middle}.trajectory-key .craft:before{background:#e6bd7d}.trajectory-key .moon:before{background:#74c7ef}.trajectory-key small{color:#94a2b3;font-size:9px}.mission-camera-view{position:relative;flex:1;min-width:0;min-height:0;overflow:hidden;border:1px solid #ffffff15}.mission-camera-view.active{border-color:#dfbd8980}.camera-host{position:absolute;inset:0}.camera-toolbar{position:absolute;top:8px;left:10px;right:10px;display:flex;align-items:center;gap:2px;background:#101822c9;padding:4px;border:1px solid #ffffff17;border-radius:6px}.camera-toolbar select{font-size:10px;padding:5px;max-width:150px}.camera-toolbar button{padding:5px}.spacer{flex:1}.camera-error{position:absolute;top:40%;left:15px;right:15px;text-align:center;font-size:12px;background:#101822d9;padding:15px;border-radius:6px}
</style>
