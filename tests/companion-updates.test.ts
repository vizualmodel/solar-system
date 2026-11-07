import test from 'node:test';
import assert from 'node:assert/strict';
import { Runtime } from '@vizualmodel/companion/runtime';
import { applyPanelMessage } from '@vizualmodel/companion/panel-session';
import { activityDetails, activitySummary, itemFailed, panelItem } from '@vizualmodel/companion/presentation';
import { observation, toolSummary } from '../companion/observation';

const wire = (value: any) => JSON.parse(JSON.stringify(value));
function fixture() {
  const runtime = new Runtime('.', 'http://127.0.0.1:5180', 'unused', async () => {});
  runtime.threadId = 'thread';
  let panel: any = applyPanelMessage({}, { type: 'session', ...wire(runtime.snapshot()) });
  const messages: any[] = [];
  runtime.on('update', event => { const message = wire(event); messages.push(message); panel = applyPanelMessage(panel, message); });
  return { runtime, messages, panel: () => panel,
    notify: (method: string, params: any) => (runtime as any).notification({ method, params: { threadId: 'thread', ...params } }) };
}
test('incremental stream reconstructs text/tools/status and full reconnect matches without resubmitting', () => {
  const f = fixture();
  f.notify('turn/started', { turn: { id: 'one' } });
  f.notify('item/started', { item: { id: 'answer', type: 'agentMessage', text: '' } });
  for (const delta of ['Date: ', '2027-01-01']) f.notify('item/agentMessage/delta', { itemId: 'answer', delta });
  f.notify('item/completed', { item: { id: 'answer', type: 'agentMessage', text: 'Date: 2027-01-01' } });
  f.notify('item/started', { item: { id: 'command', type: 'commandExecution', status: 'inProgress' } });
  f.notify('item/commandExecution/outputDelta', { itemId: 'command', delta: 'ok\n' });
  f.notify('item/completed', { item: { id: 'command', type: 'commandExecution', status: 'completed', aggregatedOutput: 'ok\n', exitCode: 0 } });
  f.notify('turn/completed', { turn: { id: 'one', status: 'completed' } });
  assert.equal(f.panel().turnId, null);
  assert.equal(f.panel().status, 'Ready');
  assert.equal(f.panel().items.length, 2);
  assert.equal(f.panel().items[0].text, 'Date: 2027-01-01');
  assert.deepEqual(f.panel().items, wire(f.runtime.snapshot()).items);
  assert.ok(f.messages.every(m => !Object.hasOwn(m, 'items')));
  const reconnected = applyPanelMessage({ draft: 'unsent message' }, { type: 'session', ...wire(f.runtime.snapshot()) });
  assert.equal(reconnected.draft, 'unsent message');
  assert.deepEqual(reconnected.items, f.panel().items);
});
test('future Codex error variants retain the failure message and allow a subsequent turn', async () => {
  const f = fixture();
  f.runtime.turnId = 'failed';
  f.runtime.approvals.set('pending', { id: 'pending' });
  f.notify('turn/completed', { turn: { id: 'failed', status: 'failed', error: {
    message: 'Provider rejected this request', codexErrorInfo: { futureProviderError: { detail: 'new variant' } },
  } } });
  assert.equal(f.panel().status, 'failed: Provider rejected this request');
  assert.equal(f.panel().turnId, null);
  assert.deepEqual(f.panel().approvals, []);
  f.runtime.rpc = { request: async () => ({ turn: { id: 'next', status: 'inProgress' } }) } as any;
  await f.runtime.submit('Next message');
  assert.equal(f.panel().turnId, 'next');
  assert.equal(f.panel().status, 'Working');
});

test('missing revision requests a snapshot; duplicate events do not append text twice', () => {
  const start = applyPanelMessage({}, { type: 'session', revision: 4, items: [{ id: 'a', text: 'start' }], turnId: 't' });
  const delta = { type: 'session-delta', revision: 5, id: 'a', field: 'text', delta: ' end' };
  const next = applyPanelMessage(start, delta);
  assert.equal(applyPanelMessage(next, delta).items[0].text, 'start end');
  const missing = applyPanelMessage(next, { ...delta, revision: 7 });
  assert.equal(missing.needsSync, true);
  assert.equal(missing.items[0].text, 'start end');
  const restored = applyPanelMessage(missing, { type: 'session', revision: 8, items: [], status: 'Ready', turnId: null });
  assert.equal(restored.needsSync, false); assert.equal(restored.turnId, null); assert.equal(restored.items.length, 0);
});
test('streaming traffic does not grow with conversation history', () => {
  const f = fixture();
  for (let i = 0; i < 80; i++) f.runtime.items.set(`old-${i}`, { id: `old-${i}`, type: 'agentMessage', text: 'x'.repeat(1000) });
  let previousBytes = 0;
  for (let i = 0; i < 100; i++) { f.notify('item/agentMessage/delta', { itemId: 'new', delta: 'hello ' }); previousBytes += Buffer.byteLength(JSON.stringify(f.runtime.snapshot())); }
  const deltaBytes = f.messages.reduce((sum, m) => sum + Buffer.byteLength(JSON.stringify(m)), 0);
  assert.ok(deltaBytes < previousBytes * 0.01, `${deltaBytes} should be less than 1% of ${previousBytes}`);
  assert.equal(f.runtime.items.get('new').text, 'hello '.repeat(100));
});
test('approval metadata is immediate and completion explicitly clears active turn', () => {
  const f = fixture(); f.runtime.turnId = 't';
  f.runtime.approvals.set('approval', { id: 'approval', method: 'item/fileChange/requestApproval', params: { reason: 'Review change' } });
  f.runtime.changed();
  assert.equal(f.panel().approvals.length, 1);
  f.notify('serverRequest/resolved', { requestId: 'approval' }); assert.equal(f.panel().approvals.length, 0);
  f.notify('turn/completed', { turn: { id: 't', status: 'interrupted' } }); assert.equal(f.panel().turnId, null);
});
test('tool summaries show a result once while retaining errors and extra diagnostic content', () => {
  const value = { time: '2027-01-01T00:00:00.000Z', playing: false };
  const item = { type: 'mcpToolCall', tool: 'get_simulation_state', status: 'completed', result: { structuredContent: value, content: [{ type: 'text', text: JSON.stringify(value) }] } };
  assert.equal(panelItem(item).result.content.length, 0);
  assert.match(activitySummary(item), /get_simulation_state/);
  assert.equal(activityDetails(item).split('2027-01-01').length - 1, 1);
  const failed = { ...item, result: { isError: true, content: [{ type: 'text', text: 'Browser disconnected' }] } };
  assert.equal(itemFailed(failed), true); assert.match(activitySummary(failed), /Failed/); assert.match(activityDetails(failed), /Browser disconnected/);
  assert.equal(itemFailed({ type: 'commandExecution', status: 'completed', exitCode: 1 }), true);
});
test('summary observations omit full simulationState but retain identity; full observations preserve it', () => {
  const state = { schema: 1, simulationState: { views: [{ camera: [1,2,3] }] } };
  const value = { time: '2027-01-01T00:00:00.000Z', playing: false, workspace: 'workspace', build: { id: 'build', sourceDigest: 'dirty-source' }, state };
  const small = observation(value); assert.equal(small.viewCount, 1); assert.ok(!('state' in small)); assert.equal(small.build.sourceDigest, 'dirty-source');
  assert.deepEqual(observation(value, 'full').state, state);
  assert.match(toolSummary('get_simulation_state', small), /2027-01-01.*paused.*build/);
});
