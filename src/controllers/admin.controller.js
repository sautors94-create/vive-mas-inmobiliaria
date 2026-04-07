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

const aprobarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findByIdAndUpdate(
      req.params.id,
      { status: 'aprobada', motivo_rechazo: null },
      { new: true }
    );
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json({ ok: true, mensaje: 'Propiedad aprobada', propiedad });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const rechazarPropiedad = async (req, res) => {
  try {
    const { motivo } = req.body;
    if (!motivo) return res.status(400).json({ error: 'Debes indicar el motivo de rechazo' });
    const propiedad = await Property.findByIdAndUpdate(
      req.params.id,
      { status: 'rechazada', motivo_rechazo: motivo },
      { new: true }
    );
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json({ ok: true, mensaje: 'Propiedad rechazada', propiedad });
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
    const usuariosBasico = await User.countDocuments({ plan: 'basico' });
    const usuariosPremium = await User.countDocuments({ plan: 'premium' });
    res.json({ ok: true, stats: { totalUsuarios, totalPropiedades, enRevision, aprobadas, rechazadas, bloqueadas, usuariosBasico, usuariosPremium } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getUsuarios, cambiarPlan, suspenderUsuario, eliminarUsuario, getPropiedadesRevision, aprobarPropiedad, rechazarPropiedad, eliminarPropiedad, bloquearPropiedad, dashboard };