<script lang="ts">
 import {Info} from 'lucide-svelte';
 import {byId} from '../lib/catalog';
 import ObjectInfoDialog from './ObjectInfoDialog.svelte';
 let {id}:{id:string}=$props();
 let open=$state(false);
</script>
<button type="button" class="object-info-button" title={`About ${byId[id].name}`} aria-label={`Information about ${byId[id].name}`} onclick={()=>open=true}><Info size={14}/></button>
{#if open}<ObjectInfoDialog objectId={id} onclose={()=>open=false}/>{/if}
<style>
 .object-info-button{display:inline-flex;align-items:center;justify-content:center;padding:5px;color:#8b9eb6;flex-shrink:0;}
 .object-info-button:hover{color:var(--gold);background:#ffffff0b;}
</style>
