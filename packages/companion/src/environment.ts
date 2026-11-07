import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { open, readdir } from 'node:fs/promises';
const exec = promisify(execFile);
export interface EnvironmentReport { node: string; shell: string; sandboxReadiness?: string; warning?: string; owners?: Record<string, string>; log?: string }
export async function inspectEnvironment(cwd: string): Promise<EnvironmentReport> {
  const result: EnvironmentReport = { node: process.version, shell: process.platform === 'win32' ? 'PowerShell; npm.cmd; Node.js (Python is not required)' : 'Node.js' };
  if (process.platform !== 'win32') return result;
  try {
    const root = cwd.replaceAll("'", "''");
    const script = `$r=@{}; foreach($n in @('.git','.codex')){$p=Join-Path '${root}' $n; if(Test-Path -LiteralPath $p){$r[$n]=(Get-Acl -LiteralPath $p).Owner}}; $r | ConvertTo-Json -Compress`;
    const output = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 10000 });
    result.owners = JSON.parse(output.stdout);
    if (Object.values(result.owners ?? {}).some(owner => /CodexSandbox/i.test(owner))) result.warning = 'Workspace metadata is owned by a Codex sandbox account. Sandbox setup may be unable to update its protection rules; run npm.cmd run companion:doctor. Approvals remain required for any fallback.';
  } catch { result.warning = 'Could not inspect workspace permissions. Run npm.cmd run companion:doctor if source tools fail.'; }
  const directory = join(process.env.CODEX_HOME || join(homedir(), '.codex'), '.sandbox');
  try {
    const logs = (await readdir(directory)).filter(name => /^sandbox.*\.log$/.test(name)).sort().reverse();
    for (const name of logs.slice(0, 3)) {
      const path = join(directory, name), handle = await open(path, 'r');
      let text: string;
      try { const size = (await handle.stat()).size; const buffer = Buffer.alloc(Math.min(size, 512000)); await handle.read(buffer, 0, buffer.length, Math.max(0, size - buffer.length)); text = buffer.toString('utf8'); }
      finally { await handle.close(); }
      if (text.split(/\r?\n/).some(line => /\] deny ACE failed on /.test(line) && line.toLowerCase().includes(cwd.toLowerCase()))) {
        result.log = path;
        result.warning = 'Recorded workspace sandbox failure: protection rules could not be updated on .git or .codex. Global readiness is not a workspace execution check. Run npm.cmd run companion:doctor; preserve approvals for any fallback.';
        break;
      }
    }
  } catch { /* A log may not exist; do not infer a working sandbox from its absence. */ }
  return result;
}
