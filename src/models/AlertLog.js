const mongoose = require('mongoose');

// Registro de alertas del sistema de salud.
// Cada alerta tiene severidad, servicio, descripción, valor actual,
// límite, estado y si fue atendida.
const alertLogSchema = new mongoose.Schema({
  servicio: { type: String, required: true }, // storage | mongodb | cloudinary | node | website | backups | errors
  severidad: { type: String, enum: ['info', 'warning', 'advertencia', 'critico', 'emergencia'], default: 'info' },
  descripcion: { type: String, required: true },
  valorActual: { type: mongoose.Schema.Types.Mixed, default: null },
  limite: { type: mongoose.Schema.Types.Mixed, default: null },
  recomendacion: { type: String, default: null },
  estado: { type: String, enum: ['activa', 'resuelta'], default: 'activa' },
  atendida: { type: Boolean, default: false },
  atendidaPor: { type: String, default: null },
  atendidaFecha: { type: Date, default: null },
  fecha: { type: Date, default: Date.now },
}, { timestamps: true });

alertLogSchema.index({ severidad: 1, fecha: -1 });
alertLogSchema.index({ estado: 1 });

module.exports = mongoose.model('AlertLog', alertLogSchema);
