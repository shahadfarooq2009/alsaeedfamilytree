import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vite dev/HMR executes transformed modules via eval.
 * Without `'unsafe-eval'` in script-src, Chrome reports a CSP violation and
 * some dev features can fail. Production builds do not rely on eval.
 */
const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws: wss: http://127.0.0.1:8000 http://localhost:8000 http://127.0.0.1:5173 http://localhost:5173",
  "worker-src 'self' blob:",
].join('; ')

function devContentSecurityPolicy(): Plugin {
  return {
    name: 'family-tree-dev-csp',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Content-Security-Policy', DEV_CSP)
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [devContentSecurityPolicy(), react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
