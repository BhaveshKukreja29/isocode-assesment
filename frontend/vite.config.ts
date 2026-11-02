import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': 'http://localhost:8000' } },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [{ name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|scheduler|@tanstack)/ }],
        },
      },
    },
  },
})
