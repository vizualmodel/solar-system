import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { BrowserConnection } from '../bridge/browser-connection';
import { BRIDGE_ORIGIN, BRIDGE_PROTOCOL, parseSimulationTime } from '../src/dev/bridge-protocol';

const token = 'test-connection-token-'.padEnd(43, 'x');
const state = { time: '2027-01-01T00:00:00.000Z', playing: false };
async function setup(timeout = 200) {
  const bridge = new BrowserConnection(token, timeout, 0);
  await bridge.ready;
  const connect = () => new WebSocket(`ws://127.0.0.1:${bridge.port}/bridge`, [BRIDGE_PROTOCOL, token], { origin: BRIDGE_ORIGIN });
  return { bridge, connect };
}

test('timestamps require timezone, validate calendar, and normalize offsets', () => {
  assert.equal(parseSimulationTime('2027-01-01T01:00:00+01:00'), Date.parse(state.time));
  assert.equal(parseSimulationTime('2028-02-29T00:00:00Z'), Date.parse('2028-02-29T00:00:00Z'));
  for (const value of ['2027-01-01', '2027-01-01T00:00:00', '2027-02-29T00:00:00Z', '2028-02-30T00:00:00Z',
    '2027-04-31T00:00:00Z', '2027-13-01T00:00:00Z', '2027-01-01T24:00:00Z', '2027-01-01T00:00:60Z',
    '2027-01-01T00:00:00+24:00', '2027-01-01T00:00:00+01:60', '', 'garbage', null]) {
    assert.throws(() => parseSimulationTime(value), Error, String(value));
  }
});

test('supported interval is inclusive and checked after timezone conversion', () => {
  for (const value of ['2025-01-01T00:00:00Z', '2031-01-01T00:00:00Z']) assert.ok(Number.isFinite(parseSimulationTime(value)));
  for (const value of ['2024-12-31T23:59:59.999Z', '2031-01-01T00:00:00.001Z', '2025-01-01T00:00:00+01:00']) {
    assert.throws(() => parseSimulationTime(value), /supported interval/);
  }
});

test('disconnected requests fail immediately and are never delivered after connection', async t => {
  const { bridge, connect } = await setup(); t.after(() => bridge.close());
  await assert.rejects(bridge.request({ method: 'get_simulation_state' }), /Browser disconnected/);
  await assert.rejects(bridge.request({ method: 'set_simulation_time', time: state.time }), /No command was queued/);
  const socket = connect(); await once(socket, 'open');
  const received: unknown[] = [];
  socket.on('message', raw => { const request = JSON.parse(raw.toString()); received.push(request); socket.send(JSON.stringify({ id: request.id, state })); });
  assert.deepEqual(await bridge.request({ method: 'get_simulation_state' }), state);
  assert.equal(received.length, 1);
});

test('request IDs correlate replies; no success before acknowledgement', async t => {
  const { bridge, connect } = await setup(1000); t.after(() => bridge.close());
  const socket = connect(); await once(socket, 'open');
  const firstMessage = once(socket, 'message');
  let resolved = false;
  const first = bridge.request({ method: 'get_simulation_state' }).then(result => { resolved = true; return result; });
  const [raw] = await firstMessage; const request = JSON.parse(raw.toString());
  assert.ok(request.id); assert.ok(request.expiresAt > Date.now());
  socket.send(JSON.stringify({ id: 'wrong-id', state }));
  const secondMessage = once(socket, 'message');
  const second = bridge.request({ method: 'get_simulation_state' });
  const [secondRaw] = await secondMessage; const secondRequest = JSON.parse(secondRaw.toString());
  assert.notEqual(request.id, secondRequest.id);
  socket.send(JSON.stringify({ id: secondRequest.id, state: { ...state, playing: true } }));
  assert.equal((await second).playing, true);
  assert.equal(resolved, false);
  socket.send(JSON.stringify({ id: request.id, state }));
  assert.deepEqual(await first, state);
});

test('unresponsive browser times out, late reply is ignored, reconnection does not replay', async t => {
  const { bridge, connect } = await setup(40); t.after(() => bridge.close());
  const socket = connect(); await once(socket, 'open');
  const message = once(socket, 'message');
  const result = assert.rejects(bridge.request({ method: 'set_simulation_time', time: state.time }), /timed out.*may already have applied/);
  const [raw] = await message; const request = JSON.parse(raw.toString());
  await result;
  socket.send(JSON.stringify({ id: request.id, state }));
  socket.close(); await once(socket, 'close');
  const replacement = connect(); await once(replacement, 'open');
  const methods: string[] = [];
  replacement.on('message', raw => { const request = JSON.parse(raw.toString()); methods.push(request.method); replacement.send(JSON.stringify({ id: request.id, state })); });
  await bridge.request({ method: 'get_simulation_state' });
  assert.deepEqual(methods, ['get_simulation_state']);
});

test('disconnect rejects an outstanding request without waiting for timeout', async t => {
  const { bridge, connect } = await setup(1000); t.after(() => bridge.close());
  const socket = connect(); await once(socket, 'open');
  const message = once(socket, 'message');
  const result = assert.rejects(bridge.request({ method: 'get_simulation_state' }), /Browser disconnected/);
  await message; socket.close(); await result;
});

test('a second browser is explicitly rejected and the first remains selected', async t => {
  const { bridge, connect } = await setup(); t.after(() => bridge.close());
  const first = connect(); await once(first, 'open');
  first.on('message', raw => first.send(JSON.stringify({ id: JSON.parse(raw.toString()).id, state })));
  const second = connect();
  const [code, reason] = await once(second, 'close');
  assert.equal(code, 1008); assert.match(reason.toString(), /already connected/);
  assert.deepEqual(await bridge.request({ method: 'get_simulation_state' }), state);
});

test('origin and token are both required', async t => {
  const { bridge } = await setup(); t.after(() => bridge.close());
  for (const [origin, supplied] of [['http://localhost:5173', token], [BRIDGE_ORIGIN, 'incorrect-token'], ['', token]]) {
    const socket = new WebSocket(`ws://127.0.0.1:${bridge.port}/bridge`, [BRIDGE_PROTOCOL, supplied], { origin });
    const [error] = await once(socket, 'error');
    assert.match(error.message, /403/);
  }
});

test('browser errors and malformed acknowledgements do not become successes', async t => {
  const { bridge, connect } = await setup(); t.after(() => bridge.close());
  const socket = connect(); await once(socket, 'open');
  socket.once('message', raw => socket.send(JSON.stringify({ id: JSON.parse(raw.toString()).id, error: 'Outside current scenario range' })));
  await assert.rejects(bridge.request({ method: 'set_simulation_time', time: state.time }), /Browser rejected/);
  socket.once('message', raw => socket.send(JSON.stringify({ id: JSON.parse(raw.toString()).id, state: { time: 'invalid', playing: false } })));
  await assert.rejects(bridge.request({ method: 'get_simulation_state' }), /Invalid state acknowledgement/);
});
