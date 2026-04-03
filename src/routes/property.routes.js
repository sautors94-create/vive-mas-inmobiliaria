const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  crearPropiedad,
  listarPropiedades,
  detallePropiedad,
  editarPropiedad,
  eliminarPropiedad,
  misPropiedades
} = require('../controllers/property.controller');

router.get('/', listarPropiedades);
router.get('/mis-propiedades', authMiddleware, misPropiedades);
router.get('/:id', detallePropiedad);
router.post('/', authMiddleware, crearPropiedad);
router.put('/:id', authMiddleware, editarPropiedad);
router.delete('/:id', authMiddleware, eliminarPropiedad);

module.exports = router;