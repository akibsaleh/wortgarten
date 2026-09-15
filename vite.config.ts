import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['audio/**/*.ogg'],
      manifest: {
        name: 'Wortgarten',
        short_name: 'Wortgarten',
        description: 'Learn the 1,000 most important German words',
        theme_color: '#3F7D5D',
        background_color: '#FBFAF7',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ogg,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /audio\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: { maxEntries: 2000, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
