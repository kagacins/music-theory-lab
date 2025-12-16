import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Base path: '/' for most deployments (Netlify, custom domain)
  // Set VITE_BASE_PATH env var to override (e.g., '/Music-Theory-Lab/' for GitHub Pages)
  base: process.env.VITE_BASE_PATH || '/',

  // Use index.html in root as entry point
  root: '.',

  // Public directory for static assets
  publicDir: 'public',

  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Generate sourcemaps for debugging
    sourcemap: true,
    // Ensure all assets are bundled
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    open: true, // Auto-open browser
    cors: true
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@spotify/basic-pitch',
      'tonal'
    ]
  },

  // Force single version of TensorFlow.js to avoid duplicate kernel registrations
  resolve: {
    dedupe: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-backend-cpu',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow/tfjs-converter',
      '@tensorflow/tfjs-layers',
      '@tensorflow/tfjs-data'
    ]
  },

  // Handle large chunks from TensorFlow
  esbuild: {
    target: 'es2020'
  }
}));
