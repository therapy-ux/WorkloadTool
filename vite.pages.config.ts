/**
 * The GitHub Pages build. No data source is compiled in — the app asks for the links
 * on first run and keeps them in the browser.
 *
 * The blanked VITE_URL_* are load-bearing: vite inlines anything it finds in a local
 * .env file, so without these a developer's own .env.local would silently bake real
 * sheet links into a public bundle.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const blank = (k: string) => [`import.meta.env.${k}`, JSON.stringify('')] as const;

export default defineConfig({
  plugins: [react()],
  define: Object.fromEntries([
    blank('VITE_DATA_SOURCE'), blank('VITE_URL_APPOINTMENTS'), blank('VITE_URL_NOTES'),
    blank('VITE_URL_CLAIMS'), blank('VITE_URL_PATIENTS'), blank('VITE_SHEET_ID'),
    blank('VITE_TASK_WRITE_URL'),
  ]),
  base: process.env.BASE_PATH || '/',
  build: { outDir: 'dist', target: 'es2020' },
});
