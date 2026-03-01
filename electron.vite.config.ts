import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          canvas: resolve(__dirname, 'src/renderer/canvas.html')
        }
      }
    },
    plugins: [react()],
    server: {
      host: process.env.HTML_EDITOR_DEV_HOST || undefined,
      port: process.env.HTML_EDITOR_DEV_PORT ? Number(process.env.HTML_EDITOR_DEV_PORT) : undefined
    }
  }
})
