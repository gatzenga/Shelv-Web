// Local test without Docker: `pnpm dev`
//
// Starts the backend (server/index.ts) and the Vite dev server together.
// Both reload by themselves when a file changes. The configuration is read
// from .env with the same variables as docker-compose.yml. NAVIDROME_URL must
// be reachable from this machine, the internal docker IP is not.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const [major] = process.versions.node.split('.').map(Number)
if (major < 24) {
  console.error(`Node.js 24 or newer is required, this is ${process.version}`)
  process.exit(1)
}

if (!existsSync('.env')) {
  console.error(
    'No .env file found. Create it with the variables of docker-compose.yml.',
  )
  process.exit(1)
}

process.loadEnvFile('.env')

// not 8080, that port is often taken on a Mac (e.g. by SABnzbd)
const backendPort = '8480'

const processes = [
  {
    name: 'backend',
    color: 36,
    command: process.execPath,
    args: ['--watch', 'server/index.ts'],
    // local defaults that differ from the container
    env: {
      CACHE_DIR: './cache',
      CONFIG_DIR: './config',
      LOGS_DIR: './logs',
      DIST_DIR: './dist',
      PORT: backendPort,
    },
  },
  {
    name: 'frontend',
    color: 35,
    command: process.execPath,
    // NO_OPEN=1 keeps the browser closed
    args: [
      'node_modules/vite/bin/vite.js',
      ...(process.env.NO_OPEN ? [] : ['--open']),
    ],
    env: { BACKEND_URL: `http://127.0.0.1:${backendPort}` },
  },
]

const children = processes.map(({ name, color, command, args, env }) => {
  const child = spawn(command, args, {
    // the local port, cache and dist folders always apply in development
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `
  const print = (stream) => (data) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) stream.write(`${prefix}${line}\n`)
    }
  }

  child.stdout.on('data', print(process.stdout))
  child.stderr.on('data', print(process.stderr))
  child.on('exit', (code) => {
    console.log(`${prefix}stopped (${code ?? 'signal'})`)
    shutdown()
  })

  return child
})

let isShuttingDown = false

function shutdown() {
  if (isShuttingDown) return
  isShuttingDown = true

  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(0), 1000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
