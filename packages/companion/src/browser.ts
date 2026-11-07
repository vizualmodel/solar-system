import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

/** One live controlled browser. A disconnected owner may be replaced. */
export class BrowserSession {
  socket?: WebSocket;
  owner?: string;
  build?: string;
  ready = false;
  private pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  claim(socket: WebSocket, owner: string, build: string) {
    if (this.socket?.readyState === WebSocket.OPEN) throw new Error('Another view is connected. Close that application view, then reconnect here.');
    this.fail('Browser connection replaced. No request will be replayed.');
    this.owner = owner; this.socket = socket; this.build = build; this.ready = false;
    socket.on('close', () => { if (this.socket === socket) { this.socket = undefined; this.ready = false; this.fail('Browser disconnected. No request will be replayed.'); } });
  }
  reply(message: any) {
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id); clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(message.error)); else pending.resolve(message.result);
  }
  request(method: string, params: unknown = {}, timeoutMs = 5000): Promise<any> {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('The controlled browser is not ready. Open the companion URL.'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Browser acknowledgement timed out; read state before retrying.')); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ type: 'operation', id, method, params, expiresAt: Date.now() + timeoutMs }));
    });
  }
  fail(message: string) { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); } this.pending.clear(); }
}
