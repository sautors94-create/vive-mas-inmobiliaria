const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  propiedad: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  conversacionId: { type: String, required: true, index: true },
  remitente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destinatario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mensaje: { type: String, required: true, trim: true },
  leido: { type: Boolean, default: false },
  // Detección de riesgo
  riesgo: { type: String, enum: ['bajo', 'medio', 'alto', 'critico'], default: 'bajo' },
  riesgoFlags: [{ type: String }],
  riesgoRevision: { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ conversacionId: 1, createdAt: 1 });
messageSchema.index({ remitente: 1, destinatario: 1 });

module.exports = mongoose.model('Message', messageSchema);