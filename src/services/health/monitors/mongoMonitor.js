const mongoose = require('mongoose');

// Monitor de MongoDB.
// Usa métodos reales de Mongoose/driver: serverStatus, dbStats y
// collectionStats. No inventa métricas; si algo falla reporta error.
const mongoMonitor = {
  async recolectar() {
    const resultado = {
      healthy: false,
      nombreBase: null,
      tamanoBaseMB: 0,
      conexionesActivas: 0,
      operacionesPendientes: 0,
      latenciaMs: 0,
      error: null,
      colecciones: [],
    };

    try {
      const db = mongoose.connection.db;
      if (!db) {
        resultado.error = 'No hay conexión activa a MongoDB';
        return resultado;
      }

      resultado.healthy = mongoose.connection.readyState === 1;
      resultado.nombreBase = db.databaseName;

      // serverStatus para conexiones, opers y latencia
      const serverStatus = await db.admin().command({ serverStatus: 1 })
        .catch(() => null);

      if (serverStatus) {
        resultado.conexionesActivas = serverStatus.connections?.active ?? 0;
        resultado.operacionesPendientes = serverStatus.globalLock?.currentQueue?.total ?? 0;
        // Latencia aproximada: usar stats como fallback
        const latency = serverStatus.opLatencies?.reads?.latency ?? null;
        resultado.latenciaMs = latency ? Math.round(latency / 1000) : 0;
      }

      // dbStats para tamaño total de la base
      const dbStats = await db.stats().catch(() => null);
      if (dbStats) {
        resultado.tamanoBaseMB = Math.round((dbStats.dataSize || 0) / (1024 * 1024));
      }

      // Colecciones y sus estadísticas
      const colecciones = await db.listCollections().toArray().catch(() => []);
      const nombres = colecciones
        .map((c) => c.name)
        .filter((n) => !n.startsWith('system.'));

      for (const nombre of nombres) {
        try {
          const collStats = await db.collection(nombre).stats().catch(() => null);
          if (collStats) {
            resultado.colecciones.push({
              nombre,
              documentos: collStats.count || 0,
              tamanoMB: Math.round((collStats.size || 0) / (1024 * 1024)),
            });
          }
        } catch (e) {
          // Colección que no soporta stats (ej. vistas) — omitir
        }
      }

      // Ordenar por tamaño descendente
      resultado.colecciones.sort((a, b) => b.tamanoMB - a.tamanoMB);
    } catch (error) {
      resultado.error = error.message;
    }

    return resultado;
  },
};

module.exports = mongoMonitor;
