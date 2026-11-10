<script lang="ts">
  import { onMount } from 'svelte';
  import { X } from 'lucide-svelte';
  import { createBridgeClient } from '../model-integration/bridge-client';
  let { onclose }: { onclose: () => void } = $props();
  let client: ReturnType<typeof createBridgeClient>;
  let connected=$state(false),control=$state(false),operate=$state(false),status=$state('disconnected'),notice=$state('Connect this model to the installed VizualModel Bridge.'),text=$state(''),runtime=$state(''),model=$state('');
  let messages=$state<{id:string;role:'user'|'assistant';text:string}[]>([]);
  let tools=$state<{id:string;name:string;status:string;message?:string}[]>([]);
  const busy=$derived(['working','connecting-runtime','waiting-for-approval','stopping'].includes(status));
  const labels:Record<string,string>={disconnected:'Disconnected',connecting:'Opening Bridge',ready:'Ready',working:'Working', 'connecting-runtime':'Connecting Codex','waiting-for-approval':'Waiting for approval',interrupted:'Stopped',stopped:'Stopped',stopping:'Stopping',error:'Error',failed:'Failed'};
  function event(value:any){
    if(value.type==='connection'){connected=value.connected;operate=!!value.operate;if(!connected){status='disconnected';runtime='';model='';}}
    if(value.type==='status'){status=value.status;notice=value.message??'';}
    if(value.type==='runtime'){runtime=value.name;model=value.model;}
    if(value.type==='text_delta'){const found=messages.find(m=>m.id===value.id);messages=found?messages.map(m=>m.id===value.id?{...m,text:m.text+value.text}:m):[...messages,{id:value.id,role:'assistant',text:value.text}];}
    if(value.type==='message')messages=messages.some(m=>m.id===value.id)?messages.map(m=>m.id===value.id?{...m,text:value.text}:m):[...messages,{id:value.id,role:'assistant',text:value.text}];
    if(value.type==='tool_activity')tools=tools.some(t=>t.id===value.id)?tools.map(t=>t.id===value.id?value:t):[...tools.slice(-19),value];
  }
  function action(run:()=>void){try{run();}catch(error){status='error';notice=(error as Error).message;}}
  function send(e:SubmitEvent){e.preventDefault();const message=text.trim();if(!message||busy||!connected)return;action(()=>{client.send(message);messages=[...messages,{id:crypto.randomUUID(),role:'user',text:message}];text='';status='working';notice='';});}
  onMount(()=>{client=createBridgeClient(event);const close=()=>client.dispose();window.addEventListener('pagehide',close);return()=>{window.removeEventListener('pagehide',close);client.dispose();};});
</script>
<aside aria-label="Agent" class="agent-access">
  <header><div><small>THIS MODEL</small><h2>Agent</h2></div><button aria-label="Close Agent panel" onclick={onclose}><X size={18}/></button></header>
  <p class="status" role="status" aria-live="polite">{labels[status]??status}{connected?` · ${operate?'Model control':'Read only'}`:''}</p>
  {#if runtime}<p class="hint">{runtime}{model?` · ${model}`:''}</p>{/if}
  {#if notice}<p class="hint">{notice}</p>{/if}
  {#if !connected}
    <label class="permission"><input type="checkbox" bind:checked={control} disabled={status==='connecting'||status==='waiting-for-approval'}/> Request control of time, labels and orbits</label>
    <button class="primary" disabled={status==='connecting'||status==='waiting-for-approval'} onclick={()=>action(()=>client.connect(control))}>Connect agent / Open Bridge</button>
    <details><summary>Connection help</summary><p>Use the private Bridge installer supplied with this build. Open Bridge from the Start menu, then retry here. A failed launch can also mean the browser prompt was cancelled or blocked.</p><p>Confirm the application launch, allow this site to contact the local service if requested, then review this model’s access in Bridge. Manual controls work independently.</p></details>
  {:else}
    <div class="actions"><button disabled={busy} onclick={()=>action(()=>{client.newConversation();messages=[];tools=[];status='connecting-runtime';})}>New conversation</button><button onclick={()=>action(()=>client.disconnect())}>Disconnect</button></div>
  {/if}
  <div class="messages" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
    {#if !messages.length}<p class="hint">Ask about the current model, change a supported setting or investigate Earth and Mars.</p>{/if}
    {#each messages as message (message.id)}<article class:user={message.role==='user'}><small>{message.role==='user'?'YOU':'CODEX'}</small><p>{message.text}</p></article>{/each}
  </div>
  {#if tools.length}<details><summary>Model activity · {tools.length}</summary>{#each tools as tool (tool.id)}<p class="activity">{tool.name} · {tool.status}{tool.message?` · ${tool.message}`:''}</p>{/each}</details>{/if}
  <form onsubmit={send}><label for="model-agent-message">Message this model’s agent</label><textarea id="model-agent-message" bind:value={text} maxlength="16000" rows="3" disabled={!connected} placeholder="Read the current state, then turn labels off in the active view."></textarea><div class="actions"><button class="primary" disabled={!connected||busy||!text.trim()} type="submit">Send</button><button type="button" disabled={!connected||!busy} onclick={()=>action(()=>{client.cancel();status='stopping';notice='Stopping Codex does not undo changes already applied.';})}>Stop</button></div></form>
  <p class="hint">Closing this panel keeps the connection. Disconnect revokes access. Reloading creates a new model instance and requires approval.</p>
</aside>
<style>
  .agent-access{position:fixed;z-index:80;right:12px;top:76px;bottom:42px;width:min(420px,calc(100vw - 24px));box-sizing:border-box;overflow:auto;background:#101b2b;color:#dbe5ed;border:1px solid #405369;border-radius:8px;padding:20px;box-shadow:0 10px 50px #0008;font-size:13px;line-height:1.55}
  header{display:flex;justify-content:space-between;align-items:start}h2{font-size:21px;margin:3px 0 12px}small{font-size:10px;letter-spacing:.1em;color:#a7c9b6}button{font:inherit;cursor:pointer;background:transparent;color:inherit;border:1px solid #52677b;border-radius:4px;padding:8px}button:disabled{opacity:.45;cursor:default}.primary{background:#b5d8c4;color:#102a25;font-weight:600}.status{font-weight:600;color:#cee7d6}.hint{font-size:12px;color:#a8bacb}.permission{display:flex;gap:8px;align-items:start;margin:16px 0}.actions{display:flex;gap:8px;margin:12px 0}.actions .primary{flex:1}.messages{margin:20px 0}article{padding:12px;border:1px solid #33475e;margin:12px 0;border-radius:5px}article.user{background:#1a2d40}article p{white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}textarea{font:inherit;display:block;box-sizing:border-box;width:100%;margin:8px 0;background:#18273a;border:1px solid #52677b;border-radius:4px;color:#f0f5f8;padding:10px;resize:vertical}details{margin:16px 0;font-size:12px}summary{cursor:pointer}.activity{overflow-wrap:anywhere}:focus-visible{outline:2px solid #d6ec89;outline-offset:3px}
</style>
