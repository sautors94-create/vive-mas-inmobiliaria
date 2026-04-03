const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  propiedad: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
}, { timestamps: true });

favoriteSchema.index({ usuario: 1, propiedad: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);