const User = require('../models/User');
const Property = require('../models/Property');

const getUsuarios = async (req, res) => {
  try {
    const { plan, role, status, search } = req.query;
    const filtro = {};
    if (plan) filtro.plan = plan;
    if (role) filtro.role = role;
    if (status) filtro.status = status;
    if (search) filtro.$or = [
      { nombre: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    const usuarios = await User.find(filtro).sort({ createdAt: -1 });
    res.json({ ok: true, total: usuarios.length, usuarios });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const cambiarPlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const planesValidos = ['gratuito', 'basico', 'premium'];
    if (!planesValidos.includes(plan)) return res.status(400).json({ error: 'Plan no válido' });
    const usuario = await User.findByIdAndUpdate(req.params.id, { plan }, { new: true });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true, usuario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const suspenderUsuario = async (req, res) => {
  try {
    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    usuario.status = usuario.status === 'activo' ? 'suspendido' : 'activo';
    await usuario.save();
    res.json({ ok: true, mensaje: `Usuario ${usuario.status}`, usuario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarUsuario = async (req, res) => {
  try {
    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (usuario.role === 'admin') return res.status(403).json({ error: 'No puedes eliminar un admin' });
    await Property.updateMany({ propietario: req.params.id }, { status: 'rechazada' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true, mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPropiedadesRevision = async (req, res) => {
  try {
    const { status, search, estado, tipo } = req.query;
    const filtro = {};

    if (status) filtro.status = status;

    if (estado) filtro['ubicacion.estado'] = estado;
    if (tipo) filtro.tipo = tipo;
    if (search) filtro.$or = [
      { titulo: { $regex: search, $options: 'i' } },
      { 'ubicacion.ciudad': { $regex: search, $options: 'i' } },
      { 'ubicacion.estado': { $regex: search, $options: 'i' } }
    ];
    const propiedades = await Property.find(filtro)
      .populate('propietario', 'nombre email telefono plan')
      .sort({ createdAt: -1 });
    res.json({ ok: true, total: propiedades.length, propiedades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const { buildMensajeAprobacion, buildMensajeRechazoFotos, validarFotosParaAprobacion } = require('../utils/adminMessages');
const { enviarNotificacionMensaje } = require('../utils/email');


const enviarMensajeInternoParaPropiedad = async ({ req, propiedadId, mensaje }) => {
  // Crea el mensaje usando el flujo existente de messages
  const Message = require('../models/Message');
  const propiedad = await Property.findById(propiedadId).populate('propietario', 'nombre notificaciones');
  if (!propiedad) throw new Error('Propiedad no encontrada');

  const remitenteId = req.user.id; // admin
  const destinatarioId = propiedad.propietario._id;

  if (destinatarioId.toString() === remitenteId.toString()) {
    // Evitar envío a sí mismo
    return;
  }

  const nuevoMensaje = await Message.create({
    propiedad: propiedadId,
    remitente: remitenteId,
    destinatario: destinatarioId,
    mensaje
  });

  await nuevoMensaje.populate('remitente', 'nombre email');
  await nuevoMensaje.populate('destinatario', 'nombre email');

  // Notificación email si el usuario lo tiene activo
  const notifs = propiedad.propietario.notificaciones;
  const enviarEmail = !notifs || notifs.mensajes !== false;
  if (enviarEmail && propiedad.propietario.email) {
    try {
      await enviarNotificacionMensaje(
        propiedad.propietario.email,
        propiedad.propietario.nombre,
        req.user.nombre || 'Admin',
        propiedad.titulo,
        mensaje
      );
    } catch (_) {}
  }
};

const aprobarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id).populate('propietario', 'nombre notificaciones');
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

    // Validación inicial de fotos: rechazar si fotos < 2
    const minFotos = 2;
    const fotosOK = validarFotosParaAprobacion({ propiedad, minFotos });

    if (!fotosOK) {
      await Property.findByIdAndUpdate(req.params.id, {
        status: 'rechazada',
        motivo_rechazo: 'Rechazada por validación de fotos (no se cargaron correctamente o faltan fotos).'
      }, { new: true });

      const msg = buildMensajeRechazoFotos({
        nombre: propiedad.propietario.nombre,
        titulo: propiedad.titulo,
        motivo: 'No se cargaron correctamente o faltan fotos. Por favor sube nuevamente.'
      });

      await enviarMensajeInternoParaPropiedad({ req, propiedadId: req.params.id, mensaje: msg });

      return res.json({ ok: true, mensaje: 'Propiedad rechazada (validación de fotos)', propiedad: { ...propiedad.toObject(), status: 'rechazada' } });
    }

    const updated = await Property.findByIdAndUpdate(
      req.params.id,
      { status: 'aprobada', motivo_rechazo: null },
      { new: true }
    );

    const msg = buildMensajeAprobacion({ nombre: propiedad.propietario.nombre, titulo: propiedad.titulo, status: 'autorizada' });
    await enviarMensajeInternoParaPropiedad({ req, propiedadId: req.params.id, mensaje: msg });

    res.json({ ok: true, mensaje: 'Propiedad aprobada', propiedad: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const rechazarPropiedad = async (req, res) => {
  try {
    const { motivo } = req.body;
    if (!motivo) return res.status(400).json({ error: 'Debes indicar el motivo de rechazo' });

    const propiedad = await Property.findById(req.params.id).populate('propietario', 'nombre notificaciones');
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const updated = await Property.findByIdAndUpdate(
      req.params.id,
      { status: 'rechazada', motivo_rechazo: motivo },
      { new: true }
    );

    const msg = buildMensajeRechazoFotos({
      nombre: propiedad.propietario.nombre,
      titulo: propiedad.titulo,
      motivo
    });

    await enviarMensajeInternoParaPropiedad({ req, propiedadId: req.params.id, mensaje: msg });

    res.json({ ok: true, mensaje: 'Propiedad rechazada', propiedad: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const eliminarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    await Property.findByIdAndDelete(req.params.id);
    res.json({ ok: true, mensaje: 'Propiedad eliminada permanentemente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const bloquearPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    const nuevoStatus = propiedad.status === 'bloqueada' ? 'revision' : 'bloqueada';
    await Property.findByIdAndUpdate(req.params.id, { status: nuevoStatus });
    res.json({ ok: true, mensaje: `Propiedad ${nuevoStatus}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const dashboard = async (req, res) => {
  try {
    const totalUsuarios = await User.countDocuments();
    const totalPropiedades = await Property.countDocuments();
    const enRevision = await Property.countDocuments({ status: 'revision' });
    const aprobadas = await Property.countDocuments({ status: 'aprobada' });
    const rechazadas = await Property.countDocuments({ status: 'rechazada' });
    const bloqueadas = await Property.countDocuments({ status: 'bloqueada' });
    const pausadas = await Property.countDocuments({ status: 'pausada' });
    const usuariosBasico = await User.countDocuments({ plan: 'basico' });
    const usuariosPremium = await User.countDocuments({ plan: 'premium' });
    res.json({ ok: true, stats: { totalUsuarios, totalPropiedades, enRevision, aprobadas, rechazadas, bloqueadas, pausadas, usuariosBasico, usuariosPremium } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getUsuarios, cambiarPlan, suspenderUsuario, eliminarUsuario, getPropiedadesRevision, aprobarPropiedad, rechazarPropiedad, eliminarPropiedad, bloquearPropiedad, dashboard };