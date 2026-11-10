<script lang="ts">
  import { X } from 'lucide-svelte';
  let { onclose }: { onclose: () => void } = $props();
</script>
<aside aria-label="Agent" class="agent-access">
  <header><h2>Agent</h2><button aria-label="Close Agent panel" onclick={onclose}><X size={18}/></button></header>
  <p role="status">VizualModel Bridge is not available yet.</p>
  <p>The planned local bridge will connect a supported agent to this model. You can explore the model, use Distance charts and save investigations now.</p>
  <p><a href="https://vizualmodel.ai/docs/configuration" target="_blank" rel="noreferrer">Agent availability and configuration</a></p>
</aside>
<style>
  .agent-access{position:fixed;z-index:80;right:12px;top:76px;bottom:42px;width:min(370px,calc(100vw - 24px));box-sizing:border-box;overflow:auto;background:#101b2b;color:#dbe5ed;border:1px solid #405369;border-radius:8px;padding:20px;box-shadow:0 10px 50px #0008;font-size:13px;line-height:1.55}
  header{display:flex;justify-content:space-between;align-items:start}h2{font-size:21px;margin:3px 0 12px}button{cursor:pointer;background:transparent;color:inherit;border:1px solid #52677b;border-radius:4px;padding:7px}a{color:#b4dccc;text-decoration:underline}:focus-visible{outline:2px solid #d6ec89;outline-offset:3px}
</style>
