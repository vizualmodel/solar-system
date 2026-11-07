/** Explicit integration probe, not a browser acceptance test. Run against an unused companion. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { get } from 'svelte/store';
import { applyPanelMessage } from '@vizualmodel/companion/panel-session';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '' } });
const { simulationState } = await import('../src/lib/store');
const { applyBrowserRequest } = await import('./browser-adapter');
const origin = process.env.SOLAR_PROBE_URL || 'http://127.0.0.1:5180';
const html = await (await fetch(origin)).text();
const match = /window\.__SOLAR_COMPANION__=(\{[^<]+?\});/.exec(html);
assert.ok(match, 'Companion bootstrap missing');
const config = JSON.parse(match[1]);
const ws = new WebSocket(origin.replace('http:', 'ws:') + '/companion', ['solar-companion', config.token], { origin });
let submitted = false;
let received: any = {};
const toolNames = new Set<string>();
const done = new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => { ws.close(); reject(new Error('Real-runtime integration probe timed out.')); }, 90000);
  const fail = (error: unknown) => { clearTimeout(timer); ws.close(); reject(error); };
  ws.on('error', fail);
  ws.on('open', () => {
    ws.send(JSON.stringify({ type:'hello', owner:randomUUID(), build:config.build, protocol:2 }));
    ws.send(JSON.stringify({ type:'ready' }));
  });
  ws.on('message', raw => {
    let m = JSON.parse(raw.toString());
    if (m.type === 'error') return fail(new Error(m.message));
    if (m.type === 'operation') {
      try {
        const result = applyBrowserRequest({ id:m.id, method:m.method, ...m.params, expiresAt:m.expiresAt });
        ws.send(JSON.stringify({type:'reply',id:m.id,result}));
      } catch(error) { ws.send(JSON.stringify({type:'reply',id:m.id,error:String(error)})); }
    }
    if (!['session', 'session-update', 'session-item', 'session-delta'].includes(m.type)) return;
    received = applyPanelMessage(received, m); m = received;
    if (m.needsSync) { ws.send(JSON.stringify({ type:'sync' })); return; }
    for (const item of m.items ?? []) if(item.type==='mcpToolCall') toolNames.add(item.tool);
    if (m.approvals?.length) return fail(new Error('Probe requires a runtime approval; inspect the panel.'));
    if (!submitted && m.status==='Ready') {
      submitted=true;
      ws.send(JSON.stringify({type:'submit',text:'Integration test: call solar_companion.get_simulation_state, then solar_companion.set_simulation_time to set 2027-01-01T00:00:00Z, then call get_simulation_state again. Report the actual acknowledged time. Do not inspect or edit files, build, or call other tools.'}));
    } else if (submitted && !m.turnId && m.status==='Ready' && m.items?.some((i:any)=>i.type==='agentMessage')) {
      try {
        assert.equal(get(simulationState).time, Date.parse('2027-01-01T00:00:00Z'));
        assert.ok(toolNames.has('get_simulation_state')); assert.ok(toolNames.has('set_simulation_time'));
        console.log('PASS: real Codex turn -> dedicated MCP -> companion -> actual simulation store -> acknowledged date readback.');
        console.log('Not a real browser/UI acceptance test. Restart the companion to release this probe browser claim.');
        clearTimeout(timer); ws.close(); resolve();
      } catch(error) { fail(error); }
    } else if (/Error:|failed|not authenticated/.test(m.status)) fail(new Error(m.status));
  });
});
await done;
