const express = require('express')
const mongoose = require('mongoose')
const fields = {
  athletes: ['name', 'sport', 'country', 'age', 'status'],
  events: [
    'name',
    'sport',
    'discipline',
    'location',
    'date',
    'time',
    'status',
    'capacity',
    'unit',
    'ranking',
    'participants',
  ],
  results: ['eventId', 'athleteId', 'performance', 'status'],
}
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status })
}
async function validateRelations(collection, value, id, store) {
  const events = await store.all('events')
  const results = await store.all('results')
  if (collection === 'events') {
    if (!Array.isArray(value.participants)) fail('Participants must be an array.')
    if (new Set(value.participants).size !== value.participants.length)
      fail('An athlete can only be entered once.')
    if (value.participants.length > value.capacity) fail('Entries exceed the competition capacity.')
    for (const athleteId of value.participants) {
      const athlete =
        mongoose.isObjectIdOrHexString(athleteId) && (await store.get('athletes', athleteId))
      if (!athlete || athlete.sport !== value.sport)
        fail('All entrants must exist and compete in this sport.')
      if (athlete.status !== 'Active') fail('Only active athletes can enter competitions.')
    }
    const existingResults = results.filter((result) => result.eventId === id)
    if (existingResults.length && value.status === 'Scheduled')
      fail('A competition with results cannot be moved back to Scheduled.', 409)
    if (existingResults.some((result) => !value.participants.includes(result.athleteId)))
      fail('Remove an athlete’s results before removing their entry.', 409)
    const previous = id && (await store.get('events', id))
    if (
      existingResults.length &&
      (previous.unit !== value.unit || previous.ranking !== value.ranking)
    )
      fail('Remove existing results before changing the scoring system.', 409)
  }
  if (collection === 'athletes' && id) {
    const entered = events.filter((event) => event.participants.includes(id))
    if (
      entered.some((event) => event.sport !== value.sport) ||
      (entered.length && value.status !== 'Active')
    )
      fail('Remove competition entries before changing sport or deactivating this athlete.', 409)
  }
  if (collection === 'results') {
    const event = events.find((event) => event._id === value.eventId)
    const athlete =
      mongoose.isObjectIdOrHexString(value.athleteId) &&
      (await store.get('athletes', value.athleteId))
    if (!event || !athlete) fail('Choose an existing competition and athlete.')
    if (!event.participants.includes(value.athleteId))
      fail('The athlete must be entered in this competition.')
    if (event.status === 'Scheduled') fail('Start the competition before recording results.')
    if (
      results.some(
        (result) =>
          result.eventId === value.eventId &&
          result.athleteId === value.athleteId &&
          result._id !== id,
      )
    )
      fail('This athlete already has a result in this competition.', 409)
  }
}
function createResourceRouter(collection, store) {
  const router = express.Router()
  // Serialize relationship checks with writes across all resource routes.
  const mutate = (operation) => {
    const task = (store.mutations || Promise.resolve()).catch(() => {}).then(operation)
    store.mutations = task
    return task
  }
  router.get('/', async (req, res) => {
    const records = await store.all(collection)
    const search = String(req.query.search || '').toLowerCase()
    const data = records.filter(
      (record) =>
        (!search ||
          fields[collection].some(
            (field) =>
              typeof record[field] === 'string' && record[field].toLowerCase().includes(search),
          )) &&
        (!req.query.sport || record.sport === req.query.sport) &&
        (!req.query.status || record.status === req.query.status),
    )
    res.json({ success: true, count: data.length, data })
  })
  router.param('id', (req, res, next, id) => {
    if (!mongoose.isObjectIdOrHexString(id))
      return res.status(400).json({ success: false, message: 'Invalid record ID.' })
    next()
  })
  router.get('/:id', async (req, res) => {
    const data = await store.get(collection, req.params.id)
    if (!data) fail('Record not found.', 404)
    res.json({ success: true, data })
  })
  const save = async (req, res) =>
    mutate(async () => {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
        fail('A JSON object is required.')
      if (Object.keys(req.body).some((key) => !fields[collection].includes(key)))
        fail('The request contains unsupported fields.')
      const id = req.params.id
      const existing = id && (await store.get(collection, id))
      if (id && !existing) fail('Record not found.', 404)
      const value = { ...(existing || {}), ...req.body }
      if (collection === 'events' && !value.participants) value.participants = []
      await validateRelations(collection, value, id, store)
      const data = await store.save(
        collection,
        collection === 'events' ? { ...req.body, participants: value.participants } : req.body,
        id,
      )
      res.status(id ? 200 : 201).json({ success: true, data })
    })
  router.post('/', save)
  router.patch('/:id', save)
  router.delete('/:id', async (req, res) =>
    mutate(async () => {
      const id = req.params.id
      if (!(await store.get(collection, id))) fail('Record not found.', 404)
      const results = await store.all('results')
      if (
        results.some(
          (result) =>
            (collection === 'athletes' && result.athleteId === id) ||
            (collection === 'events' && result.eventId === id),
        )
      )
        fail('Remove the linked results before deleting this record.', 409)
      if (
        collection === 'athletes' &&
        (await store.all('events')).some((event) => event.participants.includes(id))
      )
        fail('Remove competition entries before deleting this athlete.', 409)
      await store.remove(collection, id)
      res.json({ success: true, message: 'Record deleted.' })
    }),
  )
  return router
}
module.exports = { createResourceRouter }
