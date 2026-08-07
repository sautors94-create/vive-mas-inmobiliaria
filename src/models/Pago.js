const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema({
  stripe_session_id: { 
    type: String, 
    required: true, 
    unique: true // Para que no se duplique si Stripe reenvía el aviso
  },
  usuario_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' // Asegúrate de que 'User' sea el nombre exacto de tu modelo de usuarios
  },
  usuario_email: { 
    type: String, 
    required: true 
  },
  plan_contratado: { 
    type: String, 
    required: true // ej: 'basico'
  },
  monto: { 
    type: Number, 
    required: true // ej: 299
  },
  estatus: { 
    type: String, 
    enum: ['completado', 'pendiente', 'reembolsado'], 
    default: 'completado' 
  },
notas_admin: { 
    type: String, 
    default: '' // Aquí el admin guardará las aclaraciones
  },
  // Cupón aplicado (si aplica). Para basico_plus no hay monto real.
  cupon: { type: String, default: null },
  cupon_tipo: { type: String, enum: ['basico_plus', 'stripe', null], default: null }
}, { 
  timestamps: true // Crea automáticamente createdAt y updatedAt
});

module.exports = mongoose.model('Pago', pagoSchema);