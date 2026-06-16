const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['user', 'admin', 'services'], default: 'user' },
  plan: { type: String, enum: ['gratuito', 'basico', 'premium'], default: 'gratuito' },
  status: { type: String, enum: ['activo', 'suspendido', 'bloqueado'], default: 'activo' },
  avatar: { type: String, default: null },
  telefono: { type: String, default: null },
  rfc: { type: String, default: null, trim: true, uppercase: true },
  kyc: {
    ineFrenteUrl: { type: String, default: null },
    ineReversoUrl: { type: String, default: null },
    status: { type: String, enum: ['pendiente', 'en_revision', 'aprobado', 'rechazado'], default: 'pendiente' },
    updatedAt: { type: Date, default: null },
  },
  verificado: { type: Boolean, default: false },
  codigoVerificacion: { type: String, default: null },
  codigoExpira: { type: Date, default: null },
  metodoVerificacion: { type: String, enum: ['email', 'sms'], default: 'email' },
  notificaciones: {
    mensajes: { type: Boolean, default: true },
    propiedadAprobada: { type: Boolean, default: true },
    propiedadRechazada: { type: Boolean, default: true },
    novedades: { type: Boolean, default: false },
  },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.compararPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.codigoVerificacion;
  return user;
};

module.exports = mongoose.model('User', userSchema);