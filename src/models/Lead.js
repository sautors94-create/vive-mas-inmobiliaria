const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  folio: { type: String, unique: true, index: true },
  nombre: { type: String, required: true },
  telefono: { type: String, required: true },
  email: { type: String, default: null },
  servicio: { type: String, default: null },
  tipo: { type: String, enum: ['servicio', 'soporte'], default: 'servicio' },
  conversacion: { type: Array, default: [] },
  status: { type: String, enum: ['nuevo', 'contactado', 'cerrado'], default: 'nuevo' },
  notas: { type: String, default: null },
  ip: { type: String, default: null },
  ciudad: { type: String, default: null },
  pais: { type: String, default: 'México' },
  usuarioRegistrado: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  atendidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

leadSchema.pre('save', function(next) {
  if (!this.folio) {
    const stamp = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 900 + 100);
    this.folio = `VM-${stamp}${rand}`;
  }
  next();
});

module.exports = mongoose.model('Lead', leadSchema);
