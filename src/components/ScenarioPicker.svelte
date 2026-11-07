<script lang="ts">
 import {FileText,Rocket,Plus,X,LoaderCircle} from 'lucide-svelte';
 import {client} from '../../companion/client';
 import {parseScenarioMarkdown,type ScenarioPrompt} from '../lib/scenario-prompts';
 import {missions,missionById,startMission} from '../lib/mission';
 import {simulationState,status,save} from '../lib/store';
 let {onsetup}:{onsetup:(text:string)=>Promise<void>}=$props();
 const {panel,scenarios}=client;
 const files=import.meta.glob('../../scenarios/*.md',{query:'?raw',import:'default',eager:true}) as Record<string,string>;
 const bundled=Object.entries(files).map(([path,text])=>parseScenarioMarkdown(path.split('/').pop()!.slice(0,-3),text));
 let catalogue=$state(bundled.map(({prompt,...summary})=>summary));
 const entries=$derived([...missions.map(m=>({id:m.id,title:m.title})),...catalogue.filter(p=>!missionById.has(p.id))]);
 let selected=$state(missions[0]?.id??bundled[0]?.id??''),dialog=$state<'prompt'|'add'|null>(null);
 let displayed=$state<{title:string;prompt:string}|null>(null),busy=$state(false),error=$state('');
 let title=$state(''),task=$state('');
 const selectedMission=$derived(missionById.has(selected));
 $effect(()=>{if($panel.connected)void client.listScenarios().then(result=>catalogue=result.scenarios).catch(e=>error=(e as Error).message);});
 $effect(()=>{if($scenarios.length)catalogue=$scenarios;});
 async function viewPrompt(){
  error='';const mission=missionById.get(selected);
  if(mission){displayed={title:mission.title,prompt:`${mission.description}\n\n${mission.accuracy}\n\nChapters\n${mission.chapters.map(c=>c.title).join('\n')}`};dialog='prompt';return;}
  busy=true;
  try{const prompt:ScenarioPrompt|undefined=$panel.connected?(await client.getScenario(selected)).scenario:bundled.find(p=>p.id===selected);if(!prompt)throw new Error('Connect the application to read this scenario prompt.');displayed=prompt;dialog='prompt';}
  catch(e){error=(e as Error).message;}finally{busy=false;}
 }
 async function execute(){
  if(!selected||$simulationState.mission||busy)return;
  error='';
  if(selectedMission){window.dispatchEvent(new Event('solar:save-cameras'));simulationState.update(s=>startMission(s,selected));status.set('Mission ready · press Play mission');save();return;}
  busy=true;
  try{const prompt=(await client.getScenario(selected)).scenario;await onsetup(`# ${prompt.title}\n\n${prompt.prompt}`);status.set('Scenario setup submitted · follow progress in the research companion');}
  catch(e){error=(e as Error).message;}finally{busy=false;}
 }
 async function add(event:SubmitEvent){
  event.preventDefault();if(busy)return;busy=true;error='';
  try{const result=await client.saveScenario(title.trim(),task.trim());catalogue=result.scenarios;selected=result.scenario.id;dialog=null;title='';task='';status.set('Scenario saved · use the rocket to set it up');}
  catch(e){error=(e as Error).message;}finally{busy=false;}
 }
 function modal(node:HTMLDialogElement){node.showModal();return{destroy(){node.close();}};}
