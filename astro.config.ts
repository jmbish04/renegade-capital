import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@tailwindcss/vite';

// https://astro.build/config
// IMPORTANT: output must be 'static' — the custom _worker.ts serves pages via env.ASSETS.fetch().
// Do NOT use @astrojs/cloudflare adapter — static files are served by the Worker Assets binding.
export default defineConfig({
  site: 'https://renegade-capital.hacolby.workers.dev',
  srcDir: './src/frontend',
  output: 'static',
  vite: {
    plugins: [tailwind()],
  },
  integrations: [react()],
});
