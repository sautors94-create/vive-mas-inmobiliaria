const mongoose = require('mongoose');

const founderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // Evitar duplicados exactos
  city: { type: String, required: true },
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },
  propertiesCount: { type: Number, default: 0 },
  rank: { type: String, enum: ['Fundador', 'Oro', 'Elite'], default: 'Fundador' }
}, { timestamps: true });

founderSchema.pre('save', function(next) {
  if (!this.referralCode) {
    const base = (this.name || 'agente').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.referralCode = `${base}-${Math.floor(Math.random() * 10000)}`;
  }
  next();
});

module.exports = mongoose.model('Founder', founderSchema);