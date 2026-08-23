const mongoose = require('mongoose');

const STATUS = ['pending', 'approved', 'rejected', 'completed', 'no_show', 'cancelled'];

const reservationSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  guestName: {
    type: String,
    trim: true,
    default: '',
  },
  guestPhone: {
    type: String,
    trim: true,
    default: '',
  },
  date: {
    type: String,
    required: true,
    trim: true,
  },
  slot: {
    type: String,
    required: true,
    trim: true,
  },
  countAge0to6: { type: Number, default: 0 },
  countAge6to12: { type: Number, default: 0 },
  countAge12Plus: { type: Number, default: 0 },
  status: {
    type: String,
    enum: STATUS,
    default: 'pending',
  },
  note: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
});

reservationSchema.index({ business: 1, date: 1 });
reservationSchema.index({ business: 1, status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
