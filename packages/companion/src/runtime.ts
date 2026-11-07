import { resolveCodex } from './codex-executable';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import type { RuntimeOptions, ScenarioDefinition } from './contracts';
import { Rpc } from './rpc';
import { panelItem } from './presentation';
import { sessionApprovalAvailable, elicitationResponse } from './approvals';
import { inspectEnvironment, type EnvironmentReport } from './environment';

export const TESTED_CODEX = ['codex-cli 0.155.0-alpha.16.3', 'codex-cli 0.160.1', 'codex-cli 0.162.0-alpha.2', 'codex-cli 0.162.0-alpha.17.2', 'codex-cli 0.164.0-alpha.11.1'];
export class Runtime extends EventEmitter {
  rpc?: Rpc;
  threadId?: string;
  turnId?: string;
  status = 'Starting Codex';
  notice: string | null = null;
  scenarioRun?: { id: string; title: string; status: string; turnId?: string };
  items = new Map<string, any>();
  approvals = new Map<string, any>();
  private busy = false;
  private configured = false;
  private revision = 0;
  environment?: EnvironmentReport;
  private config: Record<string, any> = {};
  private disabledServers: Record<string, any> = {};
  private model?: string;
  constructor(private cwd: string, private url: string, private token: string, private saveThread: (id: string) => Promise<void>, private options: RuntimeOptions = { mcpName: 'application', mcpEntry: 'companion/mcp.ts', instructions: '' }) { super(); }
  private state() { return { status: this.status, notice: this.notice, threadId: this.threadId ?? null, turnId: this.turnId ?? null, busy: this.busy, approvals: [...this.approvals.values()], environment: this.environment, scenarioRun: this.scenarioRun ?? null }; }
  snapshot() { return { ...this.state(), revision: this.revision, items: [...this.items.values()].map(panelItem) }; }
  private publish(message: object) { this.emit('update', { ...message, revision: ++this.revision }); }
  changed(reset = false) {
    if (reset) this.publish({ type: 'session', ...this.snapshot() });
    else this.publish({ type: 'session-update', state: this.state() });
    this.emit('change', { ...this.state(), revision: this.revision });
  }
  async start(threadId?: string) {
    try {
      const child = spawn(await resolveCodex(), ['app-server', '--listen', 'stdio://'], { cwd: this.cwd, windowsHide: true, stdio: 'pipe' });
      // Runtime stderr can contain sensitive diagnostics. Keep it out of browser and logs.
      child.stderr.on('data', () => {});
      this.rpc = new Rpc(child);
      this.rpc.on('disconnected', message => { this.status = message; this.turnId = undefined; this.approvals.clear(); this.changed(); });
      this.rpc.on('notification', message => this.notification(message));
      this.rpc.on('request', message => {
        const supported = ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval', 'item/permissions/requestApproval', 'item/tool/requestUserInput', 'mcpServer/elicitation/request'];
        if (!supported.includes(message.method)) { this.rpc!.send({ id: message.id, error: { code: -32601, message: 'This companion does not support this request.' } }); return; }
        this.approvals.set(String(message.id), message); this.changed();
      });
      await this.rpc.request('initialize', { clientInfo: { name: 'companion', title: this.options.name ?? 'Application Companion', version: '0.1.0' } });
      this.rpc.send({ method: 'initialized', params: {} });
      this.environment = await inspectEnvironment(this.cwd);
      if (process.platform === 'win32') {
        try { this.environment.sandboxReadiness = (await this.rpc.request('windowsSandbox/readiness')).status; }
        catch { this.environment.sandboxReadiness = 'unknown'; }
      }
      this.changed();
      const account = await this.rpc.request('account/read', {});
      if (!account.account) throw new Error('Codex is not authenticated. Run codex login in PowerShell, then restart the companion.');
      const settings = await this.rpc.request('config/read', { cwd: this.cwd, includeLayers: false });
      for (const name of Object.keys(settings.config?.mcp_servers ?? {})) this.disabledServers[`mcp_servers.${name}.enabled`] = false;
      this.config = { ...this.disabledServers };
      const prefix = `mcp_servers.${this.options.mcpName}`;
      if (!this.options.workspace) Object.assign(this.config, {
        [`${prefix}.enabled`]: true, [`${prefix}.command`]: process.execPath,
        [`${prefix}.args`]: ['--import', 'tsx', resolve(this.cwd, this.options.mcpEntry)],
        [`${prefix}.cwd`]: this.cwd,
        [`${prefix}.env`]: { COMPANION_URL: this.url, COMPANION_TOKEN: this.token },
        [`${prefix}.required`]: true, [`${prefix}.tool_timeout_sec`]: 240,
      });
      this.configured = true;
      if (!this.options.workspace) await this.conversation(threadId);
      else { this.status = 'Ready'; this.changed(); }
    } catch (error) { this.status = String(error); this.changed(); }
  }
  configureWorkspace(cwd: string, instructions: string, servers: Record<string, any>, model?: string) {
    if (!this.options.workspace) throw new Error('Workspace configuration requires workspace mode.');
    if (this.turnId || this.busy) throw new Error('Finish or interrupt the current turn first.');
    this.cwd = cwd; this.options.instructions = instructions; this.model = model;
    this.config = { ...this.disabledServers };
    for (const [name, server] of Object.entries(servers)) { delete this.config[`mcp_servers.${name}.enabled`]; this.config[`mcp_servers.${name}`] = server; }
  }
  async models() {
    if (!this.configured || !this.rpc) throw new Error(this.status);
    return this.rpc.request('model/list', {});
  }
  async conversation(id?: string) {
    if (!this.configured) throw new Error(this.status);
    if (this.turnId || this.busy) throw new Error('Cancel or finish the running turn first.');
    if (!this.rpc) throw new Error('Codex is unavailable.');
    // An empty thread may still exist only in the running app-server.
    if (!this.options.workspace && id && id === this.threadId && this.status === 'Ready') { this.changed(true); return; }
    this.busy = true;
    try {
      const params = { cwd: this.cwd, config: this.config, ...(this.model ? { model: this.model } : {}), approvalPolicy: 'on-request', sandbox: 'workspace-write',
        developerInstructions: this.options.instructions + ' Follow AGENTS.md. Use live application tools for observations. build_candidate performs configured validation and build; avoid duplicate full validation. Never replay operations after a timeout. Preserve runtime approvals; do not bypass a failing sandbox. Do not launch additional agents or servers. Never deploy or push. ' + (this.environment?.warning ?? '') };
      let result;
      let notice: string | null = null;
      try {
        result = await this.rpc.request(id ? 'thread/resume' : 'thread/start', { ...params, ...(id ? { threadId: id } : {}) }, 60000);
      } catch (error) {
        if (!id || !(error instanceof Error) || !error.message.toLowerCase().includes(`no rollout found for thread id ${id}`.toLowerCase())) throw error;
        result = await this.rpc.request('thread/start', params, 60000);
        notice = `Codex could not find saved history for conversation ${id}. A new conversation was opened. Previous messages have not been recovered or replayed; application state and source files are unchanged.`;
      }
      this.threadId = result.thread.id; await this.saveThread(this.threadId!);
      this.notice = notice;
      this.items.clear();
      for (const turn of result.thread.turns ?? []) for (const item of turn.items ?? []) this.items.set(item.id, item);
      this.turnId = result.thread.turns?.find((turn: any) => turn.status === 'inProgress')?.id;
      this.status = this.turnId ? 'Working' : 'Ready';
      this.busy = false; this.changed(true);
    } catch (error) { this.status = String(error); throw error; }
    finally { this.busy = false; this.changed(); }
  }
  async submit(text: string, scenario?: ScenarioDefinition) {
    if (!this.threadId || !this.rpc) throw new Error(this.status);
    if (this.turnId || this.busy) throw new Error('A turn is already running.');
    this.scenarioRun = scenario ? { id:scenario.id,title:scenario.title,status:'submitting' } : undefined;
    this.busy = true; this.status = 'Submitting'; this.changed();
    try {
      const result = await this.rpc.request('turn/start', { threadId: this.threadId, input: [{ type: 'text', text }] });
      if(this.scenarioRun){this.scenarioRun.turnId=result.turn.id;if(this.scenarioRun.status==='submitting')this.scenarioRun.status=result.turn.status;}
      if (result.turn.status === 'inProgress') { this.turnId = result.turn.id; this.status = 'Working'; }
    } catch (error) { this.status = String(error); if(this.scenarioRun)this.scenarioRun.status='failed'; throw error; }
    finally { this.busy = false; this.changed(); }
  }
  async runScenario(scenario:ScenarioDefinition){await this.submit(`# ${scenario.title}\n\n${scenario.prompt}`,scenario);return this.scenarioRun;}
  async cancel() { if (this.turnId) await this.rpc!.request('turn/interrupt', { threadId: this.threadId, turnId: this.turnId }); }
  answer(id: string, answer: any) {
    const request = this.approvals.get(id);
    if (!request) throw new Error('This runtime request is no longer pending.');
    let result: any;
    if (request.method === 'item/tool/requestUserInput') {
      result = { answers: Object.fromEntries(request.params.questions.map((q: any) => [q.id, { answers: [String(answer[q.id] ?? '')] }])) };
    } else if (request.method === 'item/permissions/requestApproval') {
      // The pilot supports denial; expanding arbitrary permission profiles requires a richer review UI.
      result = { permissions: {}, scope: 'turn' };
    } else if (request.method === 'mcpServer/elicitation/request') {
      result = elicitationResponse(request, answer);
    } else {
      if (!['accept', 'acceptForSession', 'decline', 'cancel'].includes(answer) || (answer === 'acceptForSession' && !sessionApprovalAvailable(request))) throw new Error('Invalid approval decision.');
      result = { decision: answer };
    }
    this.rpc!.send({ id: request.id, result }); this.approvals.delete(id); this.changed();
  }
  private notification({ method, params: p }: any) {
    if (p?.threadId && this.threadId && p.threadId !== this.threadId) return;
    if (method === 'turn/started') { this.turnId = p.turn.id; this.status = 'Working'; if(this.scenarioRun?.status==='submitting'){this.scenarioRun.turnId=p.turn.id;this.scenarioRun.status='inProgress';} }
    if (method === 'turn/completed') { this.turnId = undefined; this.status = p.turn.status === 'completed' ? 'Ready' : `${p.turn.status}: ${p.turn.error?.message ?? ''}`; this.approvals.clear(); if(this.scenarioRun&&this.scenarioRun.turnId===p.turn.id)this.scenarioRun.status=p.turn.status; }
    if (method === 'item/started' || method === 'item/completed') { this.items.set(p.item.id, p.item); this.publish({ type: 'session-item', item: panelItem(p.item) }); return; }
    if (method === 'item/agentMessage/delta') {
      const item = this.items.get(p.itemId) ?? { id: p.itemId, type: 'agentMessage', text: '' };
      item.text += p.delta; this.items.set(item.id, item);
      this.publish({ type: 'session-delta', id: item.id, itemType: 'agentMessage', field: 'text', delta: p.delta }); return;
    }
    if (method === 'item/commandExecution/outputDelta') {
      const item = this.items.get(p.itemId); if (item) item.aggregatedOutput = ((item.aggregatedOutput ?? '') + p.delta).slice(-16000);
      this.publish({ type: 'session-delta', id: p.itemId, itemType: 'commandExecution', field: 'aggregatedOutput', delta: p.delta }); return;
    }
    if (method === 'serverRequest/resolved') this.approvals.delete(String(p.requestId));
    if (method === 'error') this.status = p.error?.message ?? 'Runtime error';
    if (['turn/started', 'turn/completed', 'serverRequest/resolved', 'error'].includes(method)) this.changed();
  }
  close() { this.rpc?.close(); }
}
