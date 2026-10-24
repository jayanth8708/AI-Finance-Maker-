import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Optional: proxy /api to backend during dev
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
