const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  /** Kullanıcıya özel, işletmelerde indirim kontrolü için (örn. 48X7K9M2) */
  memberId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  surname: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  dateOfBirth: {
    type: String,
    required: true,
    trim: true,
  },
  specialDay: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    city: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    neighborhood: { type: String, required: true, trim: true },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
