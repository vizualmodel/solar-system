<script lang="ts">
 import type { Snippet } from 'svelte';
 import { ChevronRight } from 'lucide-svelte';
 import { settingsSections,setSectionOpen } from '../lib/settings-sections';
 let {id,title,children}:{id:string;title:string;children:Snippet}=$props();
</script>

<details class="settings-section" open={$settingsSections[id]??false} ontoggle={e=>setSectionOpen(id,e.currentTarget.open)}>
 <summary><ChevronRight size={14}/><span>{title}</span></summary>
 <div class="section-content">{@render children()}</div>
</details>

<style>
 .settings-section{border-bottom:1px solid var(--line);}
 summary{display:flex;align-items:center;gap:8px;padding:16px 20px;cursor:pointer;list-style:none;font-size:10px;color:#9babbc;letter-spacing:.35px;font-weight:500;user-select:none;}
 summary::-webkit-details-marker{display:none;}
 summary:hover{color:#e0e6ed;background:#ffffff04;}
 summary:focus-visible{outline:2px solid var(--gold);outline-offset:-3px;border-radius:3px;}
 summary :global(svg){flex-shrink:0;transition:transform .15s;}
 .settings-section[open]>summary :global(svg){transform:rotate(90deg);}
 .section-content{padding:0 20px 18px;}
 @media(prefers-reduced-motion:reduce){summary :global(svg){transition:none;}}
</style>
