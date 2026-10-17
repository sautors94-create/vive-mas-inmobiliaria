'use strict';

/**
 * src/marcas/models/BrandAuditLog.js — Bitácora de moderación (quién y cuándo).
 * ---------------------------------------------------------------------------
 * Contrato del test de integración:
 *   - Cada acción de admin (solicitudes, resolver, bloquear, reactivar,
 *     desactivar, eliminar, purgar) deja un registro con:
 *       brand, accion, adminId, adminEmail, detalle, createdAt
 *   - `adminEmail` se resuelve desde la BD (req.user.id → User.email), no se
 *     confía en el payload del token.
 *   - La purga definitiva NO borra la bitácora: `brand` queda como referencia
 *     histórica aunque la marca ya no exista (test exige >= 6 registros).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const auditSchema = new Schema(
  {
    brand: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    accion: { type: String, required: true, maxlength: 60 },
    adminId: { type: Schema.Types.ObjectId, ref: 'User' },
    adminEmail: { type: String, trim: true, maxlength: 254, default: 'sistema' },
    detalle: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.BrandAuditLog || mongoose.model('BrandAuditLog', auditSchema);
