const mongoose = require('mongoose');

const temaSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  primary: { type: String, required: true },
  primaryLight: { type: String, required: true },
  accent: { type: String, required: true },
  accentDark: { type: String, required: true },
  bgDark: { type: String, required: true },
  esPredefinido: { type: Boolean, default: false },
}, { _id: true });

const siteConfigSchema = new mongoose.Schema({
  tema: {
    nombre: { type: String, default: 'default' },
    primary: { type: String, default: '#1a472a' },
    primaryLight: { type: String, default: '#2d6a4f' },
    accent: { type: String, default: '#f4a261' },
    accentDark: { type: String, default: '#e76f51' },
    bgDark: { type: String, default: '#0f1923' },
  },
  temasPersonalizados: [temaSchema],
  destacadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  pagos: {
    basico_mensual: { type: String, default: 'https://buy.stripe.com/3cIeVeebe5dBfUyevM2Ji00' },
    basico_anual: { type: String, default: 'https://buy.stripe.com/14AaEYaZ20Xl0ZEcnE2Ji01' },
    basico_mesgratis: { type: String, default: 'https://buy.stripe.com/14AfZic36fSf6jYcnE2Ji04' },
    basico_10: { type: String, default: 'https://buy.stripe.com/00wfZic36fSffUycnE2Ji02' },
    basico_15: { type: String, default: 'https://buy.stripe.com/3cI5kEc36bBZ37MfzQ2Ji03' },
  },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SiteConfig', siteConfigSchema);