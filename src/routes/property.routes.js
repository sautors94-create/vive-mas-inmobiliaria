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
  subirFotos,
  registrarBusqueda
} = require('../controllers/property.controller');
const { reintentarPublicacion } = require('../../services/marketingAutomation/events/propertyPublished.handler');

router.get('/', listarPropiedades);
router.get('/mis-propiedades', authMiddleware, misPropiedades);
router.post('/registrar-busqueda', authMiddleware, registrarBusqueda);
router.get('/:id', detallePropiedad);
router.post('/', authMiddleware, crearPropiedad);
router.put('/:id', authMiddleware, editarPropiedad);
router.patch('/:id/pausar', authMiddleware, pausarPropiedad);
router.patch('/:id/reactivar', authMiddleware, reactivarPropiedad);
router.delete('/:id', authMiddleware, eliminarPropiedad);
router.post('/:id/fotos', authMiddleware, upload.array('fotos', 15), subirFotos);
router.post('/:id/reintentar-publicacion', authMiddleware, async (req, res) => {
  try {
    const { plataforma } = req.body;
    if (!plataforma || !['facebook', 'instagram'].includes(plataforma)) {
      return res.status(400).json({ error: 'Plataforma no válida' });
    }
    const resultado = await reintentarPublicacion(req.params.id, plataforma);
    if (resultado.ok) {
      return res.json({ ok: true, mensaje: 'Publicación realizada correctamente', resultado });
    }
    if (resultado.omitida) {
      return res.status(400).json({ error: 'La propiedad no cumple las condiciones para publicar en redes sociales.' });
    }
    return res.status(400).json({ error: resultado.error?.message || resultado.error || 'No se pudo publicar' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
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