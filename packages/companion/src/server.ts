import { resolveCodex } from './codex-executable';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { WebSocket, WebSocketServer } from 'ws';
import { BrowserSession } from './browser';
import { Runtime, TESTED_CODEX } from './runtime';
import { createWorkspace } from './workspace';
import type { CompanionConfig } from './contracts';
import { z } from 'zod';
import { activate } from './activation';
import { scenarioOperation } from './scenarios';




export async function startCompanion(config: CompanionConfig) {
const runtimeOptions = config.runtime ?? { mcpName: 'application', mcpEntry: '', instructions: '' };
if (!/^[A-Za-z0-9_-]+$/.test(runtimeOptions.mcpName)) throw new Error('Invalid MCP server name.');
const reserved = ['build_candidate','activate_candidate','rollback_build','verify_recovery','capture_state','restore_state'];
const names = config.tools.map(t => t.name);
if (new Set(names).size !== names.length || names.some(n => reserved.includes(n))) throw new Error('Duplicate or reserved application tool name.');
if (!config.build.args.some(arg => arg.includes('{outDir}'))) throw new Error('Build arguments must include {outDir}.');
const { cwd, storage, loadWorkspace, saveWorkspace, initialBuild, identity, lockWorkspace, stopBuilds } = createWorkspace(config);
const { snapshot, assertRestored } = config.state;
const protocol = config.transport?.protocol ?? 'application-companion';
const bootstrapGlobal = config.transport?.bootstrapGlobal ?? '__APPLICATION_COMPANION__';
if (!/^[A-Za-z_$][\w$]*$/.test(bootstrapGlobal)) throw new Error('Invalid bootstrap name.');
const port = Number(process.env.COMPANION_PORT || config.port || 5180);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid COMPANION_PORT.');
const origin = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString('base64url');
const browser = new BrowserSession();
const releaseLock = await lockWorkspace();
const record = await loadWorkspace();
let runtime: Runtime;
let stopping = false;
let operationBusy = false;
let browserProtocol = 1;
let buildProgress = '', buildStatus = '';
let workspaceAgent: { url: string; grant: string } | null = null;
function sessionSnapshot() { return { type: 'session', ...runtime.snapshot(), buildProgress, buildStatus }; }
function buildStage(stage: string, status: string) {
  buildStatus = `${stage} · ${status}`;
  if (browser.socket) send(browser.socket, { type: 'build-stage', status: buildStatus });
}
async function changeBuild(candidate: any) {
  const previous = record.activeBuild;
  return activate({
    capture: () => browser.request('capture_state'),
    select: async (build, state) => {
      record.pendingActivation = { previous, target: build, state };
      record.activeBuild = build; browser.ready = false; await saveWorkspace(record);
    },
    reload: () => { if (browser.socket) send(browser.socket, { type: 'reload' }); },
    restore: async (build, state) => {
      // Cold browser/module/WebGL startup can exceed the previous 25-second bound.
      // Keep a finite budget while allowing the application's 60-second readiness check.
      const deadline = Date.now() + 75000;
      while (Date.now() < deadline) {
        if (browser.ready && browser.build === build.id) return browser.request('restore_state', state, 18000);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Candidate did not reconnect and acknowledge readiness within 75 seconds (expected=${build.id}, observed=${browser.build ?? 'none'}, ready=${browser.ready}).`);
    },
    commit: async (build, prior) => { record.activeBuild = build; record.previousBuild = prior; delete record.pendingActivation; await saveWorkspace(record); },
  }, candidate, previous, config.state);
}
const safeEqual = (value: string, expected: string) => Buffer.byteLength(value) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
const json = (res: any, code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
async function body(req: any) { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 100000) throw new Error('Request too large.'); } return JSON.parse(raw); }
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) return json(res, 403, { error: 'Loopback host required.' });
    const path = new URL(req.url!, origin).pathname;
    if (path === '/companion/bootstrap' && req.method === 'GET') {
      if (req.headers.origin && req.headers.origin !== origin) return json(res, 403, { error: 'Same-origin browser required.' });
      // Same-origin bootstrap, like the initial HTML; never allow cross-origin reads.
      return json(res, 200, { token, build: record.activeBuild?.id, workspace: record.workingCopyId, workspaceAgent });
    }
    if (path === '/internal/status' && req.method === 'GET') {
      if (req.headers.origin || !safeEqual(req.headers.authorization ?? '', `Bearer ${token}`)) return json(res, 403, { error: 'Unauthorized diagnostic request.' });
      return json(res, 200, { application: config.application.id, workspace: record.workingCopyId, instanceId: browser.owner ?? null, status: runtime?.status ?? 'Starting', turnId: runtime?.turnId ?? null, threadId: runtime?.threadId ?? null, browserReady: browser.ready, build: record.activeBuild?.id, environment: runtime?.environment });
    }
    if (path === '/internal/workspace-agent' || path === '/internal/context') {
      if (req.headers.origin || !safeEqual(req.headers.authorization ?? '', `Bearer ${token}`)) return json(res, 403, { error: 'Unauthorized workspace integration.' });
      if (path === '/internal/context' && req.method === 'GET') {
        if (!config.contextTool) throw new Error('This application has no context tool configured.');
        if (!browser.ready) throw new Error('The application view is disconnected or still loading. Open it in vmblu and wait for Application connected. Your message was not sent.');
        const tool = config.tools.find(t => t.name === config.contextTool);
        if (!tool || !tool.annotations?.readOnlyHint) throw new Error('Context requires a declared read-only application tool.');
        const instanceId = browser.owner;
        const context = tool.validateResult(await browser.request(tool.name, { detail: 'full' }));
        if (instanceId !== browser.owner || !browser.ready) throw new Error('Application instance disconnected during context capture.');
        return json(res, 200, { application: config.application.id, workspace: record.workingCopyId, instanceId, context });
      }
      if (path === '/internal/workspace-agent' && req.method === 'POST') {
        const input = await body(req), url = new URL(input.url);
        if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/workspace/' || url.search || url.hash || url.username || url.password || !/^[A-Za-z0-9_-]{43}$/.test(input.grant)) throw new Error('Invalid workspace registration.');
        workspaceAgent = { url: url.href, grant: input.grant };
        return json(res, 200, { registered: true, application: config.application.id, workspace: record.workingCopyId, instructions: config.instructions ?? '' });
      }
      return json(res, 405, { error: 'Method not allowed.' });
    }
    if (path === '/companion/build') {
      if (!safeEqual(req.headers.authorization ?? '', `Bearer ${token}`)) return json(res, 403, { error: 'Unauthorized.' });
      return json(res, 200, { build: record.activeBuild?.id });
    }
    if (path === '/internal/tool') {
      if (req.method !== 'POST' || req.headers.origin || !safeEqual(req.headers.authorization ?? '', `Bearer ${token}`)) return json(res, 403, { error: 'Unauthorized tool request.' });
      const input = await body(req);
      if (['build_candidate', 'activate_candidate', 'rollback_build', 'verify_recovery'].includes(input.method)) {
        if (operationBusy) throw new Error('A build or activation is already running.');
        if (!browser.ready || browser.build !== record.activeBuild?.id) throw new Error('Controlled browser must acknowledge the active build before development operations.');
        operationBusy = true;
        try {
          if (input.method === 'verify_recovery') {
            const id = `recovery-test-${Date.now()}`;
            await mkdir(join(storage, 'builds', id), { recursive: true });
            await writeFile(join(storage, 'builds', id, 'index.html'), '<!doctype html><html><head><title>Recovery test</title></head><body>Testing a candidate that cannot start. The previous application will return automatically.</body></html>');
            try { await changeBuild({ id, recoveryTest: true }); }
            catch (error) {
              if ((error as Error).message.includes('Previous build restored with captured state')) return json(res, 200, { recovered: true, detail: (error as Error).message });
              throw error;
            }
            throw new Error('Recovery fault did not trigger.');
          }
          if (input.method === 'build_candidate') {
            const source = await identity();
            if (!source.branch || source.branch === 'main' || source.branch === 'master') throw new Error('Use a personal development branch before building changes.');
            buildProgress = ''; buildStage('Validation', 'starting');
            if (browser.socket) send(browser.socket, { type: 'build-progress', text: '', reset: true });
            record.candidate = await initialBuild(true, text => {
              buildProgress = (buildProgress + text).slice(-12000);
              if (browser.socket) send(browser.socket, { type: 'build-progress', text: text.slice(-4000) });
            }, buildStage);
            await saveWorkspace(record); return json(res, 200, { candidate: record.candidate });
          }
          const candidate = input.method === 'rollback_build' ? record.previousBuild : record.candidate;
          if (!candidate) throw new Error('No candidate/previous build is available.');
          if (input.method === 'activate_candidate' && (await identity()).sourceDigest !== candidate.sourceDigest) throw new Error('Source changed after validation. Build a new candidate.');
          return json(res, 200, await changeBuild(candidate));
        } catch (error) { buildStage('Operation', 'failed'); throw error; }
        finally { operationBusy = false; }
      }
      const tool = config.tools.find(t => t.name === input.method);
      if (!tool) throw new Error('Unknown operation.');
      if (operationBusy) throw new Error('Wait for the current build/activation to complete.');
      if (browser.build !== record.activeBuild?.id) throw new Error('Browser does not match the active workspace build.');
      const params = z.object(tool.inputSchema).strict().parse(input.params ?? {});
      if(input.method==='scenarios'&&config.scenarios){
        if(!browser.ready)throw new Error('Controlled browser is not ready.');
        const result=await scenarioOperation(config.scenarios,params);
        await browser.request('_companion/scenarios_changed',{scenarios:result.scenarios});
        return json(res,200,{...tool.validateResult(result),workspace:record.workingCopyId,build:record.activeBuild});
      }
      const result = tool.validateResult(await browser.request(input.method, params));
      return json(res, 200, { ...result, workspace: record.workingCopyId, build: record.activeBuild });
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
    if (!record.activeBuild) return json(res, 503, { error: 'Preparing initial build. Refresh shortly.' });
    const root = join(storage, 'builds', record.activeBuild.id);
    const file = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep)) return json(res, 403, { error: 'Invalid path.' });
    const info = await stat(file);
    if (!info.isFile()) return json(res, 404, { error: 'Not found.' });
    const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream' };
    let content: Buffer | string = await readFile(file);
    if (extname(file) === '.html') content = content.toString().replace('</head>', `<script>window.${bootstrapGlobal}=${JSON.stringify({ token, build: record.activeBuild.id, workspace: record.workingCopyId })};setInterval(async()=>{try{const c=window.${bootstrapGlobal};const r=await fetch('/companion/build',{headers:{authorization:'Bearer '+c.token},cache:'no-store'});if(r.ok&&(await r.json()).build!==c.build)location.reload()}catch{}},1000)</script></head>`);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }); res.end(content);
  } catch (error) { json(res, 400, { error: (error as Error).message }); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 200000, perMessageDeflate: false, handleProtocols: () => protocol });
server.on('upgrade', (req, socket, head) => {
  const protocols = (req.headers['sec-websocket-protocol'] ?? '').split(',').map(s => s.trim());
  if (req.url !== '/companion' || req.headers.host !== `127.0.0.1:${port}` || req.headers.origin !== origin || protocols[0] !== protocol || protocols.length !== 2 || !safeEqual(protocols[1], token)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
});
const send = (socket: WebSocket, message: unknown) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
wss.on('connection', socket => {
  let claimed = false;
  let alive = true;
  socket.on('pong', () => { alive = true; });
  const heartbeat = setInterval(() => {
    if (!alive) { socket.terminate(); return; }
    alive = false; socket.ping();
  }, 15000);
  const timer = setTimeout(() => { if (!claimed) socket.close(1008, 'Browser identity required.'); }, 5000);
  socket.on('error', () => {});
  socket.on('close', () => { clearTimeout(timer); clearInterval(heartbeat); });
  socket.on('message', async data => {
    try {
      const m = JSON.parse(data.toString());
      if (m.type === 'hello') {
        if (claimed || typeof m.owner !== 'string' || !/^[a-f0-9-]{36}$/i.test(m.owner) || m.build !== record.activeBuild.id) throw new Error('Invalid browser identity or build.');
        browser.claim(socket, m.owner, m.build); claimed = true; clearTimeout(timer);
        browserProtocol = m.protocol === 2 ? 2 : 1;
        send(socket, sessionSnapshot()); return;
      }
      if (!claimed || browser.socket !== socket) throw new Error('This browser does not own the session.');
      if (m.type === 'ready') {
        browser.ready = true;
        if (record.pendingActivation && !operationBusy) {
          operationBusy = true;
          try {
            const saved = snapshot(record.pendingActivation.state);
            const restored = await browser.request('restore_state', saved, 18000);
            assertRestored(saved, restored);
            delete record.pendingActivation; await saveWorkspace(record);
          } finally { operationBusy = false; }
        }
        send(socket, { type: 'browser-ready' }); return;
      }
      if (m.type === 'reply') { browser.reply(m); return; }
      if (m.type === 'sync') { send(socket, sessionSnapshot()); return; }
      if(['list-scenarios','run-scenario','scenario-operation'].includes(m.type)){
        try{
          if(typeof m.requestId!=='string'||m.requestId.length>100)throw new Error('Invalid application request id.');
          if(!config.scenarios)throw new Error('This application has no scenario repository.');
          // Catalogue reads do not operate the simulation and are safe while it restores.
          if(m.type==='run-scenario'&&(!browser.ready||browser.build!==record.activeBuild?.id||operationBusy))throw new Error('Wait for application readiness and the current build operation.');
          let result;
          if (m.type === 'scenario-operation') {
            if (!browser.ready || browser.build !== record.activeBuild?.id || operationBusy) throw new Error('Wait for application readiness and the current build operation.');
            result = await scenarioOperation(config.scenarios, m.params);
          }
          else if (m.type === 'list-scenarios') result = { scenarios: await config.scenarios.list() };
          else if (!config.runtime) {
            if (!workspaceAgent) throw new Error('Connect this application in vmblu Settings before running an agent scenario.');
            const scenario = await config.scenarios.get(String(m.id));
            const response = await fetch(new URL('/internal/application-prompt', workspaceAgent.url), { method: 'POST', headers: { authorization: 'Bearer ' + workspaceAgent.grant, 'content-type': 'application/json' }, body: JSON.stringify({ instanceId: browser.owner, text: '# ' + scenario.title + '\n\n' + scenario.prompt }), signal: AbortSignal.timeout(60000) });
            result = await response.json(); if (!response.ok) throw new Error(result.error);
            send(socket, { type: 'workspace-agent-open' });
          } else result = await runtime.runScenario(await config.scenarios.get(String(m.id)));
          send(socket,{type:'application-result',requestId:m.requestId,result});
        }catch(error){send(socket,{type:'application-result',requestId:m.requestId,error:(error as Error).message});}
        return;
      }
      if (m.type === 'submit') { if (typeof m.text !== 'string' || !m.text.trim() || m.text.length > 20000) throw new Error('Enter a message of up to 20,000 characters.'); await runtime.submit(m.text); }
      else if (m.type === 'cancel') await runtime.cancel();
      else if (m.type === 'new') await runtime.conversation();
      else if (m.type === 'resume') await runtime.conversation(record.threadId);
      else if (m.type === 'answer') runtime.answer(String(m.id), m.answer);
      else throw new Error('Unknown panel action.');
    } catch (error) { send(socket, { type: 'error', message: (error as Error).message }); if (!claimed) socket.close(1008, 'Browser claim rejected.'); }
  });
});
await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }).catch(async error => { await releaseLock(); throw new Error(`Port ${port} is unavailable. Stop the owning application yourself or choose COMPANION_PORT. ${error.message}`); });
async function stop() { if (stopping) return; process.removeListener('SIGINT', shutdown); process.removeListener('SIGTERM', shutdown); stopping = true; stopBuilds(); runtime?.close(); browser.fail('Companion stopped.'); for (const client of wss.clients) client.terminate(); wss.close(); server.close(); await releaseLock(); }
const shutdown = () => void stop();
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
try {
  if (!record.activeBuild) { record.activeBuild = await initialBuild(); await saveWorkspace(record); }
  if (record.pendingActivation) { record.activeBuild = record.pendingActivation.previous; await saveWorkspace(record); }
  runtime = new Runtime(cwd, origin, token, async id => { record.threadId = id; await saveWorkspace(record); }, { ...runtimeOptions, name: config.application.name });
  // Trusted local services read this capability; it is never served as a project resource.
  await writeFile(join(storage, 'connection.json'), JSON.stringify({ origin, token, application: config.application.id, workspace: record.workingCopyId, pid: process.pid }), { mode: 0o600 });
  runtime.on('update', message => { if (browser.socket) send(browser.socket, browserProtocol === 2 ? message : sessionSnapshot()); });
  console.log(`${config.application.name} companion: ${origin} (one controlled browser; Ctrl+C stops owned services)`);
  if (config.openBrowser !== false && !process.argv.includes('--no-open')) {
    const opener = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${origin}'`], { windowsHide: true, stdio: 'ignore' });
    opener.on('error', () => console.log(`Open ${origin} in your browser.`));
  }
  try {
    if (config.agent === false || !config.runtime) { runtime.status = 'Application tools ready · connect through vmblu'; runtime.changed(); } else {
    const version = (await promisify(execFile)(await resolveCodex(), ['--version'], { windowsHide: true })).stdout.trim();
    if (!TESTED_CODEX.includes(version)) throw new Error(`Expected ${TESTED_CODEX.join(" or ")}; found ${version}. Validate the new protocol before changing the version pin in companion/runtime.ts.`);
    void runtime.start(record.threadId);
    }
  } catch (error) { runtime.status = `Agent unavailable: ${(error as Error).message}`; runtime.changed(); }
} catch (error) { await stop(); throw error; }

return { origin, stop, runtime: runtime! };
}
