const mongoose = require('mongoose');

// Configuración persistente de umbrales del sistema de salud.
// Se usa un documento único (clave 'salud') para no duplicar.
const systemConfigSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true, default: 'salud' },
  umbrales: {
    storage: { warning: { type: Number, default: 70 }, critical: { type: Number, default: 90 } },
    cpu: { warning: { type: Number, default: 70 }, critical: { type: Number, default: 90 } },
    ram: { warning: { type: Number, default: 75 }, critical: { type: Number, default: 90 } },
    mongodb: { warning: { type: Number, default: 70 }, critical: { type: Number, default: 90 } },
    cloudinary: { warning: { type: Number, default: 70 }, critical: { type: Number, default: 90 } },
  },
  cloudinaryNiveles: {
    info: { type: Number, default: 50 },
    atencion: { type: Number, default: 70 },
    advertencia: { type: Number, default: 80 },
    critico: { type: Number, default: 90 },
    emergencia: { type: Number, default: 95 },
  },
  backupMaxHorasSinActualizar: { type: Number, default: 48 },
  intervalosSeg: {
    visual: { type: Number, default: 30 },
    metricasCostosas: { type: Number, default: 300 }, // Cloudinary / Mongo / Hostinger
  },
  actualizadoPor: { type: String, default: null },
  actualizadoEn: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
