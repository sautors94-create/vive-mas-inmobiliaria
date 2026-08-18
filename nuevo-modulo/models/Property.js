const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: String,
  slug: { type: String, unique: true },
  type: { type: String, enum: ['renta', 'venta'], default: 'renta' },
  propertyType: { type: String, default: 'Departamento' },
  price: String,
  location: String,
  city: String,
  rooms: String,
  baths: String,
  m2: String,
  imageUrl: String,
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Founder' }
}, { timestamps: true });

propertySchema.pre('save', function(next) {
  if (!this.slug) {
    const base = (this.location || 'propiedad').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.slug = `${base}-${Date.now()}`;
  }
  next();
});

module.exports = mongoose.model('Property', propertySchema);