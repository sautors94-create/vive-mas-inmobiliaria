const mongoose = require('mongoose');

// Fichas rápidas generadas por Agentes Fundadores para compartir por
// WhatsApp/Facebook. Es INTENCIONALMENTE independiente del modelo real
// Property (que sí pasa por moderación IA y el flujo de aprobación del
// admin) — esto es una herramienta de captación de bajísima fricción,
// no crea publicaciones reales en el marketplace.
const FichaRapidaSchema = new mongoose.Schema({
  founder: { type: mongoose.Schema.Types.ObjectId, ref: 'Founder' },
  operacion: String,
  precio: Number,
  recamaras: Number,
  banos: Number,
  ubicacion: String,
  imagenUrl: String,
  generatedImageUrl: { type: String, default: '' }, 
  slug: { type: String, unique: true },
  vendida: { type: Boolean, default: false }
}, { timestamps: true });

// CORREGIDO: FichaRapidaSchema con F mayúscula
FichaRapidaSchema.pre('save', function (next) {
  if (this.slug) return next();
  const base = (this.ubicacion || 'propiedad')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  this.slug = `${base}-${Math.random().toString(36).slice(2, 8)}`;
  next();
});

// CORREGIDO: FichaRapidaSchema con F mayúscula
module.exports = mongoose.model('FichaRapida', FichaRapidaSchema);
