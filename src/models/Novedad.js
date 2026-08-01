const mongoose = require('mongoose');

const novedadSchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  mensaje: { type: String, required: true },
  link: { type: String, default: null },
  imagen: { type: String, default: null },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  activa: { type: Boolean, default: true }, // se muestra en "Novedades" dentro de la cuenta del usuario
  correoEnviado: { type: Boolean, default: false },
  fechaEnvioCorreo: { type: Date, default: null },
  destinatariosCorreo: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Novedad', novedadSchema);