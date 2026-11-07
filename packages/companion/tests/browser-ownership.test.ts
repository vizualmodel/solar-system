import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { BrowserSession } from '../src/browser';

function socket() {
  return Object.assign(new EventEmitter(), { readyState: WebSocket.OPEN, send: () => {} }) as unknown as WebSocket;
}

test('a disconnected view can be replaced without restart, while a live owner stays protected', async () => {
  const browser = new BrowserSession(), first = socket(), second = socket();
  browser.claim(first, 'first', 'build'); browser.ready = true;
  assert.throws(() => browser.claim(second, 'second', 'build'), /Another view is connected/);
  const pending = assert.rejects(browser.request('mutation'), /disconnected.*No request will be replayed/);
  Object.defineProperty(first, 'readyState', { value: WebSocket.CLOSED });first.emit('close');
  await pending;
  browser.claim(second, 'second', 'build');
  assert.equal(browser.owner, 'second');assert.equal(browser.ready, false);
  browser.ready = true;
  first.emit('close');assert.equal(browser.socket, second);assert.equal(browser.ready, true);
  assert.throws(() => browser.claim(socket(), 'second', 'build'), /Another view is connected/);
});

test('replacing a closing connection rejects pending operations and ignores its delayed close', async () => {
  const browser = new BrowserSession(), first = socket(), second = socket();
  browser.claim(first, 'first', 'build');browser.ready = true;
  const pending = assert.rejects(browser.request('mutation'), /replaced.*No request will be replayed/);
  Object.defineProperty(first, 'readyState', { value: WebSocket.CLOSING });
  browser.claim(second, 'second', 'build');await pending;
  first.emit('close');assert.equal(browser.socket, second);assert.equal(browser.ready, false);
});
