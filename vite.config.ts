import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({ plugins: [svelte()], build:{rollupOptions:{output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js']}}}} });
