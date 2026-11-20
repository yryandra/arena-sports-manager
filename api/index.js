const { createStore } = require('../services/store')
const { createApp } = require('../server')
let application

// Reuse initialization within each warm function. Failed starts can retry.
module.exports = async function handler(req, res) {
  if (!application) {
    application = (async () => {
      if (process.env.STORAGE_MODE !== 'mongodb') throw new Error('Hosted deployments require STORAGE_MODE=mongodb.')
      if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH || '')) throw new Error('ADMIN_PASSWORD_HASH must be configured.')
      const store = await createStore({ mode: 'mongodb', uri: process.env.MONGODB_URI })
      const app = createApp(store)
      await app.locals.ready
      return app
    })().catch(error => { application = null; throw error })
  }
  try { const app = await application; return app(req, res) }
  catch (error) {
    console.error('Application initialization failed:', error.name)
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify({ success: false, message: 'The workspace is temporarily unavailable. Please try again shortly.' }))
  }
}
