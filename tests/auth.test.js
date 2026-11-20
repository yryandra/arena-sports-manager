const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createApp } = require('../server')
const { createStore } = require('../services/store')
const { hashPassword, verifyPassword } = require('../services/auth')
let server, store, directory, base, passwordHash
const password = 'A long test passphrase 2026!'
async function request(route, { method = 'GET', body, cookie, csrf, origin, marker = true } = {}) {
  const response = await fetch(base + route, { method, headers: {
    'Content-Type': 'application/json', Origin: origin || base,
    ...(marker ? { 'X-Arena-Request': '1' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, headers: response.headers, body: await response.json() }
}
async function signIn() {
  const response = await request('/api/auth/login', { method: 'POST', body: { username: 'test-admin', password } })
  assert.equal(response.status, 200)
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: response.body.data.csrf, response }
}
before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arena-auth-'))
  store = await createStore({ file: path.join(directory, 'demo.json') })
  passwordHash = await hashPassword(password)
  server = createApp(store, { auth: { username: 'test-admin', passwordHash, secure: false } }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await store.close()
  await fs.unlink(path.join(directory, 'demo.json'))
  await fs.rmdir(directory)
})
test('passwords use salted scrypt hashes and reject invalid credentials', async () => {
  assert.notEqual(await hashPassword(password), passwordHash)
  assert.equal(await verifyPassword(password, passwordHash), true)
  assert.equal(await verifyPassword('wrong', passwordHash), false)
  assert.equal(await verifyPassword({}, passwordHash), false)
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'test-admin', password: 'wrong' } })).status, 401)
})
test('public reads work while all resource mutations require authentication', async () => {
  for (const resource of ['athletes', 'events', 'results']) {
    const list = await request(`/api/${resource}`)
    assert.equal(list.status, 200)
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const suffix = method === 'POST' ? '' : `/${list.body.data[0]._id}`
      assert.equal((await request(`/api/${resource}${suffix}`, { method, body: { name: 'Unauthorized' } })).status, 401)
    }
  }
  assert.equal((await request('/api/auth/session')).body.data.authenticated, false)
})
test('login sets HttpOnly SameSite cookie; writes require both session and CSRF token', async () => {
  const { cookie, csrf, response } = await signIn()
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i)
  assert.match(response.headers.get('set-cookie'), /SameSite=Strict/i)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal((await request('/api/auth/session', { cookie })).body.data.authenticated, true)
  const athlete = { name: 'Authenticated Tester', sport: 'Athletics', country: 'Saudi Arabia', age: 24 }
  assert.equal((await request('/api/athletes', { method: 'POST', cookie, body: athlete })).status, 403)
  assert.equal((await request('/api/athletes', { method: 'POST', cookie, csrf: 'wrong', body: athlete })).status, 403)
  const created = await request('/api/athletes', { method: 'POST', cookie, csrf, body: athlete })
  assert.equal(created.status, 201)
  assert.equal((await request(`/api/athletes/${created.body.data._id}`, { method: 'DELETE', cookie, csrf })).status, 200)
})
test('cross-origin login and writes are rejected even with a valid session', async () => {
  assert.equal((await request('/api/auth/login', { method: 'POST', origin: 'https://untrusted.example', body: { username: 'test-admin', password } })).status, 403)
  assert.equal((await request('/api/auth/login', { method: 'POST', marker: false, body: { username: 'test-admin', password } })).status, 403)
  const { cookie, csrf } = await signIn()
  assert.equal((await request('/api/athletes', { method: 'POST', cookie, csrf, origin: 'https://untrusted.example', body: {} })).status, 403)
})
test('logout revokes the server session and tampered cookies are rejected', async () => {
  const { cookie, csrf } = await signIn()
  assert.equal((await request('/api/auth/logout', { method: 'POST', cookie, csrf })).status, 200)
  assert.equal((await request('/api/auth/session', { cookie })).body.data.authenticated, false)
  assert.equal((await request('/api/auth/session', { cookie: 'arena_session=' + 'a'.repeat(64) })).body.data.authenticated, false)
  assert.equal((await request('/api/athletes', { method: 'POST', cookie, csrf, body: {} })).status, 401)
})
test('repeated sign-in attempts are limited', async () => {
  let last
  for (let i = 0; i < 21; i++) last = await request('/api/auth/login', { method: 'POST', body: { username: 'test-admin', password: 'wrong' } })
  assert.equal(last.status, 429)
  assert.ok(Number(last.headers.get('retry-after')) > 0)
})
