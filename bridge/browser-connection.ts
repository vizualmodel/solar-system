import { timingSafeEqual, randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { BRIDGE_ORIGIN, BRIDGE_PROTOCOL, isSimulationState, parseSimulationTime, type BridgeOperation, type SimulationState } from '../src/dev/bridge-protocol';

type Pending = { resolve: (state: SimulationState) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
export class BrowserConnection {
  private server: WebSocketServer;
  private browser?: WebSocket;
  private pending = new Map<string, Pending>();
  readonly ready: Promise<void>;

  constructor(token: string, private timeoutMs = 3000, port = 5174, private log: (message: string) => void = () => {}) {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new Error('Missing or invalid SOLAR_BRIDGE_TOKEN. Run npm run bridge:init.');
    this.server = new WebSocketServer({
      host: '127.0.0.1', port, path: '/bridge', maxPayload: 4096, perMessageDeflate: false,
      handleProtocols: () => BRIDGE_PROTOCOL,
      verifyClient: ({ origin, req }, done) => {
        const protocols = (req.headers['sec-websocket-protocol'] ?? '').split(',').map(value => value.trim());
        const supplied = protocols[1] ?? '';
        const allowed = origin === BRIDGE_ORIGIN && protocols.length === 2 && protocols[0] === BRIDGE_PROTOCOL &&
          Buffer.byteLength(supplied) === Buffer.byteLength(token) && timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
        done(allowed, allowed ? undefined : 403, allowed ? undefined : 'Local origin and connection token required');
      },
    });
    this.ready = new Promise((resolve, reject) => {
      this.server.once('listening', resolve);
      this.server.once('error', reject);
    });
    this.server.on('error', () => this.log('WebSocket server error. Check that port 5174 is available.'));
    this.server.on('connection', socket => {
      if (this.browser) {
        socket.on('error', () => {});
        socket.close(1008, 'A browser session is already connected.');
        this.log('Rejected a second browser session.');
        return;
      }
      this.browser = socket;
      this.log('Browser connected.');
      socket.on('message', data => {
        let reply: { id?: string; state?: unknown; error?: unknown };
        try { reply = JSON.parse(data.toString()); } catch { return; }
        if (!reply || typeof reply.id !== 'string') return;
        const pending = this.pending.get(reply.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(reply.id);
        if (typeof reply.error === 'string') pending.reject(new Error(`Browser rejected operation: ${reply.error.slice(0, 500)}`));
        else if (isSimulationState(reply.state)) pending.resolve(reply.state);
        else pending.reject(new Error('Invalid state acknowledgement from browser.'));
      });
      const disconnected = () => {
        if (this.browser !== socket) return;
        this.browser = undefined;
        this.failPending('Browser disconnected. No commands are queued; reconnect and read state before retrying.');
        this.log('Browser disconnected.');
      };
      socket.on('close', disconnected);
      socket.on('error', () => { disconnected(); socket.terminate(); });
    });
  }

  get port(): number { const address = this.server.address(); if (!address || typeof address === 'string') throw new Error('Bridge is not listening.'); return address.port; }

  request(operation: BridgeOperation): Promise<SimulationState> {
    if (operation.method === 'set_simulation_time') parseSimulationTime(operation.time);
    const socket = this.browser;
    if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Browser disconnected. Open http://127.0.0.1:5173 using npm run dev:bridge. No command was queued.'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Browser response timed out. No acknowledgement received; the operation may already have applied. Read state before retrying. No command will be replayed on reconnection.'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ ...operation, id, expiresAt: Date.now() + this.timeoutMs }), error => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (pending) { clearTimeout(timer); this.pending.delete(id); pending.reject(new Error('Browser disconnected while sending request.')); }
      });
    });
  }

  private failPending(message: string) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(message)); }
    this.pending.clear();
  }

  async close(): Promise<void> {
    this.failPending('Bridge stopped.');
    this.browser = undefined;
    for (const client of this.server.clients) client.terminate();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }
}
