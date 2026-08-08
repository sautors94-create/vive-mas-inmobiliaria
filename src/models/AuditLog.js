const mongoose = require('mongoose');

// Auditoría de acciones administrativas importantes.
// Registra usuario, acción, fecha, IP y resultado.
const auditLogSchema = new mongoose.Schema({
  usuario: { type: String, default: null },      // email o user id
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  accion: { type: String, required: true },      // login | logout | health_check | cambio_umbrales | backup | etc
  detalle: { type: mongoose.Schema.Types.Mixed, default: null },
  ip: { type: String, default: null },
  resultado: { type: String, enum: ['exito', 'fallo', 'info'], default: 'info' },
  fecha: { type: Date, default: Date.now },
}, { timestamps: true });

auditLogSchema.index({ fecha: -1 });
auditLogSchema.index({ accion: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
