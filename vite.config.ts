import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import stylex from '@stylexjs/unplugin';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:artifact` builds one self-contained HTML file that can be
// published as a Claude Artifact (the artifact sandbox only allows inline JS/CSS).
export default defineConfig(({ mode }) => ({
  plugins: [
    stylex.vite({
      useCSSLayers: true,
      dev: mode !== 'production' && mode !== 'artifact',
      unstable_moduleResolution: { type: 'commonJS' },
    }),
    react(),
    mode === 'artifact' ? viteSingleFile({ removeViteModuleLoader: true }) : null,
  ],
  build: {
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
  },
}));
