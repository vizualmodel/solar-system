<script lang="ts">
 import MissionViewTree from './MissionViewTree.svelte';
 import MissionCameraView from './MissionCameraView.svelte';
 import type {Layout} from '../lib/layout';
 import type {MissionContext} from '../lib/mission-flight';
 let {node,context}:{node:Layout;context:MissionContext}=$props();
</script>
{#if node.kind==='view'}{#key node.id}<MissionCameraView id={node.id} {context}/>{/key}{:else}<div class="mission-split" style:flex-direction={node.direction}>{#each node.children as child}<MissionViewTree node={child} {context}/>{/each}</div>{/if}
<style>.mission-split{display:flex;flex:1;min-width:0;min-height:0;gap:3px;height:100%;}</style>
