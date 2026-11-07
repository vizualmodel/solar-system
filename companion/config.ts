import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import type { CompanionConfig } from '@vizualmodel/companion/contracts';
import { tools } from './tools';
import { snapshot, assertRestored } from './state';
import { createScenarioRepository } from './scenario-repository';
const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
export const config: CompanionConfig = {
 application: { id: 'vizualmodel/solar-system', name: 'Solar Observatory' }, root, port: 5180,
 agent: false, contextTool: 'get_simulation_state',
 instructions: 'Operate Solar Observatory using its grouped MCP tools for existing UI controls: timeline, camera, scene, satellites, views, session, workspace and charts. Read live state; use detail=full for settings and view IDs. Prefer structured settings payloads over browser clicks or source changes. Only implement code when a requested capability is absent. Scenarios are app-owned Markdown task prompts, separate from SimulationState. When asked to save a scenario, distill successful tested instructions into a reusable title and prompt, then call scenarios action=save. Windows PowerShell, npm.cmd and Node are available.',
 tools, state: { snapshot, assertRestored }, scenarios: createScenarioRepository(root+'/scenarios'),
 validation: [
  { name: 'Type checks', args: ['node_modules/svelte-check/bin/svelte-check','--tsconfig','./tsconfig.json'] },
  { name: 'Tests', args: ['--import','tsx','--test', ...(await readdir(new URL('../tests/',import.meta.url))).filter(n=>n.endsWith('.test.ts')).map(n=>'tests/'+n)] }
 ],
 build: { args: ['node_modules/vite/bin/vite.js','build','--mode','companion','--outDir','{outDir}'] },
 sourceRoots: [fileURLToPath(new URL('../', import.meta.resolve('@vizualmodel/companion/server')))],
 transport: { bootstrapGlobal: '__SOLAR_COMPANION__', protocol: 'solar-companion' }
};
