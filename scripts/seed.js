require('dotenv').config({ quiet: true })
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const seed = require('../data/seed')
const { createStore } = require('../services/store')
async function main() {
  if ((process.env.STORAGE_MODE || 'demo') === 'demo') {
    const store = await createStore({ mode: 'demo', file: process.env.DEMO_DATA_FILE })
    console.log(
      `Demo ready: ${(await store.all('athletes')).length} athletes, ${(await store.all('events')).length} competitions. Existing records were preserved.`,
    )
    await store.close()
    return
  }
  await connectDB(process.env.MONGODB_URI)
  try {
    const models = {
      athletes: require('../models/Athlete'),
      events: require('../models/Event'),
      results: require('../models/Result'),
    }
    for (const model of Object.values(models))
      if (await model.countDocuments())
        throw new Error(
          'Seeding requires empty athlete, event and result collections. Existing records were preserved.',
        )
    const data = seed()
    for (const [collection, model] of Object.entries(models))
      await model.insertMany(data[collection])
    console.log('MongoDB seeded with fictional demonstration data.')
  } finally {
    await mongoose.disconnect()
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
