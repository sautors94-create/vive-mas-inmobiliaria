const mongoose = require('mongoose');
const collector = require('../services/health/collector');
const systemConfigService = require('../services/health/systemConfigService');
const alertManager = require('../services/health/alertManager');
const HealthMetric = require('../models/HealthMetric');
const AlertLog = require('../models/AlertLog');
const AuditLog = require('../models/AuditLog');

// Calcula el índice de salud general de 0 a 100 (sección 16).
function calcularSalud(metricas) {
  let puntos = 100;

  if (metricas.node) {
    if (metricas.node.cpuPorcentaje >= 90 || metricas.node.ramPorcentaje >= 90) puntos -= 30;
    else if (metricas.node.cpuPorcentaje >= 70 || metricas.node.ramPorcentaje >= 75) puntos -= 15;
    else if (metricas.node.cpuPorcentaje >= 50) puntos -= 5;
  }

  if (metricas.mongodb && !metricas.mongodb.healthy && !metricas.mongodb.cacheado) puntos -= 25;

  if (metricas.cloudinary) {
    const pct = metricas.cloudinary.almacenamientoPorcentaje || 0;
    if (pct >= 90) puntos -= 30;
    else if (pct >= 80) puntos -= 20;
    else if (pct >= 70) puntos -= 10;
    else if (pct >= 50) puntos -= 5;
    if (metricas.cloudinary.error) puntos -= 15;
  }

  if (metricas.website && !metricas.website.online) puntos -= 25;

  if (metricas.backups && metricas.backups.estado === 'no_configurado') puntos -= 5;

  // No puede ser negativo
  return Math.max(0, Math.min(100, puntos));
}

// Determina si una métrica tiene nivel warning/critic por umbrales
function nivelServicio(metricas) {
  const servicios = [];
  const push = (nombre, estado, detalle) => servicios.push({ nombre, estado, detalle });

  // Node
  if (metricas.node) {
    const cpu = metricas.node.cpuPorcentaje || 0;
    const ram = metricas.node.ramPorcentaje || 0;
    const malo = Math.max(cpu, ram) >= 90;
    const atencion = Math.max(cpu, ram) >= 70;
    push('node', malo ? 'critico' : atencion ? 'atencion' : 'normal', { cpu, ram });
  }

  // MongoDB
  if (metricas.mongodb) {
    if (metricas.mongodb.cacheado) push('mongodb', 'normal', { cacheado: true });
    else push('mongodb', metricas.mongodb.healthy ? 'normal' : (metricas.mongodb.error ? 'critico' : 'normal'), { healthy: metricas.mongodb.healthy });
  }

  // Cloudinary
  if (metricas.cloudinary) {
    const pct = metricas.cloudinary.almacenamientoPorcentaje || 0;
    const estado = pct >= 90 ? 'critico' : pct >= 70 ? 'atencion' : 'normal';
    push('cloudinary', estado, { pct });
  }

  // Website
  if (metricas.website) {
    push('website', metricas.website.online ? 'normal' : 'critico', { status: metricas.website.httpStatus });
  }

  // Backups
  if (metricas.backups) {
    push('backups', metricas.backups.estado === 'no_configurado' ? 'atencion' : 'normal', { estado: metricas.backups.estado });
  }

  return servicios;
}

// Health check PÚBLICO (sin secretos) — regla sección 8
const healthPublico = (req, res) => {
  res.json({
    status: 'healthy',
    app: 'vive-mas-inmobiliaria',
    node: process.version,
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
  });
};

