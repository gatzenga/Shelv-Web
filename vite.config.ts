import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import { version } from './package.json'
import { createManualChunks } from './src/manual-chunks'

// https://vitejs.dev/config/
// In development the backend (server/index.ts) runs separately
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  // The image gets its version from the workflow, without it the version of
  // package.json counts
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || version),
  },
  base: './',
  server: {
    proxy: {
      '/rest': backendUrl,
      '/api': backendUrl,
      '/env-config.js': backendUrl,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: createManualChunks,
      },
    },
  },
})
