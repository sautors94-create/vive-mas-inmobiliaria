const Reporte = require('../models/reporte');
const Property = require('../models/Property');
const Message = require('../models/Message');

const crearReporte = async (req, res) => {
  try {
    const { tipo, propiedadId, conversacionId, motivo, detalle } = req.body;
    const motivosValidos = ['spam', 'fraude', 'contenido_inapropiado', 'informacion_falsa', 'acoso', 'otro'];

    if (!['propiedad', 'mensaje'].includes(tipo)) return res.status(400).json({ error: 'Tipo de reporte no válido' });
    if (!motivosValidos.includes(motivo)) return res.status(400).json({ error: 'Motivo no válido' });

    let usuarioReportado = null;
    let propiedad = null;

    if (tipo === 'propiedad') {
      if (!propiedadId) return res.status(400).json({ error: 'Falta la propiedad a reportar' });
      propiedad = await Property.findById(propiedadId);
      if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
      usuarioReportado = propiedad.propietario;
    } else {
      if (!conversacionId) return res.status(400).json({ error: 'Falta la conversación a reportar' });
      const ultimoMensaje = await Message.findOne({ conversacionId }).sort({ createdAt: -1 });
      if (ultimoMensaje) {
        usuarioReportado = ultimoMensaje.remitente.toString() === req.user.id ? ultimoMensaje.destinatario : ultimoMensaje.remitente;
      }
    }

    const reporte = await Reporte.create({
      tipo,
      propiedad: propiedad?._id || null,
      conversacionId: conversacionId || null,
      usuarioReportado,
      reportadoPor: req.user.id,
      motivo,
      detalle: detalle || null,
    });

    res.status(201).json({ ok: true, mensaje: 'Reporte enviado. Nuestro equipo lo revisará pronto.', reporte });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// ADMIN
// ==========================================
const getReportes = async (req, res) => {
  try {
    const { status, tipo } = req.query;
    const filtro = {};
    if (status) filtro.status = status;
    if (tipo) filtro.tipo = tipo;

    const reportes = await Reporte.find(filtro)
      .sort({ createdAt: -1 })
      .populate('propiedad', 'titulo status')
      .populate('usuarioReportado', 'nombre email')
      .populate('reportadoPor', 'nombre email')
      .populate('revisadoPor', 'nombre');

    res.json({ ok: true, reportes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getReportesStats = async (req, res) => {
  try {
    const pendientes = await Reporte.countDocuments({ status: 'pendiente' });
    const revisados = await Reporte.countDocuments({ status: 'revisado' });
    const descartados = await Reporte.countDocuments({ status: 'descartado' });
    const totalPropiedad = await Reporte.countDocuments({ tipo: 'propiedad' });
    const totalMensaje = await Reporte.countDocuments({ tipo: 'mensaje' });
    res.json({ ok: true, pendientes, revisados, descartados, totalPropiedad, totalMensaje });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarReporte = async (req, res) => {
  try {
    const { status, notasAdmin } = req.body;
    const statusValidos = ['pendiente', 'revisado', 'descartado'];
    if (status && !statusValidos.includes(status)) return res.status(400).json({ error: 'Estado no válido' });

    const update = {};
    if (status) { update.status = status; update.revisadoPor = req.user.id; }
    if (notasAdmin !== undefined) update.notasAdmin = notasAdmin;

    const reporte = await Reporte.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('propiedad', 'titulo status')
      .populate('usuarioReportado', 'nombre email')
      .populate('reportadoPor', 'nombre email');

    if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json({ ok: true, reporte });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarReporte = async (req, res) => {
  try {
    const reporte = await Reporte.findByIdAndDelete(req.params.id);
    if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json({ ok: true, mensaje: 'Reporte eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { crearReporte, getReportes, getReportesStats, actualizarReporte, eliminarReporte };