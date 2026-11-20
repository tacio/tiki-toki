import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Content-Security-Policy for production builds. GitHub Pages cannot send
 * response headers, so it is injected as a <meta> tag. Not applied in dev,
 * where Vite's HMR relies on inline scripts and websockets.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://script.google.com https://script.googleusercontent.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'tiki-toki-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
        { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
      ],
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script', // external registerSW.js, compatible with the CSP (no inline script)
      includeAssets: ['totem-icon.svg'],
      manifest: {
        name: 'Tiki-Toki 時 — Personal Time & Sink Tracker',
        short_name: 'Tiki-Toki',
        description: 'Local-first time and time-sink tracker synced to your own Google Sheet.',
        theme_color: '#0f141c',
        background_color: '#0a0e14',
        display: 'standalone',
        icons: [{ src: 'totem-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Precache the app shell only; cross-origin calls to the Apps Script bridge are never cached.
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
