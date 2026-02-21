import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    server: {
      host: process.env.HTML_EDITOR_DEV_HOST || undefined,
      port: process.env.HTML_EDITOR_DEV_PORT ? Number(process.env.HTML_EDITOR_DEV_PORT) : undefined
    }
  }
})
