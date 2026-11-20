const crypto = require('node:crypto')
const { promisify } = require('node:util')
const mongoose = require('mongoose')
const express = require('express')
const scrypt = promisify(crypto.scrypt)
const SESSION_MS = 8 * 60 * 60 * 1000
const WINDOW_MS = 15 * 60 * 1000
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
const sessionSchema = new mongoose.Schema({
  _id: String, csrf: String, expiresAt: Date,
}, { versionKey: false })
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
const attemptSchema = new mongoose.Schema({ _id: String, count: Number, expiresAt: Date }, { versionKey: false })
attemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
const Session = mongoose.models.AdminSession || mongoose.model('AdminSession', sessionSchema)
const Attempt = mongoose.models.LoginAttempt || mongoose.model('LoginAttempt', attemptSchema)

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${key.toString('hex')}`
}
async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || password.length > 256 || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash || '')) return false
  const [, salt, expected] = hash.split(':')
  const actual = await scrypt(password, salt, 64)
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'))
}

function createAuth({ mode, username = process.env.ADMIN_USERNAME || 'yryandra', passwordHash = process.env.ADMIN_PASSWORD_HASH || '', secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL), origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',') }) {
  const sessions = new Map()
  const attempts = new Map()
  const cookieName = secure ? '__Host-arena_session' : 'arena_session'
  const ready = mode === 'mongodb' ? Promise.all([Session.init(), Attempt.init()]) : Promise.resolve()
  const configured = /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)
  const cookie = (res, token, clear = false) => res.cookie(cookieName, token, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: clear ? 0 : SESSION_MS })
  async function readSession(req) {
    const raw = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null
    const id = digest(raw)
    const value = mode === 'mongodb' ? await Session.findById(id).lean() : sessions.get(id)
    if (!value || new Date(value.expiresAt).getTime() <= Date.now()) { sessions.delete(id); return null }
    return { ...value, _id: id }
  }
  function sameOrigin(req, res, next) {
    let valid = false
    try {
      const origin = new URL(req.headers.origin)
      valid = ['http:', 'https:'].includes(origin.protocol) && (origin.host === req.headers.host || origins.includes(origin.origin))
    } catch { /* A browser write must carry an explicit valid origin. */ }
    if (!valid || req.headers['x-arena-request'] !== '1') return res.status(403).json({ success: false, message: 'This request did not originate from the ARENA application.' })
    next()
  }
  async function consumeAttempt() {
    // A shared account-wide window also protects deployments running multiple instances.
    const bucket = `admin:${Math.floor(Date.now() / WINDOW_MS)}`
    if (mode === 'mongodb') {
      await ready
      let item
      try {
        item = await Attempt.findOneAndUpdate({ _id: bucket }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + WINDOW_MS) } }, { upsert: true, new: true }).lean()
      } catch (error) {
        if (error.code !== 11000) throw error
        item = await Attempt.findOneAndUpdate({ _id: bucket }, { $inc: { count: 1 } }, { new: true }).lean()
      }
      return item.count <= 20
    }
    for (const key of attempts.keys()) if (key !== bucket) attempts.delete(key)
    attempts.set(bucket, (attempts.get(bucket) || 0) + 1)
    return attempts.get(bucket) <= 20
  }
  const router = express.Router()
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.get('/session', async (req, res) => {
    const session = await readSession(req)
    res.json({ success: true, data: { authenticated: Boolean(session), configured, username: session ? username : null, csrf: session?.csrf || null } })
  })
  router.post('/login', sameOrigin, async (req, res) => {
    if (!configured) return res.status(503).json({ success: false, message: 'Administrator sign-in has not been configured yet.' })
    if (!await consumeAttempt()) {
      res.set('Retry-After', String(Math.ceil((WINDOW_MS - Date.now() % WINDOW_MS) / 1000)))
      return res.status(429).json({ success: false, message: 'Too many sign-in attempts. Please try again in 15 minutes.' })
    }
    const valid = await verifyPassword(req.body?.password, passwordHash)
    if (!valid || req.body?.username !== username) return res.status(401).json({ success: false, message: 'The username or password is incorrect.' })
    const previous = await readSession(req)
    if (previous) { if (mode === 'mongodb') await Session.deleteOne({ _id: previous._id }); else sessions.delete(previous._id) }
    const token = crypto.randomBytes(32).toString('hex')
    const session = { _id: digest(token), csrf: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + SESSION_MS) }
    if (mode === 'mongodb') { await ready; await Session.create(session) }
    else { for (const [key, entry] of sessions) if (new Date(entry.expiresAt).getTime() <= Date.now()) sessions.delete(key); sessions.set(session._id, session) }
    cookie(res, token)
    res.json({ success: true, data: { authenticated: true, configured, username, csrf: session.csrf } })
  })
  async function requireAdmin(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    const session = await readSession(req)
    if (!session) return res.status(401).json({ success: false, message: 'Sign in as administrator to make changes.' })
    if (req.headers['x-csrf-token'] !== session.csrf) return res.status(403).json({ success: false, message: 'Your session needs to be refreshed. Sign in again.' })
    return sameOrigin(req, res, next)
  }
  router.post('/logout', requireAdmin, async (req, res) => {
    const session = await readSession(req)
    if (mode === 'mongodb') await Session.deleteOne({ _id: session._id })
    else sessions.delete(session._id)
    cookie(res, '', true)
    res.json({ success: true })
  })
  return { router, requireAdmin, ready }
}
module.exports = { createAuth, hashPassword, verifyPassword }
