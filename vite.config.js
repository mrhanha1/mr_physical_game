// vite.config.js
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl(), // Self-signed HTTPS — required for WebXR on Quest
  ],
  server: {
    https: true,
    host: true,      // Expose on LAN so Quest 3 can connect
    port: 5173,
    open: false,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
});
