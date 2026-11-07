import type { BrowserAdapter, BrowserOptions } from './contracts';
import { applyPanelMessage } from './panel-session';
// Minimal subscribe contract understood by Svelte; the transport has no UI dependency.
function store(initial: any) {
 let value = initial; const listeners = new Set<(value: any) => void>();
 return { subscribe(fn: (value: any) => void) { listeners.add(fn); fn(value); return () => { listeners.delete(fn); }; },
 update(fn: (value: any) => any) { value = fn(value); for (const listener of listeners) listener(value); } };
}
export function createCompanionClient(adapter: BrowserAdapter, options: BrowserOptions = {}) {
const prefix = options.storagePrefix ?? 'application-companion';
const panel = store({ status: 'Connecting', items: [], approvals: [], connected: false });
const scenarios = store([] as import('./contracts').ScenarioSummary[]);
const pending = new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
let socket: WebSocket | undefined;
function action(type: string, params: object = {}) {
  if (socket?.readyState !== WebSocket.OPEN) throw new Error('Companion disconnected. Your request was not sent.');
  socket.send(JSON.stringify({ type, ...params }));
}
function request(type:string,params:object={}){
 const requestId=crypto.randomUUID();
 return new Promise<any>((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Application request timed out; it may have applied. No automatic retry.'));},30000);
  pending.set(requestId,{resolve,reject,timer});
  try{action(type,{...params,requestId});}catch(error){clearTimeout(timer);pending.delete(requestId);reject(error);}
 });
}
function connectClient() {
  const initial = (window as any)[options.bootstrapGlobal ?? '__APPLICATION_COMPANION__'];
  if (!initial) return () => {};
  let config = initial;
  let owner = sessionStorage.getItem(`${prefix}.owner`);
  if (!owner) { owner = crypto.randomUUID(); sessionStorage.setItem(`${prefix}.owner`, owner); }
  let stopped = false, retry: ReturnType<typeof setTimeout>;
  const key = `${prefix}.reload.v1.${config.workspace}`;
  const preserve = () => {
    try { const state = adapter.capture(); sessionStorage.setItem(key, JSON.stringify(state)); adapter.preserve?.(state); }
    catch (error) { panel.update(p => ({ ...p, error: 'State preservation failed: ' + error })); }
  };
  window.addEventListener('pagehide', preserve);
  const connect = async () => {
    if (stopped) return;
    try {
      const response = await fetch('/companion/bootstrap', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const current = await response.json();
        if (current.workspace !== config!.workspace) { panel.update(p => ({ ...p, error: 'The companion now serves a different workspace. Reload explicitly to connect.' })); return; }
        if (current.build !== config!.build) { preserve(); location.reload(); return; }
        config = current;
        panel.update(p => ({ ...p, workspaceAgent: current.workspaceAgent ?? null }));
      }
    } catch { /* Normal disconnect/restart; the socket below reports status and retries. */ }
    if (stopped) return;
    const connection = new WebSocket(`${location.origin.replace('http:', 'ws:')}/companion`, [options.protocol ?? 'application-companion', config.token]);
    socket = connection;
    connection.onerror = () => {};
    connection.onopen = async () => {
      if (stopped || socket !== connection) return;
      action('hello', { owner, build: config.build, protocol: 2 });
      try {
        await adapter.ready();
        if (!stopped && socket === connection && connection.readyState === WebSocket.OPEN) action('ready');
      } catch (error) { if (!stopped && socket === connection) panel.update(p => ({ ...p, error: String(error) })); }
    };
    connection.onmessage = async event => {
      if (stopped || socket !== connection) return;
      const m = JSON.parse(event.data);
      if(m.type==='application-result'){
        const waiting=pending.get(m.requestId);if(!waiting)return;
        clearTimeout(waiting.timer);pending.delete(m.requestId);
        if(m.error)waiting.reject(new Error(m.error));else {if(m.result?.scenarios)scenarios.update(()=>m.result.scenarios);waiting.resolve(m.result);}return;
      }
      if (['session', 'session-update', 'session-item', 'session-delta'].includes(m.type)) {
        let sync = false;
        panel.update(p => { const next = applyPanelMessage(p, m); sync = next.needsSync && !p.needsSync; return next; });
        if (sync) action('sync');
      }
      else if (m.type === 'browser-ready') panel.update(p => ({ ...p, error: null, connected: true, status: 'Application connected' }));
      else if (m.type === 'error') panel.update(p => ({ ...p, error: m.message }));
      else if (m.type === 'workspace-agent-open') window.dispatchEvent(new Event('workspace-agent-open'));
      else if (m.type === 'build-progress') panel.update(p => ({ ...p, buildProgress: ((m.reset ? '' : p.buildProgress ?? '') + m.text).slice(-12000) }));
      else if (m.type === 'build-stage') panel.update(p => ({ ...p, buildStatus: m.status }));
      else if (m.type === 'reload') location.reload();
      else if (m.type === 'operation') {
        try {
          if (Date.now() >= m.expiresAt) throw new Error('Expired operation.');
          let result;
          if (m.method === 'capture_state') result = await adapter.captureForActivation();
          else if (m.method === 'restore_state') { result = await adapter.restore(m.params); sessionStorage.removeItem(key); }
          else if(m.method==='_companion/scenarios_changed'){scenarios.update(()=>m.params.scenarios);result={acknowledged:true};}
          else result = await adapter.execute(m.method, m.params, { id: m.id, expiresAt: m.expiresAt });
          action('reply', { id: m.id, result });
        }
        catch (error) { action('reply', { id: m.id, error: (error as Error).message }); }
      }
    };
    connection.onclose = event => {
      if (socket !== connection) return;
      for(const waiting of pending.values()){clearTimeout(waiting.timer);waiting.reject(new Error('Companion disconnected; request will not be replayed.'));}pending.clear();
      panel.update(p => ({ ...p, connected: false, status: event.code === 1008 ? 'Waiting for the other application view to close; reconnecting automatically' : 'Companion disconnected; reconnecting' }));
      if (!stopped) retry = setTimeout(connect, 1500);
    };
  };
  void (async () => {
    try { const saved = sessionStorage.getItem(key); if (saved) { await adapter.loadSaved(JSON.parse(saved)); sessionStorage.removeItem(key); } }
    catch (error) { panel.update(p => ({ ...p, error: 'State restoration failed: ' + error })); }
    await connect();
  })();
  return () => { stopped = true; clearTimeout(retry); socket?.close(); window.removeEventListener('pagehide', preserve); };
}

let leases=0,dispose:(()=>void)|undefined;
function startClient(){if(leases++===0)dispose=connectClient();let released=false;return()=>{if(released)return;released=true;if(--leases===0){dispose?.();dispose=undefined;}};}
return { panel, scenarios, action, request, runScenario:(id:string)=>request('run-scenario',{id}), listScenarios:()=>request('list-scenarios'), getScenario:(id:string)=>request('scenario-operation',{params:{action:'get',id}}), saveScenario:(title:string,prompt:string)=>request('scenario-operation',{params:{action:'save',title,prompt}}), start: startClient };
}
export type CompanionClient = ReturnType<typeof createCompanionClient>;
