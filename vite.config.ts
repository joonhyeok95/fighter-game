
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'fighter-game-semk.onrender.com'
    ]
  },
  build: {
    chunkSizeWarningLimit: 2000
  }
});
