const mongoose = require('mongoose')
const { sports } = require('../config/constants')
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    sport: { type: String, required: true, enum: sports },
    discipline: { type: String, required: true, trim: true, maxlength: 80 },
    location: { type: String, required: true, trim: true, maxlength: 100 },
    date: {
      type: String,
      required: true,
      validate: (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value,
    },
    time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    status: { type: String, enum: ['Scheduled', 'Live', 'Completed'], default: 'Scheduled' },
    capacity: { type: Number, required: true, min: 2, max: 10000, validate: Number.isInteger },
    unit: { type: String, enum: ['s', 'min', 'm', 'pts'], default: 's' },
    ranking: { type: String, enum: ['asc', 'desc'], default: 'asc' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Athlete' }],
  },
  { timestamps: true, strict: 'throw' },
)
module.exports = mongoose.model('Event', schema)
