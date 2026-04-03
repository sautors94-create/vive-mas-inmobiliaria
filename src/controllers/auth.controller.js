const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generarTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

const registro = async (req, res) => {
  try {
    const { nombre, email, password, telefono } = req.body;
    const existe = await User.findOne({ email });
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' });
    const user = await User.create({ nombre, email, password, telefono });
    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ ok: true, accessToken, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const passwordOk = await user.compararPassword(password);
    if (!passwordOk) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (user.status === 'suspendido') return res.status(403).json({ error: 'Cuenta suspendida' });
    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true, accessToken, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const logout = async (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ ok: true, message: 'Sesión cerrada' });
};

const perfil = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ ok: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: 'Refresh token requerido' });
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    if (user.status === 'suspendido') return res.status(403).json({ error: 'Cuenta suspendida' });
    const { accessToken, refreshToken: newRefreshToken } = generarTokens(user);
    res.cookie('refreshToken', newRefreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true, accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
};

module.exports = { registro, login, logout, perfil, refreshToken };