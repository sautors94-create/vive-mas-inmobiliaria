const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  telefono: { type: String, required: true },
  email: { type: String, default: null },
  servicio: { type: String, default: null },
  conversacion: { type: Array, default: [] },
  status: { type: String, enum: ['nuevo', 'contactado', 'cerrado'], default: 'nuevo' },
  notas: { type: String, default: null },
  atendidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);