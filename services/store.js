const fs = require('node:fs/promises')
const path = require('node:path')
const mongoose = require('mongoose')
const seed = require('../data/seed')
const connectDB = require('../config/db')
const models = {
  athletes: require('../models/Athlete'),
  events: require('../models/Event'),
  results: require('../models/Result'),
}
const plain = (value) => JSON.parse(JSON.stringify(value))

async function createStore({
  mode = 'demo',
  file = path.join(__dirname, '../data/demo.json'),
  uri,
} = {}) {
  if (!['demo', 'mongodb'].includes(mode)) throw new Error('STORAGE_MODE must be demo or mongodb.')
  let data
  let writes = Promise.resolve()
  const persist = async (next) => {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temporary = `${file}.tmp`
    await fs.writeFile(temporary, JSON.stringify(next, null, 2))
    await fs.rename(temporary, file)
    data = next
  }
  if (mode === 'mongodb') {
    await connectDB(uri)
    await models.results.init()
  } else {
    try {
      data = JSON.parse(await fs.readFile(file, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await persist(seed())
    }
  }
  return {
    mode,
    async all(collection) {
      return mode === 'mongodb'
        ? plain(await models[collection].find().lean())
        : plain(data[collection])
    },
    async get(collection, id) {
      return mode === 'mongodb'
        ? plain(await models[collection].findById(id).lean())
        : plain(data[collection].find((item) => item._id === id) || null)
    },
    async save(collection, input, id) {
      const existing = id ? await this.get(collection, id) : null
      const document = new models[collection]({ ...existing, ...input, ...(id ? { _id: id } : {}) })
      await document.validate()
      const value = plain(document)
      value.createdAt = existing?.createdAt || new Date().toISOString()
      value.updatedAt = new Date().toISOString()
      if (mode === 'mongodb') {
        if (id)
          return plain(
            await models[collection].findByIdAndUpdate(
              id,
              { $set: input },
              { new: true, runValidators: true },
            ),
          )
        return plain(await models[collection].create(value))
      }
      const task = writes
        .catch(() => {})
        .then(async () => {
          const next = plain(data)
          if (id)
            next[collection] = next[collection].map((item) => (item._id === id ? value : item))
          else next[collection].push(value)
          await persist(next)
          return value
        })
      writes = task
      return task
    },
    async remove(collection, id) {
      if (mode === 'mongodb') return models[collection].findByIdAndDelete(id)
      const task = writes
        .catch(() => {})
        .then(async () => {
          const next = plain(data)
          next[collection] = next[collection].filter((item) => item._id !== id)
          await persist(next)
        })
      writes = task
      return task
    },
    async close() {
      await writes
      if (mode === 'mongodb') await mongoose.disconnect()
    },
  }
}
module.exports = { createStore }
