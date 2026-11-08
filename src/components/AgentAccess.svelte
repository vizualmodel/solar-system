<script lang="ts">
  import { onMount } from 'svelte';
  import { X } from 'lucide-svelte';
  import { createHostedTransport, type AccessState } from '../../hosted/transport';
  let { onclose }: { onclose: () => void } = $props();
  let label = $state('Solar System tab'), control = $state(false), transport: ReturnType<typeof createHostedTransport> | undefined;
  let access = $state<AccessState>({ status: 'Disconnected', connected: false, pending: false, read: false, operate: false, message: 'Manual exploration works without signing in.' });
  onMount(() => { transport = createHostedTransport(next => access = next); return () => transport?.dispose(); });
</script>
<aside aria-label="Agent access" class="agent-access">
  <header><div><small>PRIVATE PILOT</small><h2>Agent access</h2></div><button aria-label="Close Agent access panel" onclick={onclose}><X size={18}/></button></header>
  <p>Use ChatGPT to inspect this model, change supported settings and investigate Earth–Mars distances.</p>
  <label>Session label <input maxlength="80" bind:value={label} disabled={access.read || access.pending}/></label>
  <label class="check"><input type="checkbox" bind:checked={control} disabled={access.read || access.pending}/> Request control of time, labels and orbits</label>
  <p class="status" role="status">{access.status}{access.read ? ` · ${access.operate ? 'Read and control' : 'Read only'}` : ''}</p>
  <p class="hint">{access.message}</p>
  {#if access.read || access.pending}<button class="primary" onclick={() => transport?.disconnect()}>Disconnect agent access</button>{:else}<button class="primary" onclick={() => transport?.enable(label, control)}>Enable agent access for this tab</button>{/if}
  <p class="hint">Sign-in opens in a popup. Read access includes the investigation. Control requires a separate approval. Approval lasts one hour; reloading creates a new session.</p>
  <h3>Connect to ChatGPT</h3>
  <ol><li><a href="https://vizualmodel.ai/docs/configuration" target="_blank" rel="noreferrer">Set up the private VizualModel Pilot connection</a> once.</li><li>In your ChatGPT conversation, select VizualModel Pilot and ask it to list your model sessions.</li><li>Choose <strong>{label || 'this tab'}</strong>. With several tabs, always specify which one.</li></ol>
  <p class="hint">Keep this tab open and responsive. Background and mobile tabs may be suspended. Reconnect does not replay an interrupted control; read fresh state before repeating it.</p>
  <p><a href="https://connect.vizualmodel.ai/connect/sessions" target="_blank" rel="noreferrer">Manage approved sessions</a></p>
  <details><summary>Technical details</summary><p>Build: {__HOSTED_BUILD__}<br/>Protocol: 1<br/>Session: {access.sessionId ?? 'Not approved'}<br/>Generation: {access.generation ?? '—'}</p><p>Manual and agent setters apply in browser event order. Receipts report actual applied state. Investigation uses the existing approximate orbital model; results are not independently validated astronomical predictions.</p></details>
</aside>
<style>
 .agent-access{position:fixed;z-index:80;right:12px;top:76px;bottom:42px;width:min(370px,calc(100vw - 24px));overflow:auto;background:#101b2b;color:#dbe5ed;border:1px solid #405369;border-radius:8px;padding:20px;box-shadow:0 10px 50px #0008;font-size:13px;line-height:1.55}
 header{display:flex;justify-content:space-between;align-items:start}h2{font-size:21px;margin:3px 0 12px}small{letter-spacing:.12em;color:#9ac9be;font-size:10px}h3{font-size:15px;margin-top:24px}label{display:block;margin:16px 0}input:not([type=checkbox]){display:block;width:100%;box-sizing:border-box;margin-top:5px;background:#18273a;color:#f4f7f9;border:1px solid #52677b;padding:9px;border-radius:4px}.check{display:flex;gap:9px;align-items:start}.check input{margin-top:4px}.hint{font-size:12px;color:#a8bacb}.status{color:#cbeadf;font-weight:600}button{cursor:pointer;background:transparent;color:inherit;border:1px solid #52677b;border-radius:4px;padding:7px}.primary{width:100%;padding:10px;background:#b5d8c4;color:#102a25;font-weight:600;border:0}a{color:#b4dccc;text-decoration:underline}ol{padding-left:20px}li{margin:8px 0}details{font-size:11px;overflow-wrap:anywhere}summary{cursor:pointer}:focus-visible{outline:2px solid #d6ec89;outline-offset:3px}
</style>
