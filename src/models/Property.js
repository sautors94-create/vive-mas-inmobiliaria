const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  descripcion: { type: String, required: true },
  precio: { type: Number, required: true },
  operacion: { type: String, enum: ['renta', 'venta'], required: true },
  tipo: { type: String, enum: ['casa', 'departamento', 'terreno', 'local'], required: true },
  status: { type: String, enum: ['revision', 'aprobada', 'rechazada', 'bloqueada', 'pausada'], default: 'revision' },
  motivo_rechazo: { type: String, default: null },
  permiteEdicion: { type: Boolean, default: true },
  fotos: [{ type: String }],
  ubicacion: {
    estado: { type: String, required: true },
    ciudad: { type: String, required: true },
    colonia: { type: String },
    direccion: { type: String },
    lat: { type: Number },
    lng: { type: Number },
  },
caracteristicas: {
    recamaras: { type: Number, default: 0 },
    banos: { type: Number, default: 0 },
    mediosBanos: { type: Number, default: 0 },
    estacionamientos: { type: Number, default: 0 },
    m2: { type: Number, default: 0 },
  },
  propietario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destacada: { type: Boolean, default: false },
  planPeso: { type: Number, default: 0 }, // 0=Gratuito, 1=Básico, 2=Premium
  moderacionIA: {
    decision: { type: String, enum: ['APPROVED', 'BLOCKED_FOR_REVIEW', null], default: null },
    confidence: { type: Number, default: null },
    riskScore: { type: Number, default: null },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', null], default: null },
    summary: { type: String, default: null },
    issues: [{
      severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'] },
      category: { type: String },
      field: { type: String },
      message: { type: String },
    }],
    analizadoEn: { type: Date, default: null },
    agentesEjecutados: { type: [String], default: [] }, // ['validacion', 'moderacion']
  },
  vistas: { type: Number, default: 0 },
}, { timestamps: true });

propertySchema.index({ 'ubicacion.estado': 1, 'ubicacion.ciudad': 1 });
propertySchema.index({ operacion: 1, tipo: 1, precio: 1 });
propertySchema.index({ titulo: 'text', descripcion: 'text' });

module.exports = mongoose.model('Property', propertySchema);