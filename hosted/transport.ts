import { HOSTED_ACTIONS, type HostedRequest } from './adapter';
import { createBrowserActionAdapter } from './browser-adapter';

const service = 'https://connect.vizualmodel.ai';
export type AccessState = { status: string; connected: boolean; pending: boolean; sessionId?: string; generation?: number; read: boolean; operate: boolean; expiresAt?: number; message: string };
const initial = (): AccessState => ({ status: 'Disconnected', connected: false, pending: false, read: false, operate: false, message: 'Manual exploration works without signing in.' });
function randomState() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// A fresh object belongs to one page incarnation. Credentials stay in memory;
// neither storage nor a reload restores access or replays an uncertain command.
export function createHostedTransport(change: (state: AccessState) => void) {
  let state = initial(), token = '', active = false, socket: WebSocket | undefined;
  let adapter: ReturnType<typeof createBrowserActionAdapter> | undefined;
  let popup: Window | null = null, pairingState = '', attempts = 0, disposed = false;
  let retry: ReturnType<typeof setTimeout> | undefined, heartbeat: ReturnType<typeof setInterval> | undefined, approvalTimeout: ReturnType<typeof setTimeout> | undefined;
  let lastHeartbeat = 0;
  const incarnation = crypto.randomUUID();
  const target = { sessionId: '', generation: 0, read: false, operate: false };
  function update(patch: Partial<AccessState>) { state = { ...state, ...patch }; change(state); }
  function clearSocket() {
    clearInterval(heartbeat); heartbeat = undefined;
    const old = socket; socket = undefined; old?.close(1000, 'Access closed');
  }
  function stop(message: string) {
    active = false; target.read = target.operate = false; token = ''; clearTimeout(retry); clearTimeout(approvalTimeout);
    clearSocket(); adapter?.dispose(); adapter = undefined; pairingState = '';
    update({ connected: false, pending: false, read: false, operate: false, status: 'Disconnected', message });
  }
  async function api(path: string, body: unknown, method = 'POST', auth = token) {
    const response = await fetch(service + '/api/model/' + path, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body), credentials: 'omit', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error(response.status === 401 || response.status === 404 ? 'Access expired or was revoked. Enable access again.' : response.status === 409 ? 'The session or command changed. Read fresh state; do not replay uncertain controls.' : 'The agent service is unavailable. Manual controls remain available.');
    return response.json();
  }
  async function connect() {
    if (!active || disposed) return;
    if (Date.now() >= (state.expiresAt ?? 0)) { stop('The one-hour approval expired. Enable access again.'); return; }
    update({ connected: false, status: attempts ? 'Reconnecting' : 'Connecting', message: 'Keep this tab open and responsive. No command is replayed across reconnects.' });
    try {
      const { ticket } = await api('socket-ticket', { sessionId: target.sessionId, expectedGeneration: target.generation });
      if (!active) return;
      const ws = new WebSocket(service.replace(/^https:/, 'wss:') + '/model-ws'); socket = ws;
      const authTimeout = setTimeout(() => { if (socket === ws && !state.connected) ws.close(); }, 10000);
      ws.onopen = () => { if (active && socket === ws) ws.send(JSON.stringify({ type: 'authenticate', protocol: 1, ticket })); };
      ws.onerror = () => {};
      ws.onmessage = event => {
        if (!active || socket !== ws) return;
        try {
          if (typeof event.data !== 'string' || event.data.length > 16384) throw Error('Invalid service frame');
          const frame = JSON.parse(event.data);
          if (frame.protocol !== 1) throw Error('Incompatible service protocol');
          if (frame.type === 'ready') {
            if (frame.sessionId !== target.sessionId || frame.generation !== target.generation + 1) throw Error('Unexpected session generation');
            target.generation = frame.generation; attempts = 0; clearTimeout(authTimeout); lastHeartbeat = Date.now();
            update({ generation: target.generation, connected: true, status: 'Connected', message: 'Select this session by its label in ChatGPT. Background tabs may be suspended.' });
            clearInterval(heartbeat);
            heartbeat = setInterval(() => {
              if (!active || socket !== ws) return;
              if (Date.now() - lastHeartbeat > 50000) { ws.close(); return; }
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'heartbeat', protocol: 1 }));
            }, 20000);
          } else if (frame.type === 'heartbeat') lastHeartbeat = Date.now();
          else if (frame.type === 'command') {
            const request = frame.request as HostedRequest;
            // The adapter validates the complete request. Authorization is checked
            // atomically again on the server immediately before browser execution.
            void execute(request, ws);
          } else throw Error('Unknown service frame');
        } catch { stop('Incompatible or invalid agent message. Enable access again after checking setup.'); }
      };
      ws.onclose = event => {
        clearTimeout(authTimeout);
        if (socket !== ws || !active) return;
        socket = undefined; clearInterval(heartbeat); update({ connected: false });
        if ([4400, 4401, 4409, 4429].includes(event.code)) { stop('Session unavailable, revoked or incompatible. Enable access again; read state before issuing another control.'); return; }
        schedule();
      };
    } catch { if (active) schedule(); }
  }
  function schedule() {
    if (++attempts > 6) { stop('Connection could not be restored. Enable access again. An interrupted control may have applied; inspect the model before repeating it.'); return; }
    update({ connected: false, status: 'Reconnecting', message: 'Retry ' + attempts + ' of 6. Manual exploration remains available.' });
    retry = setTimeout(() => { void connect(); }, Math.min(15000, 750 * 2 ** (attempts - 1)) * (0.75 + Math.random() * 0.5));
  }
  const started = new Set<string>();
  async function execute(request: HostedRequest, ws: WebSocket) {
    if (!active || !state.connected || !adapter || socket !== ws) return;
    if (started.has(request.id)) return;
    started.add(request.id); if (started.size > 100) started.delete(started.values().next().value!);
    try {
      if (request.sessionId !== target.sessionId || request.generation !== target.generation || request.deadline <= Date.now()) throw Error('Stale command; no action applied.');
      await api('start', { sessionId: target.sessionId, generation: target.generation, requestId: request.id });
      if (!active || socket !== ws || !target.read || request.deadline <= Date.now()) throw Error('Access ended before execution.');
      const receipt = await adapter.execute(request, target);
      if (active && socket === ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'result', protocol: 1, requestId: request.id, receipt }));
    } catch (error) {
      // A failure after authorization can have an uncertain mutation outcome.
      // Server lifecycle records preserve that uncertainty; never retry here.
      if (active && socket === ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'result', protocol: 1, requestId: request.id, error: error instanceof Error ? error.message.slice(0, 240) : 'Browser execution failed.' }));
    }
  }
  async function handoff(event: MessageEvent) {
    if (!pairingState || event.origin !== service || event.source !== popup || event.data?.type !== 'vizualmodel-handoff' || event.data.state !== pairingState || !/^[A-Za-z0-9_-]{43}$/.test(event.data.code)) return;
    const expected = pairingState; pairingState = ''; clearTimeout(approvalTimeout);
    try {
      const result = await api('handoff', { code: event.data.code, state: expected }, 'POST', '');
      if (disposed || !state.pending) return;
      if (result.protocol !== 1 || !result.read || typeof result.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.token) || result.generation !== 0 || !Number.isFinite(result.expiresAt)) throw Error('Invalid approval response');
      token = result.token; target.sessionId = result.sessionId; target.generation = 0; target.read = true; target.operate = result.operate === true;
      adapter = createBrowserActionAdapter(__HOSTED_BUILD__, __HOSTED_DATA__); active = true; attempts = 0;
      update({ pending: false, sessionId: target.sessionId, generation: 0, read: true, operate: target.operate, expiresAt: result.expiresAt });
      popup?.close(); popup = null; void connect();
    } catch { stop('Approval expired or the service is unavailable. Enable access again.'); }
  }
  window.addEventListener('message', handoff);
  change(state);
  return {
    enable(label: string, operate: boolean) {
      if (active || state.pending || disposed) return;
      pairingState = randomState();
      const query = new URLSearchParams({ origin: location.origin, state: pairingState, incarnation, label: label.trim().slice(0, 80) || 'Solar System tab', modelBuild: __HOSTED_BUILD__, dataVersion: __HOSTED_DATA__, actions: HOSTED_ACTIONS.join(','), operate: String(operate), protocol: '1' });
      popup = window.open(service + '/connect/model?' + query.toString(), 'vizualmodel-' + incarnation, 'popup,width=700,height=780');
      if (!popup) { stop('Allow the sign-in popup for this site, then enable access again.'); return; }
      update({ pending: true, status: 'Awaiting approval', message: 'Sign in and approve read/control access in the popup. No access is enabled until you approve.' });
      approvalTimeout = setTimeout(() => stop('Approval timed out. Close the popup and enable access again.'), 300000);
    },
    async disconnect() {
      const auth = token, sessionId = target.sessionId;
      stop('Agent access disconnected. Manual model state is preserved.'); popup?.close(); popup = null;
      if (auth && sessionId) {
        try { await api('session', { sessionId }, 'DELETE', auth); }
        catch { update({ message: 'Access stopped in this tab. Server revocation could not be confirmed; its connection lease expires within 60 seconds. Manage access at connect.vizualmodel.ai/connect.' }); }
      }
    },
    dispose() { disposed = true; stop('Tab closed.'); popup?.close(); window.removeEventListener('message', handoff); },
  };
}
