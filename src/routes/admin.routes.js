const express = require('express');
const multer = require('multer');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const {
  getUsuarios,
  cambiarPlan,
  suspenderUsuario,
  eliminarUsuario,
  getPropiedadesRevision,
  aprobarPropiedad,
  rechazarPropiedad,
  eliminarPropiedad,
  bloquearPropiedad,
  getLeads,
  dashboard,
  crearUsuariosMasivo,
  descargarPlantillaUsuarios
} = require('../controllers/admin.controller');

router.use(authMiddleware);
router.use(requireRole('admin'));

// Configuración de multer para subir archivos
const upload = multer({ storage: multer.memoryStorage() });

router.get('/dashboard', dashboard);
router.get('/leads', getLeads);
router.get('/usuarios', getUsuarios);
router.post('/usuarios/masivo', upload.single('archivo'), crearUsuariosMasivo);
router.get('/usuarios/plantilla', descargarPlantillaUsuarios);
router.patch('/usuarios/:id/plan', cambiarPlan);
router.patch('/usuarios/:id/suspender', suspenderUsuario);
router.delete('/usuarios/:id', eliminarUsuario);
router.get('/propiedades', getPropiedadesRevision);
router.patch('/propiedades/:id/aprobar', aprobarPropiedad);
router.patch('/propiedades/:id/rechazar', rechazarPropiedad);
router.patch('/propiedades/:id/bloquear', bloquearPropiedad);
router.delete('/propiedades/:id', eliminarPropiedad);

module.exports = router;
