import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const handleProxyError = (proxy) => {
  proxy.on('error', (err, _req, res) => {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      if (res.writeHead && !res.headersSent) {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Backend server is currently restarting or unreachable.' }))
      }
    }
  })
}

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
      // Server runs on PORT=4000, routes at /auth, /rooms, /invites (no /api prefix)
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: handleProxyError,
      },
      '/rooms': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: handleProxyError,
      },
      '/invites': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: handleProxyError,
      },
    },
  },
})
