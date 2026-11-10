import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// CLI uploads omit .git. The release command passes the committed source hash
// explicitly; Git deployments may use Vercel's immutable commit variable.
const sourceCommit = process.env.MODEL_SOURCE_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw Error('A full source commit is required for model provenance.');
const dataVersion = createHash('sha256').update(readFileSync(new URL('./public/data/ephemeris.json', import.meta.url))).digest('hex');
const modelBuild = 'solar-1-' + sourceCommit.slice(0, 12);
export default defineConfig({
  plugins: [svelte(), { name: 'model-build-provenance', generateBundle() { this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ modelBuild, sourceCommit, dataVersion, protocol: 1, agentAccess: false }) }); } }],
  resolve: { dedupe: ['svelte'] },
  build: { rollupOptions: { output: { manualChunks: { three: ['three', 'three/addons/controls/OrbitControls.js'] } } } },
});
