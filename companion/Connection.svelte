<script lang="ts">
  import { onMount } from 'svelte';
  import { startClient } from './client';
  // Application-owned MCP acknowledgement and state restoration, without an agent UI.
  onMount(startClient);
</script>
