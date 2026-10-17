'use strict';

/**
 * src/marcas/models/Brand.js — Marca / Profesional aliado del directorio.
 * ---------------------------------------------------------------------------
 * Reescrito según el contrato de tests/marcas.integration.js (Camino B).
 * Cambios de contrato respecto a la versión monolítica antigua (models.js):
 *   - `cuenta`   : ref a BrandAccount (antes `accountId`)
 *   - `estado`   : borrador|publicado|despublicado|bloqueado|desactivado|eliminado
 *                  (antes `status`)
 *   - `ciudades` : lista de cobertura (antes `ciudadesCobertura`) + `ciudadPrincipal`
 *   - `contacto` : { telefono, whatsapp, email, sitioWeb, redes } — datos PÚBLICOS,
 *                  separados de las credenciales de acceso (BrandAccount)
 *   - `promociones`, `solicitudesModeracion`, `galeria` como subdocumentos
 *   - `busqueda` : texto normalizado (sin acentos/minúsculas) para el buscador
 *   - Virtuals: `id`, `nombre`, `visiblePublicamente`, `solicitudesAbiertas`
 *   - `motivoBloqueo`/`ocultoPorModeracion`/`eliminadoEn` para moderación
 *
 * PRIVACIDAD: los serializadores públicos viven en controllers.js; este modelo
 * NUNCA debe enviarse crudo al público (expone estado interno y moderación).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ---------- Subdocumentos ----------

const promocionSchema = new Schema(
  {
    tipo: { type: String, enum: ['porcentaje', 'monto', 'cortesia', 'otro'], required: true },
    titulo: { type: String, trim: true, maxlength: 80, default: '' },
    descripcion: { type: String, required: true, trim: true, maxlength: 500 },
    porcentaje: { type: Number, min: 1, max: 100 },
    monto: { type: Number, min: 0 },
    condiciones: { type: String, trim: true, maxlength: 300, default: '' },
    vigenciaInicio: { type: Date },
    vigenciaFin: { type: Date },
    activa: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const solicitudSchema = new Schema(
  {
    campo: { type: String, trim: true, maxlength: 60, default: '' },
    motivo: { type: String, required: true, trim: true, maxlength: 300 },
    mensaje: { type: String, trim: true, maxlength: 1000, default: '' },
    ocultarMientras: { type: Boolean, default: false },
    de: { type: String, default: 'Equipo SomosViveMás' },
    estado: { type: String, enum: ['abierta', 'atendida', 'resuelta'], default: 'abierta' },
    adminId: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    atendidaEn: { type: Date },
    resueltaEn: { type: Date },
  },
  { _id: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const contactoSchema = new Schema(
  {
    telefono: { type: String, trim: true, maxlength: 30, default: '' },
    whatsapp: { type: String, trim: true, maxlength: 30, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '' },
    sitioWeb: { type: String, trim: true, maxlength: 200, default: '' },
    redes: {
      facebook: { type: String, trim: true, default: '' },
      instagram: { type: String, trim: true, default: '' },
      tiktok: { type: String, trim: true, default: '' },
      x: { type: String, trim: true, default: '' },
      linkedin: { type: String, trim: true, default: '' },
      youtube: { type: String, trim: true, default: '' },
    },
  },
  { _id: false }
);

// ---------- Esquema principal ----------

const brandSchema = new Schema(
  {
    cuenta: { type: Schema.Types.ObjectId, ref: 'BrandAccount', required: true, unique: true, index: true },
    nombreComercial: { type: String, trim: true, default: 'Mi Nueva Marca', maxlength: 80 },
    slug: { type: String, required: true, unique: true, index: true },
    responsable: { type: String, trim: true, maxlength: 100, default: '' },
    descripcionCorta: { type: String, trim: true, maxlength: 160, default: '' },
    descripcion: { type: String, trim: true, maxlength: 2000, default: '' },
    servicios: { type: [String], default: [] },
    categorias: { type: [{ type: Schema.Types.ObjectId, ref: 'BrandCategory' }], default: [] },
    categoriaPrincipal: { type: Schema.Types.ObjectId, ref: 'BrandCategory' },
    ciudades: { type: [{ type: Schema.Types.ObjectId, ref: 'BrandCity' }], default: [] },
    ciudadPrincipal: { type: Schema.Types.ObjectId, ref: 'BrandCity' },
    zonasAdicionales: { type: [String], default: [] },
    contacto: { type: contactoSchema, default: () => ({}) },
    logo: { type: String, default: '' },
    portada: { type: String, default: '' },
    fotoPerfil: { type: String, default: '' },
    galeria: { type: [String], default: [] },
    promociones: { type: [promocionSchema], default: [] },
    solicitudesModeracion: { type: [solicitudSchema], default: [] },
    estado: {
      type: String,
      enum: ['borrador', 'publicado', 'despublicado', 'bloqueado', 'desactivado', 'eliminado'],
      default: 'borrador',
      index: true,
    },
    ocultoPorModeracion: { type: Boolean, default: false },
    motivoBloqueo: { type: String, trim: true, maxlength: 300, default: '' },
    bloqueadoEn: { type: Date },
    motivoDesactivacion: { type: String, trim: true, maxlength: 300, default: '' },
    eliminadoEn: { type: Date },
    busqueda: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ---------- Virtuals ----------

brandSchema.virtual('nombre').get(function () {
  return this.nombreComercial;
});

brandSchema.virtual('visiblePublicamente').get(function () {
  return this.estado === 'publicado' && !this.ocultoPorModeracion;
});

brandSchema.virtual('solicitudesAbiertas').get(function () {
  return (this.solicitudesModeracion || []).filter((s) => s.estado === 'abierta').length;
});

module.exports = mongoose.models.Brand || mongoose.model('Brand', brandSchema);
