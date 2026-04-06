import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/app.ts'],
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ['@googleapis/sheets', 'google-auth-library', 'grammy', 'telegraf'],
  outDir: 'dist',
  skipNodeModulesBundle: true,
  bundle: true,
});
