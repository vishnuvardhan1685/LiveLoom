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
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor') || id.includes('y-monaco') || id.includes('@monaco-editor')) {
            return 'monaco'
          }
          if (id.includes('yjs') || id.includes('y-websocket') || id.includes('y-indexeddb') || id.includes('y-protocols')) {
            return 'yjs'
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
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
