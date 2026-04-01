const User = require('../models/User');

const getUsuarios = async (req, res) => {
  try {
    const { plan, role, status } = req.query;
    const filtro = {};
    if (plan) filtro.plan = plan;
    if (role) filtro.role = role;
    if (status) filtro.status = status;
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
    if (!planesValidos.includes(plan)) {
      return res.status(400).json({ error: 'Plan no válido' });
    }
    const usuario = await User.findByIdAndUpdate(
      req.params.id,
      { plan },
      { new: true }
    );
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

module.exports = { getUsuarios, cambiarPlan, suspenderUsuario };