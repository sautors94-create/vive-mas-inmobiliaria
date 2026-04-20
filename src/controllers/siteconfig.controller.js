const SiteConfig = require('../models/SiteConfig');
const Property = require('../models/Property');

const getConfig = async (req, res) => {
  try {
    let config = await SiteConfig.findOne({ activo: true });
    if (!config) config = await SiteConfig.create({});
    res.json({ ok: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarTema = async (req, res) => {
  try {
    const { tema } = req.body;
    let config = await SiteConfig.findOne({ activo: true });
    if (!config) config = await SiteConfig.create({});
    config.tema = { ...config.tema, ...tema };
    await config.save();
    res.json({ ok: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDestacadas = async (req, res) => {
  try {
    let config = await SiteConfig.findOne({ activo: true })
      .populate({
        path: 'destacadas',
        match: { status: 'aprobada' }
      });
    if (!config) config = await SiteConfig.create({});
    res.json({ ok: true, destacadas: config.destacadas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarDestacadas = async (req, res) => {
  try {
    const { propiedadId, accion } = req.body;
    let config = await SiteConfig.findOne({ activo: true });
    if (!config) config = await SiteConfig.create({});
    if (accion === 'agregar') {
      if (!config.destacadas.includes(propiedadId)) {
        config.destacadas.push(propiedadId);
      }
    } else if (accion === 'quitar') {
      config.destacadas = config.destacadas.filter(id => id.toString() !== propiedadId);
    }
    await config.save();
    res.json({ ok: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getConfig, actualizarTema, getDestacadas, actualizarDestacadas };
