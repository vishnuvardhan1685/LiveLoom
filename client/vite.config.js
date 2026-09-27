import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Server runs on PORT=4000, routes at /auth and /rooms (no /api prefix)
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/rooms': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/invites': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
