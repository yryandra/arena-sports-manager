const mongoose = require('mongoose')

module.exports = async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is required when STORAGE_MODE=mongodb.')
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5, ...(process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {}) })
  return mongoose.connection
}
