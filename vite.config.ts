import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['BASE_PATH', 'VITE_']);
  return {
  plugins: [react()],
  /**
   * Set BASE_PATH="/<repo-name>/" when deploying to GitHub Pages from a project repo.
   * Vercel, Netlify and a user/org Pages site all work with the default "/".
   */
  base: env.BASE_PATH ?? '/',
  build: { outDir: 'dist', sourcemap: mode !== 'production', target: 'es2020' },
  };
});
