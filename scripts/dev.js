const { spawn } = require('node:child_process')
const path = require('node:path')
const root = path.join(__dirname, '..')
const children = [
  spawn(process.execPath, ['--watch', 'server.js'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(
    process.execPath,
    [
      path.join(root, 'client/node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--strictPort',
    ],
    { cwd: path.join(root, 'client'), stdio: 'inherit', env: process.env },
  ),
]
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  process.exitCode = code
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message)
    stop(1)
  })
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0)
  })
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
