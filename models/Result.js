const mongoose = require('mongoose')
const schema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    athleteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', required: true },
    performance: { type: Number, required: true, min: 0.001, max: 1000000 },
    status: { type: String, enum: ['Published', 'Provisional'], default: 'Published' },
  },
  { timestamps: true, strict: 'throw' },
)
schema.index({ eventId: 1, athleteId: 1 }, { unique: true })
module.exports = mongoose.model('Result', schema)
