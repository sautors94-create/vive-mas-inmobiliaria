'use strict';

/**
 * src/marcas/models/BrandOtp.js — Códigos de verificación (email) de marcas.
 * ---------------------------------------------------------------------------
 * Contrato del test de integración:
 *   - `destino`: email normalizado en minúsculas O teléfono E.164 (+52...)
 *     (el test llama BrandOtp.updateMany({ destino }) para saltar el cooldown)
 *   - `ultimoEnvio`: Date — base del cooldown de 60 s entre envíos
 *   - `intentos`: contador de verificaciones fallidas (4 → código bloqueado, 429)
 *   - `expira`: TTL index — MongoDB purga el documento al vencer
 *   - `canal`: 'email' | 'sms' (en sms el código real vive en Twilio Verify,
 *     aquí sólo se registra el último envío para el cooldown)
 *
 * Un solo código activo por destino: crearOTP borra los previos (ver controllers).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const otpSchema = new Schema(
  {
    destino: { type: String, required: true, index: true },
    codigo: { type: String, required: true },
    canal: { type: String, enum: ['email', 'sms'], required: true },
    expira: { type: Date, required: true },
    ultimoEnvio: { type: Date, default: Date.now },
    intentos: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Purga automática: el documento muere cuando now > expira (10 min).
otpSchema.index({ expira: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.BrandOtp || mongoose.model('BrandOtp', otpSchema);
