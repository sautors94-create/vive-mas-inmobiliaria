const collector = require('./collector');
const systemConfigService = require('./systemConfigService');
const HealthMetric = require('../../models/HealthMetric');

// Programador de métricas. Sin dependencias externas (no node-cron).
// Usa setInterval para:
//  - ciclo ligero: node + website (cada 30s por defecto, configurable)
//  - ciclo completo: + mongo + cloudinary + hostinger + backups
//    (cada 300s por defecto, configurable)
// También hace limpieza de historial mayor a 90 días (una vez al día).
const healthScheduler = {
  timers: [],
  iniciar() {
    // Ejecutar una recolección completa al arrancar (tras pequeño delay)
    setTimeout(() => {
      collector.recolectar({ soloLigeras: false }).catch((e) =>
        console.error('❌ Health inicial:', e.message)
      );
    }, 3000);

    const configurar = async () => {
      const cfg = await systemConfigService.obtener();
      const intervaloLigero = cfg.intervalosSeg.visual * 1000;
      const intervaloCompleto = cfg.intervalosSeg.metricasCostosas * 1000;

      // Evitar timers duplicados si se reconfigura
      this.detener();

      // Ciclo ligero (node + website)
      this.timers.push(setInterval(() => {
        collector.recolectar({ soloLigeras: true }).catch((e) =>
          console.error('❌ Health ligero:', e.message)
        );
      }, intervaloLigero));

      // Ciclo completo (todo)
      this.timers.push(setInterval(() => {
        collector.recolectar({ soloLigeras: false }).catch((e) =>
          console.error('❌ Health completo:', e.message)
        );
      }, intervaloCompleto));

      // Limpieza diaria de historial > 90 días
      this.timers.push(setInterval(async () => {
        try {
          const limite = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          await HealthMetric.deleteMany({ timestamp: { $lt: limite } });
        } catch (e) {
          console.error('❌ Limpieza HealthMetric:', e.message);
        }
      }, 24 * 60 * 60 * 1000));
    };

    configurar().catch((e) => console.error('❌ Scheduler config:', e.message));
  },

  detener() {
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
  },
};

module.exports = healthScheduler;
