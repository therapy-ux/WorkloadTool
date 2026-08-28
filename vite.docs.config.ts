/**
 * Builds the deployable site as ONE file at docs/index.html.
 *
 * Why a prebuilt folder instead of a GitHub Actions workflow: Pages can serve straight
 * from a branch folder, which means the whole site can be uploaded through the GitHub
 * website with no build step, no Actions, and no command line. A single file also
 * sidesteps base-path problems — nothing to resolve, so it works under any repo name.
 *
 * The blanked VITE_* are load-bearing: vite inlines anything in a local .env file, and
 * this output is published, so no sheet link may ever be compiled into it.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const blank = (k: string) => [`import.meta.env.${k}`, JSON.stringify('')] as const;

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  define: Object.fromEntries([
    blank('VITE_DATA_SOURCE'), blank('VITE_URL_APPOINTMENTS'), blank('VITE_URL_NOTES'),
    blank('VITE_URL_CLAIMS'), blank('VITE_URL_PATIENTS'), blank('VITE_SHEET_ID'),
    blank('VITE_TASK_WRITE_URL'),
  ]),
  build: { outDir: 'docs', emptyOutDir: false, target: 'es2020',
           assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
