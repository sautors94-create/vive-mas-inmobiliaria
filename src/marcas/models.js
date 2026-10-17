'use strict';

/**
 * src/marcas/models.js — Modelos del módulo de Marcas y Profesionales Aliados
 * ---------------------------------------------------------------------------
 * Correcciones aplicadas sobre la versión original:
 *  1. galeria/servicios: estaban como [{ type: String, default: [] }] — un
 *     default [] dentro del ELEMENTO del arreglo caste mal los elementos.
 *     Ahora son arreglos de strings correctos (+ topes anti-abuso).
 *  2. BrandAccount.password: select:false → el hash nunca sale en consultas
 *     normales (antes viajaba en cualquier find/findOne del módulo).
 *  3. BrandOTP: el índice TTL usaba expireAfterSeconds: 600 con `expira`
 *     fijado a ahora+10min → los códigos vivían ~20 min en lugar de 10.
 *     Con expireAfterSeconds: 0 el documento muere EXACTAMENTE en `expira`.
 *     + índice accountId/tipo/expira para las consultas de verificación.
 *  4. Validación y saneo: formato de slugs, formato de email, maxlengths en
 *     todos los campos de texto libre (evita documentos gigantes por abuso).
 *  5. Índices de consulta: status+updatedAt (listados admin), categorías,
 *     ciudades de cobertura y accountId (lookup del panel).
 *
 * Los nombres de exports NO cambian (BrandCategory, BrandCity, BrandAccount,
 * Brand, BrandOTP) para no romper routes/controllers/seed existentes.
 */

const mongoose = require('mongoose');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Catálogos globales (categorías y ciudades del directorio) ──────────────

const BrandCategorySchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  slug: {
    type: String, required: true, unique: true, trim: true, lowercase: true,
    match: [SLUG_RE, 'Slug de categoría inválido (minúsculas y guiones)']
  },
  activa: { type: Boolean, default: true } // permite retirar del catálogo público sin borrar
}, { timestamps: true });

const BrandCitySchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
  slug: {
    type: String, required: true, unique: true, trim: true, lowercase: true,
    match: [SLUG_RE, 'Slug de ciudad inválido (minúsculas y guiones)']
  },
  estado: { type: String, trim: true, maxlength: 80, default: '' }
}, { timestamps: true });

// ─── Cuentas de acceso de proveedores (OTP por correo o SMS) ────────────────

const BrandAccountSchema = new mongoose.Schema({
  email: {
    type: String, unique: true, sparse: true, trim: true, lowercase: true,
    maxlength: 254, match: [EMAIL_RE, 'Correo inválido']
  },
  phone: { type: String, unique: true, sparse: true, trim: true, maxlength: 20 },
  // select:false: el hash sólo se obtiene con .select('+password') explícito
  password: { type: String, select: false },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }
}, { timestamps: true });

BrandAccountSchema.index({ brandId: 1 });

// ─── Perfil público de la marca/profesional ─────────────────────────────────

const BrandSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BrandAccount', required: true },
  nombreComercial: { type: String, required: true, trim: true, maxlength: 120 },
  slug: {
    type: String, required: true, unique: true, trim: true, lowercase: true,
    match: [SLUG_RE, 'Slug de marca inválido (minúsculas y guiones)']
  },
  descripcion: { type: String, default: '', maxlength: 2000 },
  categorias: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BrandCategory' }],
  ciudadPrincipal: { type: mongoose.Schema.Types.ObjectId, ref: 'BrandCity' },
  ciudadesCobertura: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BrandCity' }],
  logo:    { type: String, default: '', maxlength: 512 },
  portada: { type: String, default: '', maxlength: 512 },
  // ❌ ANTES: [{ type: String, default: [] }] — default dentro del elemento;
  //    ahora sí es un arreglo de strings (URLs de Cloudinary).
  galeria: [{ type: String, maxlength: 512 }],
  telefono:      { type: String, default: '', trim: true, maxlength: 20 },
  whatsapp:      { type: String, default: '', trim: true, maxlength: 20 },
  emailContacto: { type: String, default: '', trim: true, maxlength: 254 },
  sitioWeb:      { type: String, default: '', trim: true, maxlength: 300 },
  promociones: [{
    tipo:        { type: String, trim: true, maxlength: 40 },
    descripcion: { type: String, trim: true, maxlength: 500 },
    vigencia:    { type: Date },
    condiciones: { type: String, trim: true, maxlength: 500 },
    activa:      { type: Boolean, default: true } // apagar sin borrar
  }],
  servicios: [{ type: String, trim: true, maxlength: 80 }],
  redesSociales: {
    facebook:  { type: String, default: '', maxlength: 300 },
    instagram: { type: String, default: '', maxlength: 300 },
    linkedin:  { type: String, default: '', maxlength: 300 }
  },
  solicitudesModeracion: [{
    campo:   { type: String, default: 'general', trim: true, maxlength: 80 },
    motivo:  { type: String, required: true, trim: true, maxlength: 300 },
    mensaje: { type: String, required: true, trim: true, maxlength: 2000 },
    fecha:   { type: Date, default: Date.now },
    estado:  { type: String, enum: ['abierta', 'atendida'], default: 'abierta' }
  }],
  status: {
    type: String,
    enum: ['borrador', 'publicado', 'despublicado', 'bloqueado', 'eliminado'],
    default: 'borrador'
  }
}, { timestamps: true });

// Topes anti-abuso de arreglos (el máximo de producto, p. ej. galería=8,
// lo valida el controlador; aquí se fija el techo técnico)
BrandSchema.path('galeria').validate({
  validator: (v) => !Array.isArray(v) || v.length <= 50,
  message: 'La galería no puede superar 50 fotos'
});
BrandSchema.path('servicios').validate({
  validator: (v) => !Array.isArray(v) || v.length <= 30,
  message: 'Los servicios no pueden superar 30 elementos'
});

// Consultas frecuentes: listado admin, filtros del directorio y panel
BrandSchema.index({ status: 1, updatedAt: -1 });
BrandSchema.index({ categorias: 1 });
BrandSchema.index({ ciudadesCobertura: 1 });
BrandSchema.index({ accountId: 1 });

// ─── Códigos OTP de verificación (correo / teléfono) ────────────────────────

const BrandOTPSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BrandAccount', required: true },
  codigo:   { type: String, required: true, maxlength: 10 },
  tipo:     { type: String, enum: ['email', 'phone'], required: true },
  intentos: { type: Number, default: 0, min: 0 },
  expira:   { type: Date, required: true }
}, { timestamps: true }); // createdAt permite auditar cuándo se emitió cada código

// ❗ ANTES: expireAfterSeconds: 600 con expira = ahora+10min → el código vivía
// ~20 minutos. Con 0, el documento se elimina exactamente al llegar `expira`.
BrandOTPSchema.index({ expira: 1 }, { expireAfterSeconds: 0 });
BrandOTPSchema.index({ accountId: 1, tipo: 1, expira: -1 });

// ─── Registro idempotente (seguro con hot-reload de nodemon) ────────────────
// Nota: si además existe la carpeta src/marcas/models/ con modelos separados,
// éstos y este archivo deben registrar los MISMOS nombres de modelo; de lo
// contrario el segundo mongoose.model() lanzará OverwriteModelError.
// Ver auditoría de tests/marcas.integration.js.

module.exports = {
  BrandCategory: mongoose.models.BrandCategory || mongoose.model('BrandCategory', BrandCategorySchema),
  BrandCity:     mongoose.models.BrandCity     || mongoose.model('BrandCity', BrandCitySchema),
  BrandAccount:  mongoose.models.BrandAccount  || mongoose.model('BrandAccount', BrandAccountSchema),
  Brand:         mongoose.models.Brand         || mongoose.model('Brand', BrandSchema),
  BrandOTP:      mongoose.models.BrandOTP      || mongoose.model('BrandOTP', BrandOTPSchema)
};
