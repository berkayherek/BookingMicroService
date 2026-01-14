import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This allows you to run on a specific port locally if you want
    // But Render ignores this for Static Sites
    port: 5173, 
    
    // PROXY: Only works locally (npm run dev)
    // We point this to your Gateway (Port 5000)
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Always target Gateway locally
        changeOrigin: true,
        secure: false,
        // Removes '/api' so /api/hotel/search -> /hotel/search
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})