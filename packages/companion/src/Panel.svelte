<script lang="ts">
 import { onMount, tick } from 'svelte';
 import { X } from 'lucide-svelte';
 import type { CompanionClient } from './client';
 import { narrative, activitySummary, activityDetails, itemFailed } from './presentation';
 import { approvalSummary, sessionApprovalAvailable } from './approvals';
 import ElicitationApproval from './ElicitationApproval.svelte';
 let { client, open, settingsOpen = false, onclose, title = 'Companion', placeholder = 'Ask about this application or request a change.', summarize }: { client: CompanionClient; open: boolean; settingsOpen?: boolean; onclose: () => void; title?: string; placeholder?: string; summarize?: (item: any) => string | undefined } = $props();
 const panel = $derived(client.panel);
 const action = (type: string, params: object = {}) => client.action(type, params);
 const startClient = () => client.start();
 const summary = (item: any) => summarize?.(item) ?? activitySummary(item);
 let text = $state('');
 let history: HTMLDivElement | undefined = $state();
 $effect(() => {
   void [$panel.items, $panel.approvals, $panel.buildProgress, $panel.error, $panel.status];
   if (open && history) void tick().then(() => { if (history) history.scrollTop = history.scrollHeight; });
 });
 let answers = $state<Record<string,string>>({});
 onMount(startClient);
 function send(type: string, params: object = {}) { try { action(type, params); panel.update(p=>({...p,error:''})); } catch(e) { panel.update(p=>({...p,error:String(e)})); } }
 function submit() { if(!text.trim())return; send('submit',{text}); text=''; }
 const working = $derived(!!$panel.turnId || !!$panel.busy || $panel.status === 'Submitting');
