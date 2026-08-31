import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    emptyOutDir: true, // 构建前清空 dist，防止历史产物累积为孤儿（部署走 CI 全新构建，无兼容需求）
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // React 全家桶（含 react-router）：首屏核心，长期不换，缓存友好
          if (id.includes('/react')) return 'react'
          // Supabase 数据层：独立大依赖，单独缓存
          if (id.includes('@supabase')) return 'supabase'
          // Lucide 图标：独立且按需导入，单独一块
          if (id.includes('lucide-react')) return 'lucide'
          // 其余依赖兜底
          return 'vendor'
        },
      },
    },
  },
})