// Snapshot completo en tiempo real (protegido admin)
const obtenerSnapshot = async (req, res) => {
  try {
    const metricas = await collector.recolectar({ soloLigeras: false });
    const alertasActivas = await AlertLog.find({ estado: 'activa' }).sort({ fecha: -1 }).limit(100);
    const config = await systemConfigService.obtener();

    // Registrar auditoría de ejecución manual
    await AuditLog.create({
      usuario: req.user?.role === 'admin' ? (req.user.id || 'admin') : null,
      accion: 'health_check',
      detalle: 'Snapshot manual del centro de salud',
      resultado: 'exito',
      ip: req.ip,
    });

    res.json({
      ok: true,
      metricas,
      alertas: alertasActivas,
      config,
      saludGeneral: calcularSalud(metricas),
      servicios: nivelServicio(metricas),
      ultimaActualizacion: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error snapshot salud:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
};

// Histórico para gráficas
const obtenerHistorial = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const registros = await HealthMetric.find({ timestamp: { $gte: limite } })
      .sort({ timestamp: 1 });

    res.json({ ok: true, registros, dias });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// Estimación de crecimiento (sección 14)
const estimarCrecimiento = async (req, res) => {
  try {
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [actual, pasada] = await Promise.all([
      HealthMetric.findOne().sort({ timestamp: -1 }),
      HealthMetric.findOne({ timestamp: { $lte: hace30 } }).sort({ timestamp: -1 }),
    ]);

    // Solo calcular proyección si hay suficientes datos (regla sección 14)
    if (!actual || !pasada) {
      return res.json({
        ok: true,
        projection: null,
        mensaje: 'Se necesitan al menos 2 mediciones separadas ~30 días para generar una proyección.',
      });
    }

    const claveCloud = actual.cloudinary?.almacenamientoPorcentaje ? 'cloudinary' : null;

    const proyecciones = {};

    if (claveCloud && pasada.cloudinary?.almacenamientoPorcentaje != null) {
      const actualUso = actual.cloudinary.almacenamientoUsadoMB;
      const pasadoUso = pasada.cloudinary.almacenamientoUsadoMB;
      const crecMensual = actualUso - pasadoUso;
      const limite = actual.cloudinary.almacenamientoLímiteMB;
      if (crecMensual > 0 && limite > 0) {
        const restantesMB = limite - actualUso;
        const mesesRestantes = crecMensual > 0 ? restantesMB / crecMensual : Infinity;
        proyecciones.cloudinary = {
          usoActualMB: actualUso,
          uso30DiasMB: pasadoUso,
          crecimientoMensualMB: crecMensual,
          espacioRestanteMB: restantesMB,
          mesesRestantes: mesesRestantes === Infinity ? 'ilimitado' : Math.round(mesesRestantes * 10) / 10,
          esProyeccion: true,
        };
      }
    }

    res.json({
      ok: true,
      proyeccion: Object.keys(proyecciones).length ? proyecciones : null,
      mensaje: Object.keys(proyecciones).length ? null : 'Proyección no disponible (sin datos suficientes o sin límite conocido).',
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// Configuración de umbrales
const obtenerConfig = async (req, res) => {
  try {
    const config = await systemConfigService.obtener();
    res.json({ ok: true, config });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const guardarConfig = async (req, res) => {
  try {
    const config = await systemConfigService.actualizarUmbrales(req.body, req.user?.id || 'admin');
    await AuditLog.create({
      usuario: req.user?.id || 'admin',
      accion: 'cambio_umbrales',
      detalle: req.body,
      resultado: 'exito',
      ip: req.ip,
    });
    res.json({ ok: true, config });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// Alertas
const obtenerAlertas = async (req, res) => {
  try {
    const alertas = await AlertLog.find().sort({ fecha: -1 }).limit(200);
    res.json({ ok: true, alertas });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const atenderAlerta = async (req, res) => {
  try {
    await alertManager.marcarAtendida(req.params.id, req.user?.id || 'admin');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// Logs administrativos
const obtenerLogs = async (req, res) => {
  try {
    const { accion, limite = 100 } = req.query;
    const filtro = {};
    if (accion) filtro.accion = accion;
    const logs = await AuditLog.find(filtro).sort({ fecha: -1 }).limit(parseInt(limite));
    res.json({ ok: true, logs });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// Centro de riesgo (sección 15)
const obtenerRiesgos = async (req, res) => {
  try {
    const metricas = await collector.recolectar({ soloLigeras: true });
    const riesgos = [];

    if (metricas.cloudinary?.almacenamientoPorcentaje >= 90) {
      riesgos.push({ nivel: 'alto', servicio: 'Cloudinary', mensaje: 'Almacenamiento >90%' });
    } else if (metricas.cloudinary?.almacenamientoPorcentaje >= 70) {
      riesgos.push({ nivel: 'medio', servicio: 'Cloudinary', mensaje: 'Almacenamiento >70%' });
    }

    if (metricas.node?.cpuPorcentaje >= 90 || metricas.node?.ramPorcentaje >= 90) {
      riesgos.push({ nivel: 'alto', servicio: 'Node.js', mensaje: 'CPU/RAM >90%' });
    }

    if (!metricas.website?.online) {
      riesgos.push({ nivel: 'alto', servicio: 'Website', mensaje: 'Sitio fuera de línea' });
    }

    if (!metricas.mongodb?.healthy && !metricas.mongodb?.cacheado) {
      riesgos.push({ nivel: 'alto', servicio: 'MongoDB', mensaje: 'Base de datos no saludable' });
    }

    if (metricas.backups?.estado === 'no_configurado') {
      riesgos.push({ nivel: 'medio', servicio: 'Backups', mensaje: 'Backups no configurados' });
    }

    res.json({ ok: true, riesgos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = {
  healthPublico,
  obtenerSnapshot,
  obtenerHistorial,
  estimarCrecimiento,
  obtenerConfig,
  guardarConfig,
  obtenerAlertas,
  atenderAlerta,
  obtenerLogs,
  obtenerRiesgos,
};
