const mongoose = require('mongoose')
const { sports, countries } = require('../config/constants')
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    sport: { type: String, required: true, enum: sports },
    country: { type: String, required: true, enum: countries.map((country) => country.name) },
    age: { type: Number, required: true, min: 10, max: 100, validate: Number.isInteger },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true, strict: 'throw' },
)
module.exports = mongoose.model('Athlete', schema)
