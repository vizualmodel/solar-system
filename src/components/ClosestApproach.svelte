<script lang="ts">
  import { command, scenario, status } from '../lib/store';
  import { byId } from '../lib/catalog';
  import { nextClosestApproach } from '../lib/closest-approach';
  import type { Ephemeris } from '../lib/ephemeris';
  let { data, from, to }: { data: Ephemeris; from: string; to: string } = $props();
  const validPair = $derived(from !== to && byId[from]?.parent === 'sun' && byId[to]?.parent === 'sun');
  let message = $state('');
  $effect(() => { from; to; message = ''; });
  function jump() {
    try {
      const result = nextClosestApproach(data, from, to, $scenario.time, $scenario.end);
      if (!result) {
        message = 'No next closest approach before the selected TO date. Extend the time range if possible.';
      } else {
        command({ type: 'play', value: false });
        command({ type: 'time', value: result.time });
        message = `${byId[from].name} / ${byId[to].name}: ${new Date(result.time).toISOString()} · ${result.distanceAU.toFixed(6)} AU. Paused.`;
      }
      status.set(message);
    } catch (error) {
      message = error instanceof Error ? error.message : 'Closest-approach search failed.';
      status.set(message);
    }
  }
</script>
<div class="closest-approach">
  <button class="primary-button" disabled={!validPair} onclick={jump}>Next closest approach</button>
  <p class="hint">{validPair ? 'Jump to the next minimum separation after the current date, within your FROM/TO range. Uses the approximate orbital model; pauses at the result.' : 'Select two different planets above to find their next closest approach.'}</p>
  {#if message}<p class="hint" role="status">{message}</p>{/if}
</div>
<style>
  button { width: 100%; }
  button:disabled { opacity: .45; cursor: not-allowed; }
  [role="status"] { overflow-wrap: anywhere; color: #d8c29f; }
</style>
