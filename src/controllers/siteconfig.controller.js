const SiteConfig = require('../models/SiteConfig');

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
      .populate({ path: 'destacadas', match: { status: 'aprobada' } });
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
      if (!config.destacadas.includes(propiedadId)) config.destacadas.push(propiedadId);
    } else if (accion === 'quitar') {
      config.destacadas = config.destacadas.filter(id => id.toString() !== propiedadId);
    }
    await config.save();
    res.json({ ok: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const guardarTemaPersonalizado = async (req, res) => {
  try {
    const { nombre, primary, primaryLight, accent, accentDark, bgDark } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del tema es requerido' });
    let config = await SiteConfig.findOne({ activo: true });
    if (!config) config = await SiteConfig.create({});
    const existeIndex = config.temasPersonalizados.findIndex(t => t.nombre === nombre);
    if (existeIndex >= 0) {
      config.temasPersonalizados[existeIndex] = { nombre, primary, primaryLight, accent, accentDark, bgDark };
    } else {
      config.temasPersonalizados.push({ nombre, primary, primaryLight, accent, accentDark, bgDark });
    }
    await config.save();
    res.json({ ok: true, temas: config.temasPersonalizados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarTemaPersonalizado = async (req, res) => {
  try {
    let config = await SiteConfig.findOne({ activo: true });
    if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
    config.temasPersonalizados = config.temasPersonalizados.filter(
      t => t._id.toString() !== req.params.id
    );
    await config.save();
    res.json({ ok: true, temas: config.temasPersonalizados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener los enlaces de pago (Stripe Payment Links) configurables
const getPagos = async (req, res) => {
  try {
    let config = await SiteConfig.findOne({ activo: true });
    if (!config) config = await SiteConfig.create({});
    res.json({ ok: true, pagos: config.pagos || {} });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// Actualizar los enlaces de pago (Stripe Payment Links) desde el panel admin
const actualizarPagos = async (req, res) => {
  try {
    const { basico_mensual, basico_anual, basico_mesgratis, basico_10, basico_15 } = req.body;
    let config = await SiteConfig.findOne({ activo: true });
    if (!config) config = await SiteConfig.create({});

    config.pagos = {
      basico_mensual: basico_mensual || config.pagos?.basico_mensual,
      basico_anual: basico_anual || config.pagos?.basico_anual,
      basico_mesgratis: basico_mesgratis || config.pagos?.basico_mesgratis,
      basico_10: basico_10 || config.pagos?.basico_10,
      basico_15: basico_15 || config.pagos?.basico_15,
    };

    await config.save();
    res.json({ ok: true, pagos: config.pagos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = { getConfig, actualizarTema, getDestacadas, actualizarDestacadas, guardarTemaPersonalizado, eliminarTemaPersonalizado, getPagos, actualizarPagos };
