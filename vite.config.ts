import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// CLI uploads omit .git. The release command passes the committed source hash
// explicitly; Git deployments may use Vercel's immutable commit variable.
const sourceCommit = process.env.MODEL_SOURCE_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw Error('A full source commit is required for model provenance.');
const sourceDirty = process.env.MODEL_SOURCE_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA ? false : execFileSync('git', ['status', '--porcelain'], {encoding:'utf8'}).trim().length > 0;
const dataVersion = createHash('sha256').update(readFileSync(new URL('./public/data/ephemeris.json', import.meta.url))).digest('hex');
const modelBuild = 'solar-1-' + sourceCommit.slice(0, 12) + (sourceDirty ? '-dirty' : '');
export default defineConfig({
  define: { __MODEL_BUILD__: JSON.stringify(modelBuild), __MODEL_DATA__: JSON.stringify(dataVersion) },
  plugins: [svelte(), { name: 'model-build-provenance', generateBundle() { this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ modelBuild, sourceCommit, sourceDirty, dataVersion, protocol: 1, agentAccess: 'local-bridge-development' }) }); this.emitFile({type:'asset',fileName:'vizualmodel-package.json',source:JSON.stringify({version:1,id:'vizualmodel/solar-system',label:'Solar System',entry:'index.html',modelBuild,sourceCommit,sourceDirty,dataVersion})}); } }],
  resolve: { dedupe: ['svelte'] },
  build: { rollupOptions: { output: { manualChunks: { three: ['three', 'three/addons/controls/OrbitControls.js'] } } } },
});
