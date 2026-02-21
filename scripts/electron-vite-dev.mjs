import { spawn } from 'node:child_process'

function parseArgs(argv) {
  const out = []
  let host
  let port

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]

    if (a === '--host') {
      host = argv[i + 1]
      i++
      continue
    }

    if (a.startsWith('--host=')) {
      host = a.slice('--host='.length)
      continue
    }

    if (a === '--port') {
      port = argv[i + 1]
      i++
      continue
    }

    if (a.startsWith('--port=')) {
      port = a.slice('--port='.length)
      continue
    }

    out.push(a)
  }

  return { out, host, port }
}

const { out, host, port } = parseArgs(process.argv.slice(2))

const env = { ...process.env }
// Some IDE/debugger configurations set this, which breaks Electron startup
// by running Electron as plain Node.
delete env.ELECTRON_RUN_AS_NODE
if (host) env.HTML_EDITOR_DEV_HOST = String(host)
if (port) env.HTML_EDITOR_DEV_PORT = String(port)

const child = spawn('electron-vite', ['dev', ...out], {
  stdio: 'inherit',
  env
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
