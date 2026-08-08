const AlertLog = require('../../models/AlertLog');
const systemConfigService = require('./systemConfigService');

// Lógica de nivel para Cloudinary (sección 6 del prompt):
// 50% info | 70% atención | 80% advertencia | 90% crítico | 95% emergencia
function nivelCloudinary(pct) {
  if (pct >= 95) return 'emergencia';
  if (pct >= 90) return 'critico';
  if (pct >= 80) return 'advertencia';
  if (pct >= 70) return 'warning';
  if (pct >= 50) return 'info';
  return null;
}

// Determina si un porcentaje supera un umbral warning/critical genérico
function nivelGenerico(pct, cfg, servicio) {
  const u = cfg.umbrales[servicio] || { warning: 70, critical: 90 };
  if (pct >= u.critical) return 'critico';
  if (pct >= u.warning) return 'warning';
  return null;
}

// Crea/reutiliza una alerta activa (evita spam: si ya hay una igual activa, omite).
async function registrarAlerta({ servicio, severidad, descripcion, valorActual, limite, recomendacion }) {
  if (!severidad) return null;
  const existe = await AlertLog.findOne({ servicio, severidad, estado: 'activa', descripcion });
  if (existe) return existe;
  return await AlertLog.create({ servicio, severidad, descripcion, valorActual, limite, recomendacion });
}

// Evalúa todas las métricas recopiladas y genera alertas.
// Devuelve las alertas activas del momento.
const alertManager = {
  async evaluar(metricas) {
    try {
      const cfg = await systemConfigService.obtener();

      // --- Cloudinary ---
      if (metricas.cloudinary) {
        const pct = metricas.cloudinary.almacenamientoPorcentaje || 0;
        const nivel = nivelCloudinary(pct);
        if (nivel) {
          await registrarAlerta({
            servicio: 'cloudinary',
            severidad: nivel,
            descripcion: `Cloudinary ha alcanzado el ${pct}% de utilización de almacenamiento.`,
            valorActual: pct,
            limite: null,
            recomendacion: 'Revisar recursos y eliminar archivos innecesarios o ampliar la capacidad.',
          });
        }
      }

      // --- MongoDB (tamaño base) ---
      if (metricas.mongodb) {
        const nivel = nivelGenerico(metricas.mongodb.tamanoBaseMB > 0 ? 50 : 0, cfg, 'mongodb');
        // No generamos alerta por tamaño bruto sin límite conocido; solo si hay error:
        if (!metricas.mongodb.healthy && metricas.mongodb.error) {
          await registrarAlerta({
            servicio: 'mongodb',
            severidad: 'critico',
            descripcion: `MongoDB no está saludable: ${metricas.mongodb.error}`,
            valorActual: metricas.mongodb.error,
            recomendacion: 'Revisar conexión y estado del cluster MongoDB.',
          });
        }
      }

      // --- Node CPU / RAM ---
      if (metricas.node) {
        const nivelCpu = nivelGenerico(metricas.node.cpuPorcentaje, cfg, 'cpu');
        await registrarAlerta({
          servicio: 'node',
          severidad: nivelCpu,
          descripcion: nivelCpu ? `CPU de Node al ${metricas.node.cpuPorcentaje}%.` : null,
          valorActual: metricas.node.cpuPorcentaje,
          recomendacion: 'Revisar procesos o ampliar recursos.',
        });

        const nivelRam = nivelGenerico(metricas.node.ramPorcentaje, cfg, 'ram');
        await registrarAlerta({
          servicio: 'node',
          severidad: nivelRam,
          descripcion: nivelRam ? `RAM al ${metricas.node.ramPorcentaje}%.` : null,
          valorActual: metricas.node.ramPorcentaje,
          recomendacion: 'Revisar uso de memoria del proceso.',
        });
      }

      // --- Website ---
      if (metricas.website && !metricas.website.online) {
        await registrarAlerta({
          servicio: 'website',
          severidad: 'critico',
          descripcion: 'El sitio web no responde correctamente.',
          valorActual: metricas.website.httpStatus,
          recomendacion: 'Revisar el estado del servidor y los logs de error.',
        });
      }

      // --- Backups ---
      if (metricas.backups && metricas.backups.estado === 'no_configurado') {
        await registrarAlerta({
          servicio: 'backups',
          severidad: 'warning',
          descripcion: 'No hay backups del sistema configurados.',
          valorActual: 'no_configurado',
          recomendacion: 'Configurar copias de seguridad (mongodump / Atlas Cloud Backup).',
        });
      }

      // Alertas activas (para el panel)
      return await AlertLog.find({ estado: 'activa' }).sort({ fecha: -1 }).limit(50);
    } catch (e) {
      console.error('❌ Error en alertManager:', e.message);
      return [];
    }
  },

  async marcarAtendida(id, usuario) {
    const alerta = await AlertLog.findById(id);
    if (!alerta) return false;
    alerta.atendida = true;
    alerta.atendidaPor = usuario;
    alerta.atendidaFecha = new Date();
    alerta.estado = 'resuelta';
    await alerta.save();
    return true;
  },
};

module.exports = alertManager;
