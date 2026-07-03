const User = require('../models/User');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
const { subirACloudinary } = require('../config/cloudinary');
const { generarCodigo, enviarCodigoVerificacion, enviarBienvenida } = require('../utils/email');

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
    const { nombre, email, password, telefono, plan, metodoVerificacion } = req.body;
    const existe = await User.findOne({ email });
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' });

    const codigo = generarCodigo();
    const expira = new Date(Date.now() + 15 * 60 * 1000);

    const user = await User.create({
      nombre, email, password, telefono,
      plan: plan || 'gratuito',
      metodoVerificacion: metodoVerificacion || 'email',
      codigoVerificacion: codigo,
      codigoExpira: expira,
      verificado: false
    });

    await enviarCodigoVerificacion(email, nombre, codigo);

    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ ok: true, accessToken, user, requiereVerificacion: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const verificarCodigo = async (req, res) => {
  try {
    const { email, codigo } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.verificado) return res.status(400).json({ error: 'La cuenta ya está verificada' });
    if (!user.codigoVerificacion || user.codigoVerificacion !== codigo) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }
    if (new Date() > user.codigoExpira) {
      return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
    }
    user.verificado = true;
    user.codigoVerificacion = null;
    user.codigoExpira = null;
    await user.save();
    await enviarBienvenida(email, user.nombre, user.plan);
    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true, mensaje: '¡Cuenta verificada exitosamente!', accessToken, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reenviarCodigo = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.verificado) return res.status(400).json({ error: 'La cuenta ya está verificada' });
    const codigo = generarCodigo();
    const expira = new Date(Date.now() + 15 * 60 * 1000);
    user.codigoVerificacion = codigo;
    user.codigoExpira = expira;
    await user.save();
    await enviarCodigoVerificacion(email, user.nombre, codigo);
    res.json({ ok: true, mensaje: 'Código reenviado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, telefono, password } = req.body;
    const emailLimpio = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const telefonoLimpio = typeof telefono === 'string' ? telefono.replace(/\D/g, '').trim() : '';
    if (!password || (!emailLimpio && !telefonoLimpio)) {
      return res.status(400).json({ error: 'Debes enviar correo o teléfono y contraseña' });
    }
    const criterio = emailLimpio ? { email: emailLimpio } : { telefono: telefonoLimpio };
    const user = await User.findOne(criterio).select('+password');
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const passwordOk = await user.compararPassword(password);
    if (!passwordOk) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (user.status === 'suspendido') return res.status(403).json({ error: 'Cuenta suspendida' });
    if (user.status === 'bloqueado') return res.status(403).json({ error: 'Cuenta bloqueada. Contacta soporte.' });
    if (!user.verificado) return res.status(403).json({ error: 'Debes verificar tu cuenta antes de continuar', requiereVerificacion: true, email });
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

const misLeads = async (req, res) => {
  try {
    const leads = await Lead.find({ usuarioRegistrado: req.user.id }).sort({ createdAt: -1 });
    const mensajesNoLeidos = await Message.countDocuments({
      destinatario: req.user.id,
      leido: false
    });
    res.json({ ok: true, total: leads.length, mensajesNoLeidos, leads });
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
const actualizarNotificaciones = async (req, res) => {
  try {
    const { notificaciones } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { notificaciones },
      { new: true }
    );
    res.json({ ok: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const subirKyc = async (req, res) => {
  try {
    const rfcRaw = req.body.rfc;
    const rfc = typeof rfcRaw === 'string' ? rfcRaw.trim().toUpperCase() : '';

    if (!rfc) {
      return res.status(400).json({ error: 'RFC es requerido' });
    }

    const ineFrente = req.files?.ineFrente?.[0];
    const ineReverso = req.files?.ineReverso?.[0];

    if (!ineFrente || !ineReverso) {
      return res.status(400).json({ error: 'Debes subir INE frente e INE reverso' });
    }

    const [ineFrenteUrl, ineReversoUrl] = await Promise.all([
      subirACloudinary(ineFrente.buffer, ineFrente.mimetype, 'vive-mas/kyc/ine'),
      subirACloudinary(ineReverso.buffer, ineReverso.mimetype, 'vive-mas/kyc/ine')
    ]);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        rfc,
        kyc: {
          ineFrenteUrl,
          ineReversoUrl,
          status: 'en_revision',
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({
      ok: true,
      mensaje: 'Documentos recibidos. Tu verificación está en revisión.',
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const actualizarPerfil = async (req, res) => {
  try {
    const { telefono } = req.body;
    const campos = {};
    if (telefono) campos.telefono = telefono.trim();
    if (!Object.keys(campos).length) return res.status(400).json({ error: 'Nada que actualizar' });
    const user = await User.findByIdAndUpdate(req.user.id, campos, { new: true }).select('-password');
    res.json({ ok: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
module.exports = { registro, login, logout, perfil, refreshToken, verificarCodigo, reenviarCodigo, actualizarNotificaciones, actualizarPerfil };