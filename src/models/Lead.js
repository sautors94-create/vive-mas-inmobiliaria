const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  folio: { type: String, unique: true, index: true },
  nombre: { type: String, required: true },
  telefono: { type: String, required: true },
  email: { type: String, default: null },
  servicio: { type: String, default: null },
  tipo: { type: String, enum: ['servicio', 'soporte'], default: 'servicio' },
  conversacion: { type: Array, default: [] },
  
  // ==========================================
  // CAMPOS DEL CRM INMOBILIARIO
  // ==========================================
  
  // 1. Embudo de ventas (Etapas del tablero Kanban)
  // Expandimos el status para un control de ventas real
  status: { 
    type: String, 
    enum: ['nuevo', 'contactado', 'visita_agendada', 'en_negociacion', 'ganado', 'perdido'], 
    default: 'nuevo' 
  },
  
  // 2. Propiedad de interés (A qué casa/depto está ligado el lead)
  propiedadInteres: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  
  // 3. Presupuesto del cliente (Para saber qué puede pagar)
  presupuesto: { type: Number, default: null },
  
  // 4. Notas internas (Historial de comentarios del agente)
  notasInternas: [{
    texto: { type: String, required: true },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // 5. Tareas y Recordatorios (Para que al agente no se le olviden las llamadas)
  tareas: [{
    descripcion: { type: String, required: true },
    fechaLimite: { type: Date, required: true },
    completada: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],

  // ==========================================
  // FIN DE CAMPOS CRM
  // ==========================================
  
  // Campo notas original (lo dejamos por si lo usas en otro lado, pero usaremos notasInternas para el CRM)
  notas: { type: String, default: null },
  ip: { type: String, default: null },
  ciudad: { type: String, default: null },
  pais: { type: String, default: 'México' },
  usuarioRegistrado: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  atendidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

leadSchema.pre('save', function(next) {
  if (!this.folio) {
    const stamp = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 900 + 100);
    this.folio = `VM-${stamp}${rand}`;
  }
  next();
});

// ✅ CORRECCIÓN: Evita el error "Cannot overwrite 'Lead' model once compiled" con Nodemon
module.exports = mongoose.models.Lead || mongoose.model('Lead', leadSchema);