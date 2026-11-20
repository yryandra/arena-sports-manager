const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = () => import('../client/src/lib/format.ts')
test('time-based ranking uses lower scores and competition ties (1, 1, 3)', async () => {
  const { rank } = await load()
  const scores = [10.2, 10.2, 10.4].map((performance, index) => ({
    _id: String(index),
    eventId: 'race',
    performance,
    status: 'Published',
  }))
  assert.deepEqual(
    scores.map((score) => rank(score, scores, { ranking: 'asc' })),
    [1, 1, 3],
  )
})
test('distance and points rank highest first, with publication and event isolation', async () => {
  const { rank } = await load()
  const scores = [
    { eventId: 'jump', performance: 7.8, status: 'Published' },
    { eventId: 'jump', performance: 7.4, status: 'Published' },
    { eventId: 'jump', performance: 8.1, status: 'Provisional' },
    { eventId: 'other', performance: 9, status: 'Published' },
  ]
  assert.equal(rank(scores[0], scores, { ranking: 'desc' }), 1)
  assert.equal(rank(scores[1], scores, { ranking: 'desc' }), 2)
  assert.equal(rank(scores[2], scores, { ranking: 'desc' }), 1)
})
