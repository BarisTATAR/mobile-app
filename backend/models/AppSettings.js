const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema({
  homeImageUrl: { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('AppSettings', appSettingsSchema);
