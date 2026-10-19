'use strict';

/**
 * src/models/User.js — MODELO DE USUARIO (versión de producción, superset)
 * ---------------------------------------------------------------------------
 * ⚠️ POR QUÉ EXISTE ESTE ARCHIVO
 *
 * En el último despliegue se subió accidentalmente el User.js "de banco de
 * pruebas" (un subconjunto sin hooks ni métodos). Resultado en producción:
 *
 *   - /api/auth/login respondía 500 "Error al iniciar sesión. Intenta de
 *     nuevo." porque auth.controller.js llama a user.compararPassword()
 *     (método que este superset restituye).
 *   - Todos los logins habrían dado 403 "Debes verificar tu cuenta" porque
 *     el subconjunto tampoco tenía el campo `verificado`.
 *   - El registro habría guardado contraseñas SIN hashear (sin pre('save')).
 *
 * Este superset cubre TODO lo que el backend consume del usuario:
 *   - auth.controller.js: login (compararPassword), registro (pre-save
 *     hashea), verificación (codigoVerificacion/codigoExpira/canal),
 *     2FA (twoFactor*), KYB (kyb.correoCorporativo*), suscripciones Stripe
 *     (stripeSubscriptionId, cargoRecurrente*, plan*), cambio/olvido de
 *     contraseña (passwordChangedAt), tipo de cuenta, etc.
 *   - auth.middleware.js v2: select('status ultimaActividad role') + updateOne.
 *   - Módulo Marcas: id/email/role/estado.
 *
 * Compatibilidad: es un SUPERSET del subconjunto que está desplegado, así que
 * nada se pierde. Los campos desconocidos del modelo original se conservan en
 * MongoDB (mongoose nunca borra datos) y kyb/kyc aceptan claves nuevas
 * (strict:false en kyb; Mixed en kyc) para no romper flujos futuros.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

// ---------------------------------------------------------------------------
// KYB (Know Your Business) — subdocumento tolerante: tracked por mongoose
// (los cambios anidados SÍ se guardan) y acepta claves desconocidas.
// ---------------------------------------------------------------------------
const kybSchema = new Schema(
  {
    razonSocial: { type: String, trim: true, maxlength: 200 },
    correoCorporativo: { type: String, trim: true, lowercase: true, maxlength: 254 },
    correoCorporativoVerificado: { type: Boolean, default: false },
    // ⚠️ sin select:false — se lee tras findById plano en auth.controller L1158
    correoCorporativoCodigo: { type: String },
    correoCorporativoCodigoExpira: { type: Date },
  },
  { _id: false, strict: false, minimize: false }
);

const userSchema = new Schema(
  {
    // ── identidad ──────────────────────────────────────────────────────────
    nombre: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    password: { type: String, select: false },
    telefono: { type: String, trim: true, maxlength: 30 },
    avatar: { type: String, default: '' },
    role: { type: String, default: 'user' },
    tipoCuenta: { type: String, default: 'personal' },

    // ── ciclo de vida de la cuenta ─────────────────────────────────────────
    verificado: { type: Boolean, default: false },
    status: { type: String, default: 'activo' },
    plan: { type: String, default: 'gratuito' },
    ultimaActividad: { type: Date },
    passwordChangedAt: { type: Date },

    // ── verificación de cuenta (código email/sms) ──────────────────────────
    // ⚠️ SIN select:false: auth.controller lee estos campos con findOne/findById
    // PLANO (verificarCodigo L445-475, confirmar2FA L801-826, verificarTelefono
    // L1367-1380, verificarCorreoCorporativo L1158-1174). La protección de las
    // respuestas la dan usuarioSeguro() y el transform toJSON de abajo.
    metodoVerificacion: { type: String },
    codigoVerificacion: { type: String },
    codigoExpira: { type: Date },
    canalVerificacionUsado: { type: String },
    telefonoPendiente: { type: String },

    // ── 2FA ────────────────────────────────────────────────────────────────
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    twoFactorRecoveryCodes: { type: [String] },

    // ── suscripción / pagos (Stripe) ───────────────────────────────────────
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    planPeriodo: { type: String },
    planFechaFin: { type: Date },
    planCancelado: { type: Boolean, default: false },
    fechaCancelacion: { type: Date },
    cargoRecurrenteAutorizado: { type: Boolean, default: false },
    cargoRecurrenteFecha: { type: Date },
    cargoRecurrenteIP: { type: String },
    cargoRecurrenteUserAgent: { type: String },
    cargoRecurrenteRevocadoFecha: { type: Date },

    // ── KYB / KYC ──────────────────────────────────────────────────────────
    kyb: { type: kybSchema, default: () => ({}) },
    kyc: { type: Schema.Types.Mixed, default: () => ({}) },

    // ── colecciones embebidas tolerantes (el modelo original tenía más) ────
    notificaciones: { type: [Schema.Types.Mixed], default: undefined },
    favoritos: { type: [Schema.Types.Mixed], default: undefined },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Índices — idénticos a los del subconjunto desplegado (arranque probado en
// producción): email único sparse. teléfono: índice simple (la unicidad la
// valida auth.controller en registro/actualización).
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ telefono: 1 }, { sparse: true });

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
// Hasheo en cada cambio de contraseña (mismo contrato que el modelo original):
// registro(), restablecerPassword() y cambiarPassword() hacen user.save() y
// confían en este hook.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (!this.password) return next(); // cuentas sin contraseña (p. ej. OAuth)
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Métodos de instancia
// ---------------------------------------------------------------------------
userSchema.methods.compararPassword = async function compararPassword(candidata) {
  if (!this.password || candidata == null) return false;
  return bcrypt.compare(String(candidata), String(this.password));
};

// ---------------------------------------------------------------------------
// Serialización segura: nunca mandar credenciales/códigos por JSON.
// (usuarioSeguro() del controlador ya borra estos mismos campos; esto añade
// una segunda capa si algún endpoint responde el documento directo.)
// ---------------------------------------------------------------------------
const CAMPOS_OCULTOS_JSON = [
  'password',
  'codigoVerificacion',
  'codigoExpira',
  'canalVerificacionUsado',
  'twoFactorSecret',
  'twoFactorRecoveryCodes',
  'telefonoPendiente',
];
userSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    for (const campo of CAMPOS_OCULTOS_JSON) delete ret[campo];
    return ret;
  },
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
