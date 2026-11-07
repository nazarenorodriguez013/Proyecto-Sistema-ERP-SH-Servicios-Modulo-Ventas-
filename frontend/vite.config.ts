import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// En desarrollo la API es el backend Laravel: cd backend && php artisan serve (puerto 8000)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_DEV ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
