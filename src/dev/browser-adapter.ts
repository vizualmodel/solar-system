import { get } from 'svelte/store';
import { command, scenario, status } from '../lib/store';
import { validateScenario } from '../lib/scenario';
import { getReloadVerification, installReloadPreservation } from './reload-preservation';
import { BRIDGE_ORIGIN, BRIDGE_PROTOCOL, BRIDGE_URL, parseSimulationTime, type BridgeRequest } from './bridge-protocol';

export function applyBrowserRequest(request: BridgeRequest) {
  if (!Number.isFinite(request.expiresAt) || Date.now() >= request.expiresAt) throw new Error('Request expired; no command applied.');
  if (request.method === 'set_simulation_time') {
    const time = parseSimulationTime(request.time);
    const before = validateScenario(get(scenario));
    if (time < before.start || time > before.end) throw new Error('Time is outside the current scenario FROM/TO range. Adjust that range in the UI first.');
    command({ type: 'time', value: time });
  } else if (request.method !== 'get_simulation_state') {
    throw new Error('Unsupported bridge operation.');
  }
  const actual = validateScenario(get(scenario));
  const reload = getReloadVerification();
  return { time: new Date(actual.time).toISOString(), playing: actual.playing, ...(reload ? { reload } : {}) };
}

export function startBrowserAdapter(): () => void {
  const disposeReloadPreservation = installReloadPreservation();
  const report = (message: string, error = false) => {
    status.set(`[Local bridge] ${message}`);
    (error ? console.warn : console.info)(`[Local bridge] ${message}`);
  };
  const token = import.meta.env.SOLAR_BRIDGE_TOKEN;
  if (location.origin !== BRIDGE_ORIGIN) {
    report(`Not connected: this page uses ${location.origin}. Open ${BRIDGE_ORIGIN}/ instead; the bridge accepts only that exact origin.`, true);
    return disposeReloadPreservation;
  }
  if (!token) {
    report('Not connected: local token missing. Run npm run bridge:init, restart npm run dev:bridge, then reload this page.', true);
    return disposeReloadPreservation;
  }
  let stopped = false;
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const connect = () => {
    if (stopped) return;
    try { socket = new WebSocket(BRIDGE_URL, [BRIDGE_PROTOCOL, token]); }
    catch { report('Could not open the local bridge connection. The app remains usable.', true); return; }
    const current = socket;
    current.onopen = () => report('Connected');
    current.onerror = () => report('Connection failed. Check that Codex started the bridge and both processes use the same local token.', true);
    current.onclose = event => {
      if (stopped) return;
      if (event.code === 1008) {
        report('Rejected: another browser tab is already connected. Close it, then reload this tab.', true);
        return;
      }
      report('Disconnected; retrying. The app remains usable.', true);
      retry = setTimeout(connect, 1500);
    };
    current.onmessage = event => {
      let request: BridgeRequest;
      try { request = JSON.parse(event.data); } catch { return; }
      if (!request || typeof request.id !== 'string' || request.id.length > 100) return;
      try {
        current.send(JSON.stringify({ id: request.id, state: applyBrowserRequest(request) }));
      } catch (error) {
        if (current.readyState === WebSocket.OPEN) current.send(JSON.stringify({ id: request.id, error: error instanceof Error ? error.message : 'Browser command failed.' }));
      }
    };
  };
  const stop = () => { stopped = true; clearTimeout(retry); socket?.close(); disposeReloadPreservation(); window.removeEventListener('pagehide', stop); };
  window.addEventListener('pagehide', stop);
  connect();
  return stop;
}
