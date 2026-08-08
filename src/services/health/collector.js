const mongoMonitor = require('./monitors/mongoMonitor');
const cloudinaryMonitor = require('./monitors/cloudinaryMonitor');
const nodeMonitor = require('./monitors/nodeMonitor');
const websiteMonitor = require('./monitors/websiteMonitor');
const hostingerMonitor = require('./monitors/hostingerMonitor');
const backupMonitor = require('./monitors/backupMonitor');

const HealthMetric = require('../../models/HealthMetric');
const alertManager = require('./alertManager');

// Orquestador de métricas. Recopila todos los monitores, guarda un snapshot
// histórico y evalúa alertas. Permite ejecutar solo métricas "ligeras"
// (node, website) cada ciclo y las "costosas/caché" (mongo, cloudinary,
// hostinger, backups) con menos frecuencia.
const collector = {
  async recolectar({ soloLigeras = false } = {}) {
    // Monitores ligeros: siempre
    const node = await nodeMonitor.recolectar();
    const website = await websiteMonitor.recolectar();

    let mongodb = null;
    let cloudinary = null;
    let hostinger = null;
    let backups = null;

    if (!soloLigeras) {
      // Costosos: solo en ciclos completos
      [mongodb, cloudinary, hostinger, backups] = await Promise.allSettled([
        mongoMonitor.recolectar(),
        cloudinaryMonitor.recolectar(),
        hostingerMonitor.recolectar(),
        backupMonitor.recolectar(),
      ]);
      mongodb = mongodb.status === 'fulfilled' ? mongodb.value : { healthy: false, error: mongodb.reason?.message };
      cloudinary = cloudinary.status === 'fulfilled' ? cloudinary.value : { healthy: false, error: cloudinary.reason?.message };
      hostinger = hostinger.status === 'fulfilled' ? hostinger.value : { disponible: false, error: hostinger.reason?.message };
      backups = backups.status === 'fulfilled' ? backups.value : { estado: 'fallido', error: backups.reason?.message };
    } else {
      mongodb = { healthy: false, error: null, cacheado: true };
      cloudinary = { healthy: false, error: null, cacheado: true };
      hostinger = { disponible: false, error: null, cacheado: true };
      backups = { estado: 'no_configurado', cacheado: true };
    }

    const metricas = {
      timestamp: new Date(),
      node,
      website,
      mongodb,
      cloudinary,
      hostinger,
      backups,
    };

    try {
      await HealthMetric.create(metricas);
      // Mantener historial acotado (últimos 90 días aprox): se conservan las
      // métricas y un index, la limpieza se hace en el scheduler.
    } catch (e) {
      console.error('❌ Error guardando HealthMetric:', e.message);
    }

    await alertManager.evaluar(metricas);

    return metricas;
  },
};

module.exports = collector;
