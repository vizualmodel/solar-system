import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig(({ command, mode }) => {
  const bridge = command === 'serve' && mode === 'bridge';
  const token = bridge ? loadEnv(mode, process.cwd(), 'SOLAR_BRIDGE_').SOLAR_BRIDGE_TOKEN : '';
  if (bridge && !/^[A-Za-z0-9_-]{43,128}$/.test(token ?? '')) throw new Error('Run npm run bridge:init before npm run dev:bridge.');
  return {
    plugins: [svelte()],
    ...(bridge ? { server: { host: '127.0.0.1', port: 5173, strictPort: true }, define: { 'import.meta.env.SOLAR_BRIDGE_TOKEN': JSON.stringify(token) } } : {}),
    build:{rollupOptions:{output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js']}}}},
  };
});
