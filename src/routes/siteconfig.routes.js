const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const {
  getConfig,
  actualizarTema,
  getDestacadas,
  actualizarDestacadas,
  guardarTemaPersonalizado,
  eliminarTemaPersonalizado
} = require('../controllers/siteconfig.controller');

router.get('/config', getConfig);
router.get('/destacadas', getDestacadas);
router.patch('/tema', authMiddleware, requireRole('admin'), actualizarTema);
router.patch('/destacadas', authMiddleware, requireRole('admin'), actualizarDestacadas);
router.post('/temas-personalizados', authMiddleware, requireRole('admin'), guardarTemaPersonalizado);
router.delete('/temas-personalizados/:id', authMiddleware, requireRole('admin'), eliminarTemaPersonalizado);

module.exports = router;