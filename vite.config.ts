import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // bind to all interfaces so Docker can expose the port
    // Falls back to 5173 for local/Docker use; honors PORT so tooling that
    // assigns an alternate port (e.g. when 5173 is already taken) still works.
    port: Number(process.env.PORT) || 5173,
  },
})
