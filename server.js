require('dotenv').config({ quiet: true })
const express = require('express')
const cors = require('cors')
const path = require('node:path')
const fs = require('node:fs')
const { createStore } = require('./services/store')
const { createResourceRouter } = require('./routes/resourceRoutes')
const { sports, countries } = require('./config/constants')
const { createAuth } = require('./services/auth')

function createApp(store, options = {}) {
  const app = express()
  const auth = createAuth({ mode: store.mode, ...options.auth })
  app.locals.ready = auth.ready
  app.disable('x-powered-by')
  app.set('view engine', 'pug')
  app.set('views', path.join(__dirname, 'views'))
  app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(','), credentials: true }))
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' })
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store')
    next()
  })
  app.use(express.json({ limit: '32kb' }))
  app.use('/api/auth', auth.router)
  app.use('/api', auth.requireAdmin)
  app.get('/api/health', (req, res) =>
    res.json({ success: true, message: 'ARENA API is running.', mode: store.mode }),
  )
  app.get('/api/meta', (req, res) =>
    res.json({ success: true, data: { sports, countries, mode: store.mode } }),
  )
  app.use('/api/athletes', require('./routes/athleteRoutes')(store))
  for (const collection of ['events', 'results'])
    app.use(`/api/${collection}`, createResourceRouter(collection, store))
  app.get('/about', async (req, res) =>
    res.render('about', {
      mode: store.mode,
      athletes: (await store.all('athletes')).length,
      events: (await store.all('events')).length,
    }),
  )
  app.use('/api', (req, res) =>
    res.status(404).json({ success: false, message: 'API endpoint not found.' }),
  )
  const client = path.join(__dirname, 'client/dist')
  if (fs.existsSync(path.join(client, 'index.html'))) {
    app.use(express.static(client))
    app.get('/{*path}', (req, res) => res.sendFile(path.join(client, 'index.html')))
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const validation = ['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)
    const status = error.status || (error.code === 11000 ? 409 : validation ? 400 : 500)
    if (status === 500) console.error(error)
    res
      .status(status)
      .json({
        success: false,
        message:
          status === 500
            ? 'An unexpected server error occurred.'
            : error.code === 11000
              ? 'This result already exists.'
              : error.message,
      })
  })
  return app
}
async function start() {
  const store = await createStore({
    mode: process.env.STORAGE_MODE || 'demo',
    uri: process.env.MONGODB_URI,
    file: process.env.DEMO_DATA_FILE,
  })
  const app = createApp(store)
  await app.locals.ready
  const server = app.listen(process.env.PORT || 5000, () =>
    console.log(`ARENA · http://localhost:${process.env.PORT || 5000} · ${store.mode} storage`),
  )
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () =>
      server.close(async () => {
        await store.close()
        process.exit(0)
      }),
    )
  return server
}
if (require.main === module)
  start().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
module.exports = { createApp, start }
