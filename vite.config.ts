import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// Relative base so the built app works from any static host or subdirectory.
export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        id: '/',
        name: 'Opportunity OS',
        short_name: 'Opportunity',
        description:
          'A private, local-first command center for managing a serious professional job search.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0c0e12',
        theme_color: '#0c0e12',
        categories: ['productivity', 'business'],
        // Lets the operating system's share sheet send a job link straight into
        // the capture dialog. The parameters land on the start URL and are read
        // by `readCaptureFromLocation`; nothing is uploaded.
        share_target: {
          action: '.',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Everything is bundled locally; no runtime caching of third-party origins.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Only libraries the first paint genuinely needs are named here.
        // Recharts is deliberately absent: naming it pulls its whole dependency
        // subtree into that chunk, and it shares clsx with `cn()`, which would
        // make the entry a static importer of the chart chunk and put 110 kB of
        // charting on every cold load. Left alone, Rollup keeps it behind the
        // lazy Analytics route, which is the point of splitting it.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
})
