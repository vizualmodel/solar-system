import { stat, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

export async function resolveCodex(options: { env?: NodeJS.ProcessEnv; home?: string; platform?: string } = {}): Promise<string> {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const windows = (options.platform ?? process.platform) === 'win32';
  const exists = async (path: string) => { try { return (await stat(path)).isFile(); } catch { return false; } };
  const command = env.CODEX_BIN || (windows ? 'codex.exe' : 'codex');
  if (isAbsolute(command) || /[\\/]/.test(command)) {
    if (await exists(command)) return resolve(command);
    throw new Error(`CODEX_BIN does not point to an existing executable: ${command}`);
  }
  const path = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] ?? '';
  for (const directory of path.split(windows ? ';' : delimiter).filter(Boolean)) {
    const candidate = join(directory.replace(/^"|"$/g, ''), windows && !command.endsWith('.exe') ? `${command}.exe` : command);
    if (await exists(candidate)) return candidate;
  }
  if (!env.CODEX_BIN && windows) {
    const extensions = join(home, '.vscode', 'extensions');
    const names = await readdir(extensions).catch(() => [] as string[]);
    for (const name of names.filter(n => n.startsWith('openai.chatgpt-')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
      const candidate = join(extensions, name, 'bin', process.arch === 'arm64' ? 'windows-aarch64' : 'windows-x86_64', 'codex.exe');
      if (await exists(candidate)) return candidate;
    }
  }
  throw new Error('Codex executable not found. Set $env:CODEX_BIN to the full path of codex.exe, then restart the companion. Signing in does not add Codex to PATH.');
}
