require('dotenv').config({ quiet: true })
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createStore } = require('../services/store')
const { createApp } = require('../server')
const { hashPassword } = require('../services/auth')

async function main() {
  if (!process.env.MONGODB_DB) throw new Error('Set MONGODB_DB to the dedicated ARENA database first.')
  const store = await createStore({ mode: 'mongodb', uri: process.env.MONGODB_URI })
  const password = crypto.randomBytes(32).toString('hex')
  const auth = { username: 'integration-check', passwordHash: await hashPassword(password), secure: false }
  const app = createApp(store, { auth })
  await app.locals.ready
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  let cookie, csrf, athleteId, eventId, resultId
  async function request(route, method = 'GET', body) {
    const response = await fetch(`${base}/api${route}`, { method, headers: { Origin: base, 'X-Arena-Request': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie, 'X-CSRF-Token': csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const value = await response.json()
    return { status: response.status, headers: response.headers, ...value }
  }
  try {
    const login = await request('/auth/login', 'POST', { username: auth.username, password })
    assert.equal(login.status, 200)
    cookie = login.headers.get('set-cookie').split(';')[0]
    csrf = login.data.csrf
    const athlete = await request('/athletes', 'POST', { name: 'Deployment Verification', sport: 'Athletics', country: 'Saudi Arabia', age: 25 })
    assert.equal(athlete.status, 201); athleteId = athlete.data._id
    const event = await request('/events', 'POST', { name: 'Deployment Verification Event', sport: 'Athletics', discipline: '100m final', location: 'Test venue', date: '2026-11-20', time: '18:00', capacity: 8, unit: 's', ranking: 'asc', status: 'Live', participants: [athleteId] })
    assert.equal(event.status, 201); eventId = event.data._id
    const result = await request('/results', 'POST', { eventId, athleteId, performance: 10.1, status: 'Published' })
    assert.equal(result.status, 201); resultId = result.data._id
    assert.equal((await request(`/athletes/${athleteId}`, 'DELETE')).status, 409)
    const otherApp = createApp(store, { auth })
    await otherApp.locals.ready
    const otherServer = otherApp.listen(0, '127.0.0.1')
    await new Promise(resolve => otherServer.once('listening', resolve))
    try {
      const response = await fetch(`http://127.0.0.1:${otherServer.address().port}/api/auth/session`, { headers: { Cookie: cookie } })
      assert.equal((await response.json()).data.authenticated, true, 'sessions must work across function instances')
      assert.equal((await store.get('results', resultId)).performance, 10.1)
    } finally { otherServer.closeAllConnections(); await new Promise(resolve => otherServer.close(resolve)) }
    console.log('PASS: Atlas CRUD, protected relationships, persisted results and sessions shared across app instances.')
  } finally {
    // Delete only the disposable records created by this check, in dependency order.
    if (resultId) await store.remove('results', resultId)
    if (eventId) await store.remove('events', eventId)
    if (athleteId) await store.remove('athletes', athleteId)
    if (cookie) await request('/auth/logout', 'POST')
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await store.close()
  }
}
main().catch(error => { console.error('MongoDB verification failed:', error.name, error.code || ''); process.exitCode = 1 })
