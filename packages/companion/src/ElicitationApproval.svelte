<script lang="ts">
 import { confirmationElicitationAvailable } from './approvals';
 let { request, onanswer }: { request: any; onanswer: (answer: 'accept' | 'decline' | 'cancel') => void } = $props();
 const supported = $derived(confirmationElicitationAvailable(request));
 const meta = $derived(request.params?._meta);
 const browser = $derived(meta?.tool_name === 'access_browser_origin' && typeof meta?.origin === 'string');
 const remembered = $derived(meta?.persist === 'always');
</script>

{#if supported}
 {#if browser}<p>Browser access: <strong>{meta.origin}</strong></p><p>Declining blocks this website for this conversation.</p>{/if}
 {#if remembered}<p>This approval will be remembered for future requests covered by this permission.</p>{/if}
 <button onclick={()=>onanswer('accept')}>{remembered ? 'Allow and remember' : 'Allow'}</button>
{:else}
 <p>This request requires a form or URL flow that this companion does not support.</p>
{/if}
<button onclick={()=>onanswer('decline')}>Decline</button>
<button onclick={()=>onanswer('cancel')}>Cancel</button>
