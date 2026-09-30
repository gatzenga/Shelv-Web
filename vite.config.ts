import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import { createManualChunks } from './src/manual-chunks'

// https://vitejs.dev/config/
// In development the backend (server/index.ts) runs separately
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
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
