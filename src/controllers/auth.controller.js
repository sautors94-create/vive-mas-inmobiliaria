const User = require('../models/User');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const { subirACloudinary } = require('../config/cloudinary');
const { generarCodigo, enviarCodigoVerificacion, enviarBienvenida } = require('../utils/email');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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
    if (user.status === 'bloqueado') return res.status(403).json({ error: 'Cuenta bloqueado. Contacta soporte.' });
    if (!user.verificado) return res.status(403).json({ error: 'Debes verificar tu cuenta antes de continuar', requiereVerificacion: true, email });
    
    // ✅ Establecer última actividad al hacer login
    user.ultimaActividad = new Date();
    await user.save();
    
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
    
    // ✅ Verificar inactividad (15 minutos)
    const ahora = new Date();
    const diferencia = ahora - user.ultimaActividad;
    const quinceMinutos = 15 * 60 * 1000;
    
    if (diferencia > quinceMinutos) {
      // ✅ Limpiar cookie y rechazar
      res.clearCookie('refreshToken');
      return res.status(401).json({ 
        error: 'Sesión expirada por inactividad',
        sesionExpirada: true 
      });
    }
    
    // ✅ Actualizar última actividad
    user.ultimaActividad = ahora;
    await user.save();
    
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
// ==========================================
// CANCELACIÓN DE SUSCRIPCIÓN (LeyMex)
// ==========================================

const cancelarSuscripcion = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const planUser = (user.plan || 'gratuito').toLowerCase();
    if (planUser === 'gratuito') {
      return res.status(400).json({ error: 'No tienes un plan activo para cancelar.' });
    }

    if (user.planCancelado) {
      return res.status(400).json({ error: 'Tu suscripción ya está cancelada. Se mantiene activa hasta la fecha de vencimiento.' });
    }

    // Si tiene suscripción en Stripe, marcar cancel_at_period_end
    if (user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
        console.log(`⏳ Stripe: cancel_at_period_end activado para ${user.email}`);
      } catch (stripeErr) {
        console.warn(`⚠️ No se pudo actualizar en Stripe: ${stripeErr.message}`);
        // Continuamos aunque falle Stripe — lo manejamos por BD
      }
    }

    // Actualizar en BD
    user.planCancelado = true;
    user.cargoRecurrenteAutorizado = false;
    user.fechaCancelacion = new Date();
    await user.save();

    console.log(`🚫 Suscripción cancelada por usuario: ${user.email}. Activa hasta: ${user.planFechaFin?.toLocaleDateString('es-MX')}`);

    res.json({
      ok: true,
      mensaje: 'Suscripción cancelada. Tu plan se mantiene activo hasta la fecha de vencimiento.',
      planFechaFin: user.planFechaFin
    });
  } catch (error) {
    console.error('❌ Error al cancelar suscripción:', error);
    res.status(500).json({ error: error.message });
  }
};

const reactivarSuscripcion = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!user.planCancelado) {
      return res.status(400).json({ error: 'Tu suscripción no está cancelada.' });
    }

    // Verificar que aún no haya vencido
    if (user.planFechaFin && new Date() > user.planFechaFin) {
      return res.status(400).json({ error: 'Tu plan ya venció. Contrata un nuevo plan desde tu panel.' });
    }

    // Si tiene suscripción en Stripe, quitar cancel_at_period_end
    if (user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: false
        });
        console.log(`🔄 Stripe: cancel_at_period_end desactivado para ${user.email}`);
      } catch (stripeErr) {
        console.warn(`⚠️ No se pudo reactivar en Stripe: ${stripeErr.message}`);
      }
    }

    // Actualizar en BD
    user.planCancelado = false;
    user.fechaCancelacion = null;
    if (user.planPeriodo === 'mensual') {
      user.cargoRecurrenteAutorizado = true;
    }
    await user.save();

    console.log(`🔄 Suscripción reactivada: ${user.email}`);

    res.json({
      ok: true,
      mensaje: 'Suscripción reactivada exitosamente.',
      planFechaFin: user.planFechaFin
    });
  } catch (error) {
    console.error('❌ Error al reactivar suscripción:', error);
    res.status(500).json({ error: error.message });
  }
};

const autorizarCargoRecurrente = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (user.plan !== 'basico') {
      return res.status(400).json({ error: 'El cargo recurrente solo aplica al plan mensual.' });
    }

    if (user.planPeriodo !== 'mensual') {
      return res.status(400).json({ error: 'El cargo recurrente solo aplica a pagos mensuales. Tu plan es anual.' });
    }

    if (user.cargoRecurrenteAutorizado) {
      return res.status(400).json({ error: 'Ya tienes autorizado el cargo recurrente.' });
    }

    if (user.planCancelado) {
      return res.status(400).json({ error: 'Tienes la suscripción cancelada. Reactiva tu plan primero.' });
    }

    // Si tiene suscripción en Stripe, asegurarnos de que no esté cancelada
    if (user.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        if (sub.cancel_at_period_end) {
          await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: false
          });
        }
      } catch (stripeErr) {
        console.warn(`⚠️ No se pudo verificar suscripción en Stripe: ${stripeErr.message}`);
      }
    }

    // Guardar evidencia legal del consentimiento
    user.cargoRecurrenteAutorizado = true;
    user.cargoRecurrenteFecha = new Date();
    user.cargoRecurrenteIP = req.ip || req.headers['x-forwarded-for'] || 'no_disponible';
    user.cargoRecurrenteUserAgent = req.headers['user-agent'] || 'no_disponible';
    user.cargoRecurrenteRevocadoFecha = null;
    await user.save();

    console.log(`✅ Cargo recurrente autorizado por ${user.email} — IP: ${user.cargoRecurrenteIP}`);

    res.json({
      ok: true,
      mensaje: 'Cargo recurrente autorizado exitosamente.',
      fechaAutorizacion: user.cargoRecurrenteFecha
    });
  } catch (error) {
    console.error('❌ Error al autorizar cargo recurrente:', error);
    res.status(500).json({ error: error.message });
  }
};

const revocarCargoRecurrente = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!user.cargoRecurrenteAutorizado) {
      return res.status(400).json({ error: 'No tienes cargo recurrente autorizado.' });
    }

    // Si tiene suscripción en Stripe, marcar cancel_at_period_end
    if (user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
        console.log(`⏳ Stripe: cancel_at_period_end activado por revocación de ${user.email}`);
      } catch (stripeErr) {
        console.warn(`⚠️ No se pudo actualizar en Stripe: ${stripeErr.message}`);
      }
    }

    // Guardar evidencia de revocación
    user.cargoRecurrenteAutorizado = false;
    user.cargoRecurrenteRevocadoFecha = new Date();
    // No borramos cargoRecurrenteFecha ni IP — es evidencia histórica legal
    await user.save();

    console.log(`🔓 Cargo recurrente revocado por ${user.email}`);

    res.json({
      ok: true,
      mensaje: 'Cargo recurrente revocado. Tu plan sigue activo hasta la fecha de vencimiento.',
      planFechaFin: user.planFechaFin
    });
  } catch (error) {
    console.error('❌ Error al revocar cargo recurrente:', error);
    res.status(500).json({ error: error.message });
  }
};
module.exports = { 
  registro, 
  login, 
  logout, 
  perfil, 
  misLeads, 
  refreshToken, 
  verificarCodigo, 
  reenviarCodigo, 
  actualizarNotificaciones, 
  actualizarPerfil, 
  subirKyc,
  cancelarSuscripcion,
  reactivarSuscripcion,
  autorizarCargoRecurrente,
  revocarCargoRecurrente
};