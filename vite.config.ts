import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dataVersion = createHash('sha256').update(readFileSync(new URL('./public/data/ephemeris.json', import.meta.url))).digest('hex');
const modelBuild = 'solar-hosted-1-' + sourceCommit.slice(0, 12);
export default defineConfig({
  define: { __HOSTED_BUILD__: JSON.stringify(modelBuild), __HOSTED_DATA__: JSON.stringify(dataVersion), __HOSTED_SOURCE__: JSON.stringify(sourceCommit), __HOSTED_ENABLED__: JSON.stringify(process.env.HOSTED_AGENT_ENABLED === 'true') },
  plugins: [svelte(), { name: 'hosted-build-provenance', generateBundle() { this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ modelBuild, sourceCommit, dataVersion, protocol: 1, agentAccess: process.env.HOSTED_AGENT_ENABLED === 'true' }) }); } }],
  resolve: { dedupe: ['svelte'] },
  build: { rollupOptions: { output: { manualChunks: { three: ['three', 'three/addons/controls/OrbitControls.js'] } } } },
});
