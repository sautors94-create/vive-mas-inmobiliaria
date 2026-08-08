const mongoose = require('mongoose');

// Snapshot histórico de métricas de salud del sistema.
// Se guarda una fila por medición periódica para poder calcular
// crecimiento y generar gráficas (24h / 7d / 30d / 90d).
const healthMetricSchema = new mongoose.Schema({
  // Marca de tiempo de la medición
  timestamp: { type: Date, default: Date.now },

  // Node.js
  node: {
    version: { type: String, default: null },
    uptimeSegundos: { type: Number, default: 0 },
    cpuPorcentaje: { type: Number, default: 0 },
    procesadores: { type: Number, default: 0 },
    ramTotalMB: { type: Number, default: 0 },
    ramUsadaMB: { type: Number, default: 0 },
    ramPorcentaje: { type: Number, default: 0 },
    heapUsadoMB: { type: Number, default: 0 },
    heapTotalMB: { type: Number, default: 0 },
    memoriaProcessMB: { type: Number, default: 0 },
    tiempoRespuestaMs: { type: Number, default: 0 },
  },

  // MongoDB
  mongodb: {
    healthy: { type: Boolean, default: false },
    nombreBase: { type: String, default: null },
    tamanoBaseMB: { type: Number, default: 0 },
    conexionesActivas: { type: Number, default: 0 },
    operacionesPendientes: { type: Number, default: 0 },
    latenciaMs: { type: Number, default: 0 },
    error: { type: String, default: null },
    colecciones: [{
      nombre: { type: String, default: null },
      documentos: { type: Number, default: 0 },
      tamanoMB: { type: Number, default: 0 },
    }],
  },

  // Cloudinary
  cloudinary: {
    healthy: { type: Boolean, default: false },
    almacenamientoUsadoMB: { type: Number, default: 0 },
    almacenamientoLímiteMB: { type: Number, default: 0 },
    almacenamientoPorcentaje: { type: Number, default: 0 },
    recursos: { type: Number, default: 0 },
    anchoBandaUsadoMB: { type: Number, default: 0 },
    anchoBandaLímiteMB: { type: Number, default: 0 },
    transformaciones: { type: Number, default: 0 },
    transformacionesLímite: { type: Number, default: 0 },
    imagenes: { type: Number, default: 0 },
    videos: { type: Number, default: 0 },
    archivos: { type: Number, default: 0 },
    error: { type: String, default: null },
  },

  // Website
  website: {
    online: { type: Boolean, default: false },
    httpStatus: { type: Number, default: null },
    tiempoRespuestaMs: { type: Number, default: 0 },
    erroresAcumulados: { type: Number, default: 0 },
  },

  // Hostinger (si la API está disponible)
  hostinger: {
    disponible: { type: Boolean, default: false },
    almacenamientoUsadoMB: { type: Number, default: 0 },
    almacenamientoLímiteMB: { type: Number, default: 0 },
    almacenamientoPorcentaje: { type: Number, default: 0 },
    inodesUtilizados: { type: Number, default: 0 },
    inodesLímite: { type: Number, default: 0 },
    anchoBandaUsadoMB: { type: Number, default: 0 },
    anchoBandaLímiteMB: { type: Number, default: 0 },
    cpuPorcentaje: { type: Number, default: 0 },
    ramPorcentaje: { type: Number, default: 0 },
    uptimeSegundos: { type: Number, default: 0 },
    error: { type: String, default: null },
  },

  // Backups
  backups: {
    configurado: { type: Boolean, default: false },
    ultimoBackup: { type: Date, default: null },
    tamanoUltimoMB: { type: Number, default: 0 },
    estado: { type: String, default: 'no_configurado' }, // correcto | antiguo | fallido | no_configurado
  },
}, { timestamps: true });

// Índice para consultas por rango de fechas
healthMetricSchema.index({ timestamp: 1 });

module.exports = mongoose.model('HealthMetric', healthMetricSchema);
