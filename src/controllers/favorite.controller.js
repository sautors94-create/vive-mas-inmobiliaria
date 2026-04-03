const Favorite = require('../models/Favorite');
const Property = require('../models/Property');

const agregarFavorito = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    const existe = await Favorite.findOne({ usuario: req.user.id, propiedad: req.params.id });
    if (existe) return res.status(400).json({ error: 'Ya está en tus favoritos' });
    const favorito = await Favorite.create({ usuario: req.user.id, propiedad: req.params.id });
    res.status(201).json({ ok: true, mensaje: 'Agregado a favoritos', favorito });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listarFavoritos = async (req, res) => {
  try {
    const favoritos = await Favorite.find({ usuario: req.user.id })
      .populate({
        path: 'propiedad',
        populate: { path: 'propietario', select: 'nombre email telefono' }
      })
      .sort({ createdAt: -1 });
    res.json({ ok: true, total: favoritos.length, favoritos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarFavorito = async (req, res) => {
  try {
    const favorito = await Favorite.findOneAndDelete({ usuario: req.user.id, propiedad: req.params.id });
    if (!favorito) return res.status(404).json({ error: 'Favorito no encontrado' });
    res.json({ ok: true, mensaje: 'Eliminado de favoritos' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { agregarFavorito, listarFavoritos, eliminarFavorito };