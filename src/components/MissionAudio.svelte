<script lang="ts">
 import {onDestroy,untrack} from 'svelte';
 import {simulationState} from '../lib/store';
 import {missionById} from '../lib/mission';
 import {MissionAudioPlayer} from '../lib/mission-audio';
 const m=$derived($simulationState.mission!);
 let error=$state('');
 const player=new MissionAudioPlayer(url=>new Audio(url),message=>error=message);
 const cue=$derived(missionById.get(m.id)!.chapters[m.chapter].media?.find(c=>c.kind==='audio'));
 $effect(()=>{const state=m;untrack(()=>player.sync(state));});
 onDestroy(()=>player.dispose());
</script>
{#if m.audioEnabled}<div class="credit" role="status">{error||`${cue?.credit??'No recording in this chapter'} · archival highlight · original speech speed`} · <a href="https://www.nasa.gov/historical-sounds/" target="_blank" rel="noreferrer">Source</a></div>{/if}
<style>.credit{position:absolute;bottom:5px;right:12px;z-index:4;padding:4px 8px;background:#0b131eee;color:#aaa;font-size:9px;border-radius:4px}</style>
