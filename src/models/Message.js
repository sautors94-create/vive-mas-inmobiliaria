const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  propiedad: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  remitente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destinatario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mensaje: { type: String, required: true, trim: true },
  leido: { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ propiedad: 1, remitente: 1, destinatario: 1 });

module.exports = mongoose.model('Message', messageSchema);