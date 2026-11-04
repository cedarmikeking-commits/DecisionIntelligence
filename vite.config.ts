import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // 后端 server/ 与嵌入式数据库 .pgdata 不属于前端模块图，
        // 但数据库每次写入都会改动文件，若不排除会触发浏览器整页刷新。
        watch: {
          ignored: ['**/.pgdata/**', '**/server/**', '**/dist/**'],
        },
        proxy: {
          '/api': {
            target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
            changeOrigin: true,
          }
        }
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
