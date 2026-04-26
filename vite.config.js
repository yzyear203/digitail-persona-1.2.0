import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 👑 体验升维：强制使用相对路径，彻底解决找不到静态资源的问题
})
