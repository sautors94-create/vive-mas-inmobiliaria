const mongoose = require('mongoose');

const reporteSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['propiedad', 'mensaje'], required: true },
  propiedad: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  conversacionId: { type: String, default: null },
  usuarioReportado: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reportadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  motivo: {
    type: String,
    enum: ['spam', 'fraude', 'contenido_inapropiado', 'informacion_falsa', 'acoso', 'otro'],
    required: true
  },
  detalle: { type: String, default: null },
  status: { type: String, enum: ['pendiente', 'revisado', 'descartado'], default: 'pendiente' },
  revisadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notasAdmin: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Reporte', reporteSchema);