</script>
<div class="scenario-picker" aria-label="Scenarios">
 <label for="scenario-prompt">SCENARIO</label>
 <select id="scenario-prompt" bind:value={selected} disabled={!!$simulationState.mission||busy} onchange={()=>error=''}>
  {#each entries as entry}<option value={entry.id}>{entry.title}</option>{/each}
 </select>
 <div class="scenario-actions" role="group" aria-label="Scenario actions">
  <button onclick={viewPrompt} disabled={!selected||busy} title="View prompt" aria-label="View prompt"><FileText size={17}/></button>
  <button class="setup" onclick={execute} disabled={!!$simulationState.mission||!selected||busy||(!selectedMission&&!$panel.connected)} title={selectedMission?'Set up guided mission':!$panel.connected?'Connect the application to set up a scenario':'Set up scenario'} aria-label="Set up scenario">{#if busy}<LoaderCircle size={17} class="spin"/>{:else}<Rocket size={17}/>{/if}</button>
  <button onclick={()=>{error='';dialog='add';}} disabled={busy} title="Add scenario" aria-label="Add scenario"><Plus size={17}/></button>
 </div>
</div>
{#if error&&!dialog}<p class="scenario-error" role="alert">{error}</p>{/if}
{#if dialog}<dialog use:modal oncancel={event=>{if(busy)event.preventDefault();else{dialog=null;error='';}}} aria-labelledby="scenario-title">
 <header><h2 id="scenario-title">{dialog==='add'?'Add scenario':displayed?.title}</h2><button onclick={()=>{dialog=null;error='';}} disabled={busy} aria-label="Close scenario dialog"><X size={18}/></button></header>
 {#if dialog==='prompt'&&displayed}
  <p>{selectedMission?'This guided mission runs locally. Use the rocket to prepare it, then Play mission to start.':'The rocket sends this prompt to the connected research agent to prepare the scene. Use the timeline’s Play button to start playback.'}</p>
  <textarea aria-label="Scenario prompt" readonly rows="15" value={displayed.prompt}></textarea>
 {:else if dialog==='add'}
  <p>Save a reusable task for the research agent. Saving adds it to the selector; the rocket sets up the scene.</p>
  <form onsubmit={add}>
   <label class="field">Title<input bind:value={title} required maxlength="120" placeholder="For example, Jupiter’s moons"/></label>
   <label class="field">Prompt<textarea bind:value={task} required maxlength="19000" rows="9" placeholder="Describe the scene, cameras, date, and settings to prepare."></textarea></label>
   {#if !$panel.connected}<p>Saving requires the local application connection. Your draft stays here while you reconnect.</p>{/if}
   {#if error}<p class="scenario-error" role="alert">{error}</p>{/if}
   <footer><button type="button" disabled={busy} onclick={()=>{dialog=null;error='';}}>Cancel</button><button class="setup" type="submit" disabled={busy||!$panel.connected||!title.trim()||!task.trim()}>{busy?'Saving…':'Save scenario'}</button></footer>
  </form>
 {/if}
</dialog>{/if}
<style>
 .scenario-picker{display:flex;flex:0 0 auto;align-items:center;gap:7px;min-width:0}
 label{font-size:9px;letter-spacing:1.4px;color:var(--muted)}
 select{width:clamp(150px,19vw,280px);min-width:0;background:var(--panel,#101920);color:var(--text,#dbe5e9);border:1px solid var(--line);border-radius:5px;padding:7px;font:inherit;font-size:12px}
 .scenario-actions{display:flex;gap:5px}.scenario-actions button{width:32px;height:32px;padding:0;display:grid;place-items:center;flex-shrink:0}
 button{border:1px solid var(--line);border-radius:5px;background:transparent;color:var(--text,#dbe5e9);padding:7px 12px;cursor:pointer;font:inherit;font-size:12px}button:hover:enabled{background:#ffffff12}button:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #e8c65a;outline-offset:2px}button:disabled{opacity:.45;cursor:default}button.setup{color:#e8c65a;border-color:#e8c65a66;background:#e8c65a12}
 dialog{color:var(--text,#dbe5e9);background:#111a24;border:1px solid var(--line);border-radius:10px;padding:24px;width:min(680px,90vw);max-height:90vh;overflow:auto}dialog::backdrop{background:#000a}header,footer{display:flex;justify-content:space-between;align-items:center;gap:20px}footer{justify-content:flex-end;margin-top:18px}h2{font-size:18px;font-weight:500}p{font-size:13px;line-height:1.7;color:var(--muted)}textarea,input{box-sizing:border-box;width:100%;background:#0b1119;color:var(--text,#dbe5e9);border:1px solid var(--line);padding:12px;font:inherit;line-height:1.6}textarea{resize:vertical}.field{display:grid;gap:8px;margin-top:16px;font-size:13px;letter-spacing:0}.scenario-error{color:#ffb4a8;font-size:12px;max-width:420px}:global(.spin){animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){:global(.spin){animation:none}}
 @media(max-width:1000px){.scenario-picker>label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}select{width:180px;font-size:11px}}
</style>
