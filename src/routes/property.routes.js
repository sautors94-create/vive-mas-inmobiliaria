const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { upload } = require('../config/cloudinary');
const {
  crearPropiedad,
  listarPropiedades,
  detallePropiedad,
  editarPropiedad,
  eliminarPropiedad,
  misPropiedades,
  subirFotos
} = require('../controllers/property.controller');

router.get('/', listarPropiedades);
router.get('/mis-propiedades', authMiddleware, misPropiedades);
router.get('/:id', detallePropiedad);
router.post('/', authMiddleware, crearPropiedad);
router.put('/:id', authMiddleware, editarPropiedad);
router.delete('/:id', authMiddleware, eliminarPropiedad);
router.post('/:id/fotos', authMiddleware, upload.array('fotos', 15), subirFotos);

module.exports = router;