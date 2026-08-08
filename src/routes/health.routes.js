const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const {
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
} = require('../controllers/health.controller');

// ==========================================
// HEALTH CHECK PÚBLICO (sin secretos)
// ==========================================
router.get('/public', healthPublico);

// ==========================================
// RUTAS PROTEGIDAS (solo admin)
// ==========================================
// Todas las rutas de aquí abajo requieren rol admin
router.use(authMiddleware);
router.use(requireRole('admin'));

// Snapshot completo en tiempo real
router.get('/', obtenerSnapshot);

// Histórico para gráficas
router.get('/historial', obtenerHistorial);

// Estimación de crecimiento / proyección
router.get('/crecimiento', estimarCrecimiento);

// Configuración de umbrales
router.get('/config', obtenerConfig);
router.put('/config', guardarConfig);

// Alertas
router.get('/alertas', obtenerAlertas);
router.post('/alertas/:id/atender', atenderAlerta);

// Logs administrativos
router.get('/logs', obtenerLogs);

// Centro de riesgo
router.get('/riesgos', obtenerRiesgos);

module.exports = router;
