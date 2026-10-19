'use strict';

/**
 * src/marcas/models/BrandCity.js — Ciudades de cobertura del directorio.
 * ---------------------------------------------------------------------------
 * - `slug` único sin acentos: "QUERÉTARO" → "queretaro" — así la ciudad que el
 *   proveedor escribe con mayúsculas/acentos REUTILIZA la existente y no
 *   duplica (contrato del test: crear "QUERÉTARO" no aumenta el conteo).
 * - `estado`: entidad federativa (opcional, sólo informativo).
 * - `activa`: filtro de catálogos públicos.
 * NOTA: el seed NO incluye Tepoztlán — el test la crea como ciudad nueva y
 * espera que el conteo crezca exactamente en 1.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ciudadSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 80 },
    estado: { type: String, trim: true, maxlength: 60, default: '' },
    slug: { type: String, required: true, unique: true, index: true },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

module.exports = mongoose.models.BrandCity || mongoose.model('BrandCity', ciudadSchema);
