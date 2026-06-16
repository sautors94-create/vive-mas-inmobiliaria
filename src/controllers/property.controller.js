const { subirACloudinary } = require('../config/cloudinary');
const Property = require('../models/Property');

const crearPropiedad = async (req, res) => {
  try {
    const { titulo, descripcion, precio, operacion, tipo, ubicacion, caracteristicas } = req.body;
    const propiedad = await Property.create({
      titulo, descripcion, precio, operacion, tipo, ubicacion, caracteristicas,
      propietario: req.user.id,
      status: 'revision'
    });
    res.status(201).json({ ok: true, mensaje: 'Propiedad enviada a revisión', propiedad });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listarPropiedades = async (req, res) => {
  try {
    const { operacion, tipo, estado, ciudad, precioMin, precioMax, pagina = 1, limite = 15 } = req.query;
    const filtro = { status: 'aprobada' };
    if (operacion) filtro.operacion = operacion;
    if (tipo) filtro.tipo = tipo;
    if (estado) filtro['ubicacion.estado'] = estado;
    if (ciudad) filtro['ubicacion.ciudad'] = ciudad;
    if (precioMin || precioMax) {
      filtro.precio = {};
      if (precioMin) filtro.precio.$gte = Number(precioMin);
      if (precioMax) filtro.precio.$lte = Number(precioMax);
    }
    const skip = (Number(pagina) - 1) * Number(limite);
    const total = await Property.countDocuments(filtro);
    const propiedades = await Property.find(filtro)
      .populate('propietario', 'nombre avatar')
      .sort({ destacada: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limite));
    res.json({
      ok: true,
      total,
      paginas: Math.ceil(total / Number(limite)),
      paginaActual: Number(pagina),
      propiedades
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const detallePropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id)
      .populate('propietario', 'nombre avatar');
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.status !== 'aprobada') return res.status(403).json({ error: 'Propiedad no disponible' });
    // 'pausada' se oculta automáticamente porque solo se consultan propiedades con status 'aprobada'

    res.json({ ok: true, propiedad });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const editarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta propiedad' });
    }
    const actualizada = await Property.findByIdAndUpdate(
      req.params.id,
      { ...req.body, status: 'revision' },
      { new: true }
    );
    res.json({ ok: true, mensaje: 'Propiedad actualizada y enviada a revisión', propiedad: actualizada });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta propiedad' });
    }
    await Property.findByIdAndUpdate(req.params.id, { status: 'rechazada' });
    res.json({ ok: true, mensaje: 'Propiedad eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const misPropiedades = async (req, res) => {
  try {
    const propiedades = await Property.find({ propietario: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ ok: true, total: propiedades.length, propiedades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const subirFotos = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se subieron imágenes' });
    }
    const urls = await Promise.all(
      req.files.map(file => subirACloudinary(file.buffer, file.mimetype))
    );
    propiedad.fotos = [...propiedad.fotos, ...urls];
    await propiedad.save();
    res.json({ ok: true, mensaje: `${urls.length} foto(s) subida(s)`, fotos: propiedad.fotos });
  } catch (error) {
    console.error('Error subirFotos:', error.message);
    res.status(500).json({ error: error.message });
  }
};
module.exports = { crearPropiedad, listarPropiedades, detallePropiedad, editarPropiedad, eliminarPropiedad, misPropiedades, subirFotos };