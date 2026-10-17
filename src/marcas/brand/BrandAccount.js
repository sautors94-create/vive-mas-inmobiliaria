'use strict';

/**
 * src/marcas/models/BrandAccount.js — Credenciales de acceso de una marca.
 * ---------------------------------------------------------------------------
 * Separación estricta de datos (contrato del test de integración):
 *   - Aquí viven SOLO las credenciales: email / teléfono verificados.
 *   - El contacto PÚBLICO vive en Brand.contacto y nunca se mezcla.
 *   - Registro OTP-first: la cuenta se crea al VERIFICAR el código, no al
 *     solicitarlo (el test exige 0 cuentas tras `solicitar`).
 *
 * Campos de respuesta esperados por el frontend/test:
 *   cuenta.email, cuenta.telefono, cuenta.emailVerificado, cuenta.telefonoVerificado
 * (por eso los nombres con "Verificado", no emailVerified/phoneVerified).
 *
 * Índices sparse+unique: un documento puede tener sólo email, sólo teléfono o
 * ambos; null no consume unicidad. Así el teléfono duplicado de otra cuenta
 * se rechaza con E11000 (el controller responde 409 antes, con pre-check).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const cuentaSchema = new Schema(
  {
    // ⚠️ SIN default:null: los índices sparse NO saltan documentos con el
    // campo en null (sólo los que NO TIENEN el campo) → dos cuentas con
    // telefono:null chocarían en E11000. Undefined = campo ausente = sparse ok.
    email: { type: String, trim: true, lowercase: true },
    telefono: { type: String, trim: true },
    password: { type: String, select: false },
    emailVerificado: { type: Boolean, default: false },
    telefonoVerificado: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

cuentaSchema.index({ email: 1 }, { unique: true, sparse: true });
cuentaSchema.index({ telefono: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.BrandAccount || mongoose.model('BrandAccount', cuentaSchema);
