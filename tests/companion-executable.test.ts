import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { resolveCodex } from '@vizualmodel/companion/codex-executable';

test('finds the Windows extension without PATH and prefers the latest installation', async t => {
  const home = await mkdtemp(join(tmpdir(), 'companion-executable-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const binary = process.arch === 'arm64' ? 'windows-aarch64' : 'windows-x86_64';
  const paths = ['9', '10'].map(v => join(home, '.vscode', 'extensions', `openai.chatgpt-${v}`, 'bin', binary, 'codex.exe'));
  for (const path of paths) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, ''); }
  assert.equal(await resolveCodex({ home, env: {}, platform: 'win32' }), paths[1]);
  assert.equal(await resolveCodex({ home, env: { Path: dirname(paths[0]) }, platform: 'win32' }), paths[0]);
  assert.equal(await resolveCodex({ home, env: { CODEX_BIN: paths[0] }, platform: 'win32' }), paths[0]);
  await assert.rejects(resolveCodex({ home, env: { CODEX_BIN: join(home, 'missing.exe') }, platform: 'win32' }), /CODEX_BIN/);
});

test('missing installation gives actionable startup guidance', async () => {
  await assert.rejects(resolveCodex({ home: join(tmpdir(), 'nonexistent-companion-home'), env: {}, platform: 'win32' }), /Signing in does not add Codex to PATH/);
});
