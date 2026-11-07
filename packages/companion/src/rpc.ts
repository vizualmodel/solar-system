import { EventEmitter } from 'node:events';
import { createInterface } from 'node:readline';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';

/** Newline-delimited app-server JSON RPC. Never replay requests after failure. */
export class Rpc extends EventEmitter {
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private closed = false;
  constructor(readonly child: ChildProcessWithoutNullStreams) {
    super();
    createInterface({ input: child.stdout }).on('line', line => {
      let message: any;
      try { message = JSON.parse(line); } catch { this.fail('Invalid JSON from Codex.'); return; }
      if (message.method) this.emit(message.id === undefined ? 'notification' : 'request', message);
      else {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer); this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      }
    });
    child.on('error', error => this.fail(error.message));
    child.on('exit', () => this.fail('Codex stopped. Restart the companion to reconnect; requests will not be resubmitted.'));
    child.stdin.on('error', error => this.fail(error.message));
  }
  send(message: unknown) {
    if (this.closed) throw new Error('Codex is disconnected.');
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }
  request(method: string, params: unknown = {}, timeoutMs = 30000): Promise<any> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out; it may have applied. No automatic retry.`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  fail(message: string) {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); }
    this.pending.clear(); this.emit('disconnected', message);
  }
  close() {
    this.fail('Companion stopped.'); this.child.stdin.end();
    const timer = setTimeout(() => {
      if (this.child.pid && process.platform === 'win32') {
        const killer = spawn('taskkill.exe', ['/PID', String(this.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => this.child.kill());
      } else this.child.kill();
    }, 3000);
    timer.unref(); this.child.once('exit', () => clearTimeout(timer));
  }
}
