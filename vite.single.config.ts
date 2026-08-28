/**
 * Builds one self-contained HTML file on DEMO data, safe to share.
 *
 * The blanked VITE_URL_* / VITE_SHEET_ID below are not decoration. Vite inlines every
 * VITE_* value it finds in .env.local, so forcing VITE_DATA_SOURCE alone still compiled
 * the real published-sheet URLs into a file whose entire purpose is to be shared. They
 * are explicitly emptied here so a shareable build cannot carry a link to real data.
 *
 * `npm run verify:single` checks the output and fails if a spreadsheet URL is present.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const blank = (k: string) => [`import.meta.env.${k}`, JSON.stringify('')] as const;

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: {
    'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('demo'),
    ...Object.fromEntries([
      blank('VITE_URL_APPOINTMENTS'), blank('VITE_URL_NOTES'),
      blank('VITE_URL_CLAIMS'), blank('VITE_URL_PATIENTS'),
      blank('VITE_SHEET_ID'), blank('VITE_TASK_WRITE_URL'), blank('VITE_FOLLOWUP_TOKEN'),
    ]),
  },
  build: { outDir: 'dist-single', target: 'es2020', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
