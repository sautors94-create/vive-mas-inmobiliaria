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
  descargarPlantillaUsuarios,
  verPropiedadAdmin,
  getUsuariosVetados,
  vetarUsuario,
  desvetarUsuario,
  vincularAlias,
  desvincularAlias,
  buscarAliases
} = require('../controllers/admin.controller');

router.use(authMiddleware);
router.use(requireRole('admin'));

const upload = multer({ storage: multer.memoryStorage() });

// Dashboard
router.get('/dashboard', dashboard);

// Leads
router.get('/leads', getLeads);

// Usuarios
router.get('/usuarios', getUsuarios);
router.post('/usuarios/masivo', upload.single('archivo'), crearUsuariosMasivo);
router.get('/usuarios/plantilla', descargarPlantillaUsuarios);
router.patch('/usuarios/:id/plan', cambiarPlan);
router.patch('/usuarios/:id/suspender', suspenderUsuario);
router.delete('/usuarios/:id', eliminarUsuario);

// Propiedades
router.get('/propiedades', getPropiedadesRevision);
router.get('/propiedades/:id/preview', verPropiedadAdmin);
router.patch('/propiedades/:id/aprobar', aprobarPropiedad);
router.patch('/propiedades/:id/rechazar', rechazarPropiedad);
router.patch('/propiedades/:id/bloquear', bloquearPropiedad);
router.delete('/propiedades/:id', eliminarPropiedad);

// Usuarios vetados
router.get('/vetados', getUsuariosVetados);
router.post('/vetados/:id', vetarUsuario);
router.post('/vetados/:id/desvetar', desvetarUsuario);
router.post('/vetados/:id/aliases', vincularAlias);
router.post('/vetados/alias/:aliasId/desvincular', desvincularAlias);
router.get('/vetados/:id/aliases/buscar', buscarAliases);

module.exports = router;