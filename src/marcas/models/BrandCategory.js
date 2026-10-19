'use strict';

/**
 * src/marcas/models/BrandCategory.js — Categorías del directorio de marcas.
 * ---------------------------------------------------------------------------
 * - `slug` único generado desde `nombre` (sin acentos) — el buscador público y
 *   los filtros aceptan slugs separados por coma.
 * - `activa`: las categorías desactivadas salen del catálogo público y el panel
 *   rechaza asignarlas a una marca (400).
 * - El admin crea categorías vía /api/admin/marcas/catalogos/categorias;
 *   duplicado por slug → 409.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const categoriaSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, index: true },
    icono: { type: String, trim: true, maxlength: 8, default: '' },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

module.exports =
  mongoose.models.BrandCategory || mongoose.model('BrandCategory', categoriaSchema);
