const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const {
  getUsuarios,
  cambiarPlan,
  suspenderUsuario,
  getPropiedadesRevision,
  aprobarPropiedad,
  rechazarPropiedad,
  dashboard
} = require('../controllers/admin.controller');

router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/dashboard', dashboard);
router.get('/usuarios', getUsuarios);
router.patch('/usuarios/:id/plan', cambiarPlan);
router.patch('/usuarios/:id/suspender', suspenderUsuario);
router.get('/propiedades', getPropiedadesRevision);
router.patch('/propiedades/:id/aprobar', aprobarPropiedad);
router.patch('/propiedades/:id/rechazar', rechazarPropiedad);

module.exports = router;