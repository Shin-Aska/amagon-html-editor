import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
import {dirname, resolve} from 'node:path'
import {frameworkFontCors} from './scripts/frameworkFontCors'
import {monacoCancellation} from './scripts/monacoCancellation'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [react(), frameworkFontCors(), monacoCancellation()],
  root: './src/renderer',
  publicDir: '../../public',
  server: {
    fs: {
      allow: [resolve(__dirname, 'src')]
    }
  },
  build: {
    outDir: '../../dist'
  }
})
