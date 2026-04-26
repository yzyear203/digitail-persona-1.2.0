import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 👑 补回被我漏掉的关键插件

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 👑 激活 Tailwind 引擎，样式才会生效
  ],
  base: './', // 👑 保留相对路径补丁，解决白屏问题
})
