const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createStore } = require('../services/store')
const { createApp } = require('../server')
const { hashPassword } = require('../services/auth')
let store, server, base, directory, cookie, csrf
async function request(route, method = 'GET', body) {
  const response = await fetch(`${base}/api${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: base, 'X-Arena-Request': '1', ...(cookie ? { Cookie: cookie, 'X-CSRF-Token': csrf } : {}) },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  })
  return { status: response.status, ...(await response.json()) }
}
before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arena-test-'))
  store = await createStore({ file: path.join(directory, 'demo.json') })
  server = createApp(store, { auth: { username: 'test-admin', passwordHash: await hashPassword('only-a-test-password'), secure: false } }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, 'X-Arena-Request': '1' }, body: JSON.stringify({ username: 'test-admin', password: 'only-a-test-password' }) })
  assert.equal(response.status, 200)
  cookie = response.headers.get('set-cookie').split(';')[0]
  csrf = (await response.json()).data.csrf
})
after(async () => {
  if (server) {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
  if (store) await store.close()
  if (directory) {
    await fs.unlink(path.join(directory, 'demo.json'))
    await fs.rmdir(directory)
  }
})

test('health, seeded records, metadata and query filters', async () => {
  assert.equal((await request('/health')).mode, 'demo')
  assert.equal((await request('/athletes')).count, 28)
  assert.equal((await request('/events')).count, 8)
  assert.equal((await request('/results')).count, 12)
  assert.equal((await request('/meta')).data.sports.length, 6)
  const filtered = await request('/athletes?sport=Swimming&search=martin')
  assert.equal(filtered.count, 1)
  assert.equal(filtered.data[0].name, 'Léa Martin')
})

test('complete registration, competition, result and deletion lifecycle', async () => {
  const created = await request('/athletes', 'POST', {
    name: 'Interview Demo',
    sport: 'Athletics',
    country: 'Saudi Arabia',
    age: 24,
  })
  assert.equal(created.status, 201)
  const athlete = created.data
  const competition = await request('/events', 'POST', {
    name: 'Interview 100m Final',
    sport: 'Athletics',
    discipline: '100m final',
    location: 'Demo Stadium',
    date: '2026-11-20',
    time: '18:30',
    capacity: 8,
    unit: 's',
    ranking: 'asc',
    participants: [athlete._id],
  })
  assert.equal(competition.status, 201)
  const eventId = competition.data._id
  assert.equal(
    (await request('/results', 'POST', { eventId, athleteId: athlete._id, performance: 10.4 }))
      .status,
    400,
    'scheduled events cannot receive results',
  )
  assert.equal((await request(`/events/${eventId}`, 'PATCH', { status: 'Live' })).status, 200)
  const payload = { eventId, athleteId: athlete._id, performance: 10.4, status: 'Provisional' }
  const recorded = await request('/results', 'POST', payload)
  assert.equal(recorded.status, 201)
  assert.equal(
    (await request('/results', 'POST', payload)).status,
    409,
    'duplicate result rejected',
  )
  assert.equal(
    (await request(`/events/${eventId}`, 'DELETE')).status,
    409,
    'linked results protected',
  )
  assert.equal((await request(`/athletes/${athlete._id}`, 'DELETE')).status, 409)
  assert.equal((await request(`/events/${eventId}`, 'PATCH', { participants: [] })).status, 409)
  assert.equal((await request(`/events/${eventId}`, 'PATCH', { unit: 'm' })).status, 409)
  assert.equal((await request(`/events/${eventId}`, 'PATCH', { status: 'Scheduled' })).status, 409)
  assert.equal(
    (await request(`/athletes/${athlete._id}`, 'PATCH', { sport: 'Swimming' })).status,
    409,
  )
  const updated = await request(`/results/${recorded.data._id}`, 'PATCH', {
    performance: 10.31,
    status: 'Published',
  })
  assert.equal(updated.data.performance, 10.31)
  assert.equal(updated.status, 200)
  assert.equal((await request(`/results/${recorded.data._id}`, 'GET')).data.status, 'Published')
  assert.equal((await request(`/results/${recorded.data._id}`, 'DELETE')).status, 200)
  assert.equal(
    (await request(`/athletes/${athlete._id}`, 'DELETE')).status,
    409,
    'start list also protects athletes',
  )
  assert.equal((await request(`/events/${eventId}`, 'DELETE')).status, 200)
  assert.equal((await request(`/athletes/${athlete._id}`, 'DELETE')).status, 200)
})

test('validation rejects malformed IDs, invalid ages, unknown fields and impossible dates', async () => {
  assert.equal((await request('/athletes/not-an-id')).status, 400)
  assert.equal((await request('/athletes/ffffffffffffffffffffffff')).status, 404)
  assert.equal(
    (
      await request('/athletes', 'POST', {
        name: 'Invalid Age',
        age: 2,
        sport: 'Athletics',
        country: 'Saudi Arabia',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await request('/athletes', 'POST', {
        name: 'Invalid Sport',
        age: 20,
        sport: 'Invented',
        country: 'Saudi Arabia',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await request('/athletes', 'POST', {
        name: 'No Operators',
        age: 20,
        sport: 'Athletics',
        country: 'Saudi Arabia',
        $set: { status: 'Active' },
      })
    ).status,
    400,
  )
  const event = {
    name: 'Bad date',
    sport: 'Athletics',
    discipline: '100m',
    location: 'Demo',
    date: '2026-02-30',
    time: '12:00',
    capacity: 8,
    participants: [],
  }
  assert.equal((await request('/events', 'POST', event)).status, 400)
  assert.equal((await request('/unknown')).status, 404)
})

test('entry rules enforce sport, capacity, active status and uniqueness', async () => {
  const athletes = (await request('/athletes')).data
  const event = {
    name: 'Validation test',
    sport: 'Athletics',
    discipline: '100m',
    location: 'Demo',
    date: '2026-11-20',
    time: '12:00',
    capacity: 2,
    participants: [],
  }
  const run = (participants) => request('/events', 'POST', { ...event, participants })
  assert.equal((await run([athletes[4]._id])).status, 400, 'sport mismatch')
  assert.equal((await run([athletes[27]._id])).status, 400, 'inactive athlete')
  assert.equal((await run([athletes[0]._id, athletes[0]._id])).status, 400, 'duplicate entry')
  assert.equal(
    (await run(athletes.slice(0, 3).map((athlete) => athlete._id))).status,
    400,
    'capacity exceeded',
  )
  assert.equal((await run(['ffffffffffffffffffffffff'])).status, 400, 'unknown athlete')
})

test('concurrent duplicate requests only create one result', async () => {
  const event = (await request('/events')).data.find(
    (event) => event.name === 'Riyadh Athletics Grand Prix',
  )
  const payload = { eventId: event._id, athleteId: event.participants[3], performance: 10.89 }
  const responses = await Promise.all([
    request('/results', 'POST', payload),
    request('/results', 'POST', payload),
  ])
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409])
  await request(
    `/results/${responses.find((response) => response.status === 201).data._id}`,
    'DELETE',
  )
})

test('demo records survive re-opening the store', async () => {
  const athlete = (
    await request('/athletes', 'POST', {
      name: 'Persistent Athlete',
      sport: 'Tennis',
      country: 'France',
      age: 25,
    })
  ).data
  const reopened = await createStore({ file: path.join(directory, 'demo.json') })
  assert.equal((await reopened.get('athletes', athlete._id)).name, 'Persistent Athlete')
  await reopened.close()
  await request(`/athletes/${athlete._id}`, 'DELETE')
})

test('Pug renders live server-side counts and project information', async () => {
  const response = await fetch(`${base}/about`)
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /<strong>28<\/strong>/)
  assert.match(html, /rendered on the server using Pug/)
  assert.match(html, /not affiliated with BORNAN or FIFA/)
})
