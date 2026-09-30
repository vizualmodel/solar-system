<script lang="ts">
 import Viewport from './Viewport.svelte';
 import ViewTree from './ViewTree.svelte';
 import type { Layout } from '../lib/scenario';
 import type { Ephemeris,Vec3 } from '../lib/ephemeris';
 let {node,data,positions}:{node:Layout;data:Ephemeris;positions:Record<string,Vec3>}=$props();
</script>
{#if node.kind==='view'}{#key node.id}<Viewport id={node.id} {data} {positions}/>{/key}{:else}<div class="view-split" style:flex-direction={node.direction}>{#each node.children as child}<ViewTree node={child} {data} {positions}/>{/each}</div>{/if}
