const mongoose = require('mongoose');

// Fichas rápidas generadas por Agentes Fundadores para compartir por
// WhatsApp/Facebook. Es INTENCIONALMENTE independiente del modelo real
// Property (que sí pasa por moderación IA y el flujo de aprobación del
// admin) — esto es una herramienta de captación de bajísima fricción,
// no crea publicaciones reales en el marketplace.
const fichaRapidaSchema = new mongoose.Schema({
  founder: { type: mongoose.Schema.Types.ObjectId, ref: 'Founder', required: true },
  slug: { type: String, unique: true, index: true },
  tipo: { type: String, default: 'departamento' },
  operacion: { type: String, enum: ['renta', 'venta'], default: 'renta' },
  precio: { type: Number, required: true },
  recamaras: { type: Number, default: 0 },
  banos: { type: Number, default: 0 },
  ubicacion: { type: String, required: true },
  imagenUrl: { type: String, default: null }, // foto subida o URL pegada de Facebook
}, { timestamps: true });

fichaRapidaSchema.pre('save', function (next) {
  if (this.slug) return next();
  const base = (this.ubicacion || 'propiedad')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  this.slug = `${base}-${Math.random().toString(36).slice(2, 8)}`;
  next();
});

module.exports = mongoose.model('FichaRapida', fichaRapidaSchema);
