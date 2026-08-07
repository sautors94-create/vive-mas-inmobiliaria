const mongoose = require('mongoose');

const cuponSchema = new mongoose.Schema({
  codigo: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  // 'basico_plus': aplica cuenta Básico Plus (role=basico_plus) por N días, sin pago
  // 'stripe': descuento aplicado en Stripe; el usuario redirige al payment link
  tipo: {
    type: String,
    enum: ['basico_plus', 'stripe'],
    default: 'stripe'
  },
  descripcion: { type: String, default: '' },
  // Solo para tipo 'basico_plus': duración del acceso en días (ej. 360)
  dias: { type: Number, default: 0 },
  // Solo para tipo 'stripe': nombre/ID del cupón en Stripe y link de pago
  stripe_coupon_id: { type: String, default: null },
  stripe_price_link: { type: String, default: null },
  activo: { type: Boolean, default: true },
  // Fecha de vigencia del cupón (null = sin expiración). Un cupón vencido no puede usarse.
  expiraEn: { type: Date, default: null },
  usosMaximos: { type: Number, default: null }, // null = ilimitado
  usosActuales: { type: Number, default: 0 },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

cuponSchema.index({ codigo: 1 });
cuponSchema.index({ activo: 1, tipo: 1 });

module.exports = mongoose.model('Cupon', cuponSchema);
