import { resolveCodex } from './codex-executable';
import { spawn } from 'node:child_process';
import { inspectEnvironment } from './environment';
import { Rpc } from './rpc';

// No model turn, credential reads, global config writes, ownership or ACL changes.
const report = await inspectEnvironment(process.cwd());
const child = spawn(await resolveCodex(), ['app-server'], { cwd: process.cwd(), windowsHide: true, stdio: 'pipe' });
child.stderr.on('data', () => {});
const rpc = new Rpc(child);
try {
  await rpc.request('initialize', { clientInfo: { name: 'solar_companion_doctor', version: '0.1.0' } });
  rpc.send({ method: 'initialized', params: {} });
  report.sandboxReadiness = (await rpc.request('windowsSandbox/readiness')).status;
  console.log(JSON.stringify(report, null, 2));
  console.log('This is a read-only diagnostic. A ready result does not prove this checkout can execute sandboxed commands.');
  if (report.warning) console.log('Repair path: use Codex’s supported elevated Windows sandbox setup from your normal account. If setup still cannot update .git/.codex, have an administrator review ownership of those two directories. Do not disable the sandbox or grant blanket access. See companion/README.md.');
} catch (error) { console.log(JSON.stringify(report, null, 2)); console.error(String(error)); process.exitCode = 1; }
finally { rpc.close(); }
