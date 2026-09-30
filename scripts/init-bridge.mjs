import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

try {
  await writeFile(new URL('../.env.bridge.local', import.meta.url), `SOLAR_BRIDGE_TOKEN=${randomBytes(32).toString('base64url')}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created .env.bridge.local. Token is not printed; this file is ignored by Git.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env.bridge.local already exists; leaving it unchanged.');
}
