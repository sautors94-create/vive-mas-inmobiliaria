const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  
  // ✅ CORREGIDO: Se agregó "select: false" para que Mongoose no lo traiga por defecto
  // y permita usar el "+password" de forma segura en el login y desactivar2FA
  password: { 
    type: String, 
    required: true, 
    minlength: 6, 
    select: false 
  },
  
  role: { type: String, enum: ['user', 'admin', 'services', 'basico_plus'], default: 'user' },
  plan: { type: String, enum: ['gratuito', 'basico', 'premium'], default: 'gratuito' },
  planFechaFin: { type: Date, default: null },
  planFechaInicio: { type: Date, default: null },
  planPeriodo: { type: String, enum: ['mensual', 'anual'], default: 'mensual' },
  planCancelado: { type: Boolean, default: false },
  stripeSubscriptionId: { type: String, default: null },
  cargoRecurrenteAutorizado: { type: Boolean, default: false },
  cargoRecurrenteFecha: { type: Date, default: null },
  cargoRecurrenteRevocadoFecha: { type: Date, default: null },
  cargoRecurrenteIP: { type: String, default: null },
cargoRecurrenteUserAgent: { type: String, default: null },
  fechaCancelacion: { type: Date, default: null },
  status: { type: String, enum: ['activo', 'suspendido', 'bloqueado'], default: 'activo' },
  // Cupón usado para activar el plan (ej. SOMOSASESORES para Básico Plus)
  cuponUsado: { type: String, default: null },
  cupon: { type: mongoose.Schema.Types.Mixed, default: null },
  avatar: { type: String, default: null },
  telefono: { type: String, default: null },
  rfc: { type: String, default: null, trim: true, uppercase: true },
  kyc: {
    ineFrenteUrl: { type: String, default: null },
    ineReversoUrl: { type: String, default: null },
    status: { type: String, enum: ['pendiente', 'en_revision', 'aprobado', 'rechazado'], default: 'pendiente' },
    motivoRechazo: { type: String, default: null },
    updatedAt: { type: Date, default: null },
  },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  twoFactorRecoveryCodes: [{ type: String }],
  verificado: { type: Boolean, default: false },
  identidadVerificada: { type: Boolean, default: false },
  codigoVerificacion: { type: String, default: null },
  codigoExpira: { type: Date, default: null },
  metodoVerificacion: { type: String, enum: ['email', 'sms'], default: 'email' },
  notificaciones: {
    mensajes: { type: Boolean, default: true },
    propiedadAprobada: { type: Boolean, default: true },
    propiedadRechazada: { type: Boolean, default: true },
    novedades: { type: Boolean, default: false },
    cargoRecurrente: { type: Boolean, default: true },
  },
  busquedasRecientes: [{
    estado: { type: String, default: '' },
    ciudad: { type: String, default: '' },
    operacion: { type: String, default: '' },
    tipo: { type: String, default: '' },
    precioMax: { type: Number, default: null },
    fecha: { type: Date, default: Date.now },
  }],
  ultimaActividad: { type: Date, default: Date.now },
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
  delete user.cargoRecurrenteIP;
  delete user.cargoRecurrenteUserAgent;
  delete user.twoFactorSecret;
  delete user.twoFactorRecoveryCodes;
  return user;
};

module.exports = mongoose.model('User', userSchema);