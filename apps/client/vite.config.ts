import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    // Allow Tailscale-bound multi-device dev. Vite 5+ defaults to denying
    // any host header that isn't localhost; the `--host 0.0.0.0` flag in
    // dev opens the listener but doesn't whitelist the host header.
    // `.ts.net` covers any Tailscale tailnet hostname; add specific
    // hostnames if you want to be stricter.
    allowedHosts: ['.ts.net', 'localhost', '127.0.0.1'],
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
          motion: ['framer-motion'],
          xstate: ['xstate'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      registerType: 'autoUpdate',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: {
        name: 'Pecking Order',
        short_name: 'Pecking Order',
        description: 'Keep your friends close...',
        theme_color: '#0f0a1a',
        background_color: '#0f0a1a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
})
