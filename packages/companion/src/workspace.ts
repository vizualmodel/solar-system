import type { CompanionConfig } from './contracts';
import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rename, readdir, open, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const exec = promisify(execFile);
export function createWorkspace(config: CompanionConfig) {
const cwd = resolve(config.root);
const storage = resolve(cwd, config.storageDirectory ?? '.companion');
const children = new Set<ReturnType<typeof spawn>>();
function stopBuilds() { for (const child of children) child.kill(); }
async function lockWorkspace() {
  await mkdir(storage, { recursive: true });
  const path = join(storage, 'companion.lock');
  try {
    const previous = JSON.parse(await readFile(path, 'utf8'));
    let alive = true; try { process.kill(previous.pid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; }
    if (alive) throw new Error(`This workspace is already owned by process ${previous.pid}. Stop that companion before starting another.`);
    await unlink(path);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const handle = await open(path, 'wx'); await handle.writeFile(JSON.stringify({ pid: process.pid })); await handle.close();
  return async () => { await unlink(path).catch(()=>{}); };
}
async function identity() {
  const base = (await exec('git', ['rev-parse', '--verify', 'HEAD'], { cwd }).catch(() => ({ stdout: '' }))).stdout.trim();
  const branch = (await exec('git', ['branch', '--show-current'], { cwd })).stdout.trim();
  const hash = createHash('sha256');
  for (const sourceRoot of [cwd, ...(config.sourceRoots ?? []).map(p => resolve(cwd, p))]) {
    hash.update(sourceRoot);
    const paths = (await exec('git', ['ls-files', '-c', '-o', '--exclude-standard', '-z'], { cwd: sourceRoot, maxBuffer: 10000000 })).stdout.split('\0').filter(Boolean).sort();
    for (const path of [...new Set(paths)]) { hash.update(path); try { hash.update(await readFile(join(sourceRoot, path))); } catch { hash.update('<deleted>'); } }
  }
  return { baseRevision: base, branch, sourceDigest: hash.digest('hex') };
}
async function loadWorkspace() {
  await mkdir(storage, { recursive: true });
  try {
    const record = JSON.parse(await readFile(join(storage, 'workspace.json'), 'utf8'));
    if (record.application !== config.application.id || record.checkout !== cwd) throw new Error('Workspace record belongs to a different checkout.');
    return record;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { application: config.application.id, checkout: cwd, workingCopyId: randomUUID(), ...await identity() };
  }
}
async function saveWorkspace(record: any) {
  const path = join(storage, 'workspace.json');
  await writeFile(path + '.tmp', JSON.stringify(record, null, 2)); await rename(path + '.tmp', path);
}
function runNode(args: string[], log: (text: string) => void = () => {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    const timer = setTimeout(() => { child.kill(); reject(new Error('Project operation timed out.')); }, 180000);
    child.stdout.on('data', data => log(String(data))); child.stderr.on('data', data => log(String(data)));
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { children.delete(child); clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Project operation failed (exit ${code}).`)); });
  });
}
async function initialBuild(validate = false, log: (text: string) => void = text => process.stdout.write(text), stage: (name: string, status: string) => void = () => {}) {
  const source = await identity();
  if (validate) {
    for (const check of config.validation) {
      stage(check.name, 'running'); await runNode(check.args, log); stage(check.name, 'passed');
    }
  }
  const id = `${Date.now()}-${source.sourceDigest.slice(0, 12)}`;
  stage('Candidate build', 'running');
  await runNode(config.build.args.map(arg => arg.replaceAll('{outDir}', join(storage, 'builds', id))), log);
  if ((await identity()).sourceDigest !== source.sourceDigest) throw new Error('Source changed during validation/build; candidate not accepted.');
  stage('Candidate build', 'passed');
  return { id, ...source };
}

return { cwd, storage, lockWorkspace, identity, loadWorkspace, saveWorkspace, runNode, initialBuild, stopBuilds };
}
