<script lang="ts">
 import { onMount } from 'svelte';
 import { startClient } from './client';
 import { workspaceUi } from '../src/lib/workspace-ui';
 let { open, settingsOpen, onclose }: { open: boolean; settingsOpen: boolean; onclose: () => void } = $props();
 let registration = $state<{url:string;grant:string}|null>(null);
 let instanceId = $state('');
 let connectionError = $state('');
 onMount(startClient);
 onMount(()=>{
   const show=()=>workspaceUi.update(s=>({...s,companion:true}));
   window.addEventListener('workspace-agent-open',show);
   let stopped=false;
   const refresh=async()=>{try{
     const response=await fetch('/companion/bootstrap',{cache:'no-store',signal:AbortSignal.timeout(3000)});
     if(!response.ok)throw new Error('Application service is offline.');
     const value=await response.json();if(stopped)return;
     registration=value.workspaceAgent??null;instanceId=sessionStorage.getItem('solar-companion.owner')??'';connectionError='';
   }catch(e){if(!stopped)connectionError=String(e);}};
   void refresh();const timer=setInterval(refresh,2500);
   return()=>{stopped=true;clearInterval(timer);window.removeEventListener('workspace-agent-open',show);};
 });
</script>
{#if open}<aside id="application-companion" class:with-settings={settingsOpen} aria-label="Workspace companion">
 <header><strong>Companion</strong><div><button onclick={onclose} title="Minimize companion" aria-label="Minimize companion">−</button><button onclick={onclose} title="Close companion" aria-label="Close companion">×</button></div></header>
 {#if registration&&instanceId}<iframe title="Contextual workspace agent" src={registration.url+'#companion='+encodeURIComponent(registration.grant)+'&instance='+encodeURIComponent(instanceId)}></iframe>
 {:else}<div class="offline"><p>Connect this application's tools in vmblu Settings to use the workspace companion.</p><p>The simulation remains available through its normal controls.</p>{#if connectionError}<p role="status">{connectionError}</p>{/if}</div>{/if}
</aside>{/if}
<style>
 aside{position:absolute;right:16px;bottom:16px;top:16px;width:min(390px,calc(100% - 32px));z-index:30;background:#111a24;border:1px solid #344454;border-radius:10px;box-shadow:0 12px 45px #0006;display:flex;flex-direction:column;overflow:hidden;color:#e6edf3}aside.with-settings{right:340px}header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#17212b;font:12px system-ui}header div{display:flex;gap:6px}button{background:transparent;border:0;color:#e6edf3;font-size:19px;cursor:pointer}iframe{width:100%;flex:1;min-height:0;border:0;background:#111a24}.offline{padding:18px;font:13px/1.7 system-ui}@media(max-width:800px){aside.with-settings{right:16px}}
</style>
