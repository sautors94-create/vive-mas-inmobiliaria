const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const {
  enviarMensaje,
  misConversaciones,
  conversacionPorId,
  conversacionPropiedad,
  mensajesConRiesgo,
  marcarMensajeRevisado,
  getRiesgoStats,
  exportarMensajesRiesgoExcel,
  enviarMensajePropiedad,
  purgarMensajesAdmin
} = require('../controllers/message.controller');

router.use(authMiddleware);

// Rutas de usuario
router.get('/', misConversaciones);
router.get('/conversacion/:conversacionId', conversacionPorId);
router.get('/:id', conversacionPropiedad);
router.post('/', enviarMensaje);
// Compatibilidad con propiedad.html (envía POST /mensajes/:id con solo { mensaje })
router.post('/:id', enviarMensajePropiedad);

// Rutas de admin
router.get('/admin/riesgo/stats', requireRole('admin'), getRiesgoStats);
router.get('/admin/riesgo/exportar', requireRole('admin'), exportarMensajesRiesgoExcel);
router.get('/admin/riesgo', requireRole('admin'), mensajesConRiesgo);
router.patch('/admin/:id/revisado', requireRole('admin'), marcarMensajeRevisado);
router.post('/admin/purgar', requireRole('admin'), purgarMensajesAdmin);

module.exports = router;

