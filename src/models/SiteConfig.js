const mongoose = require('mongoose');

const siteConfigSchema = new mongoose.Schema({
  tema: {
    nombre: { type: String, default: 'default' },
    primary: { type: String, default: '#1a472a' },
    primaryLight: { type: String, default: '#2d6a4f' },
    accent: { type: String, default: '#f4a261' },
    accentDark: { type: String, default: '#e76f51' },
    bgDark: { type: String, default: '#0f1923' },
  },
  destacadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  activo: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SiteConfig', siteConfigSchema);