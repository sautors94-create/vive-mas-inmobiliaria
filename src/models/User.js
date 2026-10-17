'use strict';

/**
 * src/models/User.js — Modelo de usuario (versión de banco de pruebas).
 * ---------------------------------------------------------------------------
 * ⚠️ Esta copia de trabajo vive en vive-mas-fixed. Sustituye al STUB anterior
 * (que devolvía null en findById y era suficiente para el banco authmw-test)
 * porque tests/marcas.integration.js necesita un modelo REAL de mongoose:
 *
 *   - Crea admin/usuario normal con User.create({ nombre, email, password, role })
 *   - auth.middleware.js v2 hace User.findById(...).select('status ultimaActividad role')
 *     y User.updateOne({ _id }, { $set: { ultimaActividad } }) → deben funcionar.
 *
 * El repositorio real conserva SU modelo User completo (kyc/kyb, stripe,
 * notificaciones, hooks de bcrypt, etc.). Este subconjunto cubre exactamente
 * lo que el módulo Marcas consume del usuario: id, email, role y estado.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    nombre: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    password: { type: String, select: false },
    telefono: { type: String, trim: true, maxlength: 30 },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    plan: { type: String, default: 'gratuito' },
    status: { type: String, default: 'activo' },
    ultimaActividad: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Único pero tolerante: igual que BrandAccount, sparse permite documentos
// legados sin email sin consumir unicidad.
userSchema.index({ email: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