</script>
<!-- Keep the client mounted while the panel is hidden. -->
{#if open}
<aside id="application-companion" class="panel companion-panel" class:beside-settings={settingsOpen} aria-label="Application companion">
 <div class="panel-heading"><div><span class="eyebrow">APPLICATION</span><h2>{title}</h2></div><button aria-label="Close companion" onclick={onclose}><X size={18}/></button></div>
 <p class="status" role="status"><i class:connected={$panel.connected}></i>{$panel.status}</p>
 <div class="controls"><button onclick={()=>send('new')} disabled={working}>New conversation</button><button onclick={()=>send('resume')} disabled={working}>Resume</button><button onclick={()=>send('cancel')} disabled={!$panel.turnId}>Cancel</button></div>
 {#if $panel.environment?.warning}<details class="environment"><summary>Development environment needs attention</summary><p>{$panel.environment.warning}</p><p>Run <code>npm.cmd run companion:doctor</code> for diagnostics. Application tools remain available.</p></details>{/if}
 <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable conversation must support keyboard scrolling.) -->
 <div class="history" bind:this={history} aria-live="polite" tabindex="0" role="region" aria-label="Codex conversation">
 {#if $panel.notice}<p class="hint" role="status">{$panel.notice}</p>{/if}
 {#if !$panel.items.length}<p class="hint">{placeholder}</p>{/if}
 {#each $panel.items as item (item.id)}
 {#if narrative(item)}<article class:user={item.type==='userMessage'}><small>{item.type==='userMessage'?'YOU':item.type==='agentMessage'?'CODEX':'PLAN'}</small><pre>{narrative(item)}</pre></article>
 {:else if summary(item)}<details class="activity" class:failed={itemFailed(item)}><summary>{summary(item)}</summary><pre>{activityDetails(item)}</pre></details>{/if}
 {/each}
 {#if $panel.buildStatus}<p class="build-status" role="status">{$panel.buildStatus}</p>{/if}
 {#if $panel.buildProgress}<details class="build-output"><summary>Build output and warnings</summary><pre>{$panel.buildProgress}</pre></details>{/if}
 {#each $panel.approvals as request (request.id)}
 <div class="approval"><p class="approval-summary" title={approvalSummary(request)}>{approvalSummary(request)}</p><details><summary>Technical details</summary><pre>{JSON.stringify(request.params,null,2)}</pre></details>
 {#if request.method==='item/tool/requestUserInput'}
 {#each request.params.questions as q}<label>{q.question}<input bind:value={answers[q.id]} list={q.id}/><datalist id={q.id}>{#each q.options??[] as option}<option value={option.label}></option>{/each}</datalist></label>{/each}
 <button onclick={()=>send('answer',{id:request.id,answer:answers})}>Send response</button>
 {:else if request.method==='mcpServer/elicitation/request'}
 <ElicitationApproval {request} onanswer={answer=>send('answer',{id:request.id,answer})}/>
 {:else if request.method==='item/permissions/requestApproval'}
 <p>This permission/form request cannot be granted in this pilot.</p><button onclick={()=>send('answer',{id:request.id,answer:'decline'})}>Decline</button>
 {:else}<button onclick={()=>send('answer',{id:request.id,answer:'accept'})}>Allow once</button>{#if sessionApprovalAvailable(request)}<button title="Approve this request with Codex’s session scope; unrelated actions may still require approval." onclick={()=>send('answer',{id:request.id,answer:'acceptForSession'})}>Approve for session</button>{/if}<button onclick={()=>send('answer',{id:request.id,answer:'decline'})}>Decline</button>{/if}
 </div>{/each}
 {#if $panel.error}<p class="error" role="alert">{$panel.error}</p>{/if}
 </div>
 <form onsubmit={e=>{e.preventDefault();if(!working)submit();}}><label for="agent-message">Message Codex</label><textarea id="agent-message" bind:value={text} maxlength="20000" rows="8" {placeholder}></textarea><button class="send" disabled={!$panel.connected||working||!text.trim()}>Send</button></form>
</aside>
{/if}
<style>
 .approval-summary{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0 0 8px}.approval details{margin-bottom:8px}.approval summary{cursor:pointer}.approval button{margin:3px}
 .activity{padding:9px 0;border-top:1px solid #293d47}.activity summary{color:#9bb7c2;cursor:pointer;line-height:1.6}.activity.failed summary{color:#f0b9aa}.activity pre,.build-output pre{font-family:monospace;font-size:11px;max-height:200px;overflow:auto}.environment,.build-output{padding:8px 12px;overflow:auto;flex-shrink:0;max-height:180px}.environment summary{color:#d9c094;cursor:pointer}.environment p{line-height:1.6}.build-status{padding:0 12px;margin:6px 0;color:#9ec8b5}.build-output summary{cursor:pointer}
 aside{position:absolute;z-index:5;top:58px;bottom:16px;right:var(--workspace-panel-right,18px);width:var(--workspace-panel-width,302px);background:var(--panel,#101920f5);color:#dbe5e9;border:1px solid #ffffff12;border-radius:8px;backdrop-filter:blur(18px);box-shadow:0 16px 60px #0003;display:flex;flex-direction:column;font-size:12px;overflow:hidden}.status{padding:0 12px;margin:10px 0;display:flex;gap:8px;align-items:center}.status i{width:7px;height:7px;background:#b68c65;border-radius:50%}.status i.connected{background:#92c4b0}.controls{display:flex;gap:5px;padding:0 10px 8px}button{cursor:pointer;border:1px solid #3b505b;border-radius:4px;padding:6px;background:#1c2c35;color:inherit}button:disabled{opacity:.45;cursor:default}.history{overflow:auto;flex:1;min-height:60px;padding:0 12px;overflow-anchor:none}article{padding:10px 0;border-top:1px solid #293d47}article.user{color:#b8d8e8}small{font-size:9px;letter-spacing:1px;color:#91a6b3}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;font-size:12px;line-height:1.6;margin:5px 0}.hint{color:#8fa5b1;line-height:1.7}form{flex-shrink:0;display:flex;flex-direction:column;gap:7px;padding:12px;border-top:1px solid #293d47}textarea,input{background:#0b1319;color:#dbe5e9;border:1px solid #3b505b;border-radius:5px;padding:8px;resize:vertical;font:inherit;line-height:1.5}textarea{max-height:30vh;min-height:70px}.send{align-self:flex-end;padding:7px 20px}.error{color:#f0b9aa;padding:0 12px}.approval{padding:12px;border-top:1px solid #ba9858;overflow:auto;max-height:25vh}.approval pre{font-size:11px}.approval label{display:flex;flex-direction:column}.panel-heading,.status,.controls{flex-shrink:0}.panel-heading{padding:20px 20px 14px}.panel-heading button{border:0;background:transparent}
.beside-settings{right:calc(var(--workspace-panel-right,18px) + var(--workspace-panel-width,302px) + var(--workspace-panel-gap,12px))}.panel-heading{display:flex;align-items:center;justify-content:space-between}.eyebrow{font-size:8px;letter-spacing:1.4px;color:#748297}.panel-heading h2{font-size:19px;margin:7px 0 0;font-weight:400}.controls{flex-wrap:wrap}@media(max-width:700px){aside{top:50px;bottom:10px}}
</style>
