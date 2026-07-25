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
  pausarPropiedad,
  reactivarPropiedad,
  misPropiedades,
  subirFotos
} = require('../controllers/property.controller');

router.get('/', listarPropiedades);
router.get('/mis-propiedades', authMiddleware, misPropiedades);
router.get('/:id', detallePropiedad);
router.post('/', authMiddleware, crearPropiedad);
router.put('/:id', authMiddleware, editarPropiedad);
router.patch('/:id/pausar', authMiddleware, pausarPropiedad);
router.patch('/:id/reactivar', authMiddleware, reactivarPropiedad);
router.delete('/:id', authMiddleware, eliminarPropiedad);
router.post('/:id/fotos', authMiddleware, upload.array('fotos', 15), subirFotos);
router.get('/estados/disponibles', async (req, res) => {
  try {
    const estados = await require('../models/Property').aggregate([
      { $match: { status: 'aprobada' } },
      { $group: { _id: '$ubicacion.estado', total: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    res.json({ ok: true, estados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;