const fs = require('node:fs/promises')
const path = require('node:path')
const readline = require('node:readline')
const { hashPassword } = require('../services/auth')

function hiddenPrompt(label) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('Run this command in your own interactive terminal.'))
    process.stdout.write(label)
    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    let value = ''
    function finish() { process.stdin.off('keypress', onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n') }
    function onKey(text, key = {}) {
      if (key.ctrl && key.name === 'c') { finish(); reject(new Error('Cancelled.')); return }
      if (key.name === 'return') { finish(); resolve(value); return }
      if (key.name === 'backspace') { value = value.slice(0, -1); return }
      if (!key.ctrl && !key.meta && text && !/[\x00-\x1f\x7f]/.test(text)) value += text
    }
    process.stdin.on('keypress', onKey)
  })
}
async function main() {
  const password = await hiddenPrompt('Choose your ARENA admin password (at least 14 characters; input is hidden): ')
  if (password.length < 14 || password.length > 256) throw new Error('Use between 14 and 256 characters.')
  const confirmation = await hiddenPrompt('Enter the password again: ')
  if (password !== confirmation) throw new Error('Passwords did not match. Nothing was changed.')
  const hash = await hashPassword(password)
  const file = path.join(__dirname, '../.env')
  let source = await fs.readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error })
  for (const [key, value] of Object.entries({ ADMIN_USERNAME: 'yryandra', ADMIN_PASSWORD_HASH: hash })) {
    const line = `${key}=${value}`
    const expression = new RegExp(`^${key}=.*$`, 'm')
    source = expression.test(source) ? source.replace(expression, line) : `${source.trimEnd()}\n${line}\n`
  }
  await fs.writeFile(file, source, { mode: 0o600 })
  console.log('Administrator configured as yryandra. Only the password hash was saved to the ignored .env file. Restart the development server to apply it.')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
