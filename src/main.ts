import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
mount(App, { target: document.getElementById('app')! });
// Vite removes this branch and the dynamic module entirely from production builds.
if (import.meta.env.DEV && import.meta.env.MODE === 'bridge') {
  let dispose: (() => void) | undefined;
  let disposed = false;
  void import('./dev/browser-adapter').then(({ startBrowserAdapter }) => {
    if (!disposed) dispose = startBrowserAdapter();
  }).catch(() => console.warn('[Local bridge] Adapter unavailable; the application remains usable.'));
  import.meta.hot?.dispose(() => { disposed = true; dispose?.(); });
}
