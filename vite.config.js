import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages (change 'Music-Theory-Lab' to your actual repo name)
  base: '/Music-Theory-Lab/',

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

  // Handle large chunks from TensorFlow
  esbuild: {
    target: 'es2020'
  }
});
