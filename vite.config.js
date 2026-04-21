import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/api': {
        target: 'https://ark.cn-beijing.volces.com', // 👈 关键：换成了带 cn-beijing 的地址
        changeOrigin: true,
      }
    }
  }
})