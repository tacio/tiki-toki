import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on all local IPs so mobile testing on LAN works out of the box
    port: 5173,
  },
});
