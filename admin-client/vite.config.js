import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // Matches your current port
    proxy: {
      // Catch any request starting with "/api"
      '/api': {
        target: 'http://localhost:5001', // Forward to Backend Docker Container
        changeOrigin: true,
        secure: false,
        // CRITICAL: Remove "/api" before sending to backend
        // So "/api/admin/hotels" becomes "/admin/hotels"
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})