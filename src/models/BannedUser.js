const mongoose = require('mongoose');

const bannedUserSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  aliases: [{
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String },
    telefono: { type: String },
    vinculadoEn: { type: Date, default: Date.now }
  }],
  razon: { type: String, required: true },
  detalles: { type: String, default: '' },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('BannedUser', bannedUserSchema);