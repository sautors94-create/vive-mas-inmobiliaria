const User = require('../models/User');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { TOTP, Secret } = require('otpauth');
const Stripe = require('stripe');
const { subirACloudinary } = require('../config/cloudinary');
const { generarCodigo, enviarCodigoVerificacion, enviarBienvenida, enviarEnlaceRecuperacion, enviarAlerta2FADesactivado } = require('../utils/email');
const { enviarOTP, verificarOTP, twilioVerifyConfigurado } = require('../utils/twilioVerify');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Envía el código de verificación por el canal elegido por el usuario.
// SMS usa Twilio Verify: el código lo genera y valida Twilio, no nosotros
// (por eso aquí se limpia codigoVerificacion/codigoExpira en ese caso).
// Si eligió SMS pero Twilio todavía no está configurado (o falla el envío),
// hace fallback a email para no dejar a nadie sin poder verificar su cuenta.
// Guarda en canalVerificacionUsado el canal REAL usado, para que
// verificarCodigo() sepa contra qué validar.
const enviarCodigoPorCanal = async (user, codigo) => {
  if (user.metodoVerificacion === 'sms' && user.telefono) {
    const resultado = await enviarOTP(user.telefono);
    if (resultado.ok) {
      user.canalVerificacionUsado = 'sms';
      user.codigoVerificacion = null;
      user.codigoExpira = null;
      await user.save();
      return { ok: true, canal: 'sms' };
    }
    // Fallback a email
    user.canalVerificacionUsado = 'email';
    await user.save();
    await enviarCodigoVerificacion(user.email, user.nombre, codigo);
    return { ok: true, canal: 'email', fallback: true };
  }
  user.canalVerificacionUsado = 'email';
  await user.save();
  await enviarCodigoVerificacion(user.email, user.nombre, codigo);
  return { ok: true, canal: 'email' };
};

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

// ✅ 2FA: Token temporal (5 min) para el paso intermedio entre login y verificación
const generarTempToken = (userId) => {
  return jwt.sign(
    { userId, type: '2fa_temp' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
};

// ✅ 2FA: Verificar token temporal (no requiere auth completo)
const verificarTempToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== '2fa_temp') return null;
    return decoded;
  } catch (e) {
    return null;
  }
};

// Requiere mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const validarPasswordSegura = (password) => PASSWORD_REGEX.test(password || '');

const registro = async (req, res) => {
  try {
    const { nombre, email, password, telefono, plan, metodoVerificacion } = req.body;
    const existe = await User.findOne({ email });
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' });

    if (!validarPasswordSegura(password)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas, números y un carácter especial.' });
    }

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

    const envio = await enviarCodigoPorCanal(user, codigo);

    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ ok: true, accessToken, user, requiereVerificacion: true, canalVerificacion: envio.canal });
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

    if (user.canalVerificacionUsado === 'sms' && user.telefono) {
      const resultado = await verificarOTP(user.telefono, codigo);
      if (!resultado.ok) {
        return res.status(400).json({ error: 'Código incorrecto o vencido' });
      }
    } else {
      if (!user.codigoVerificacion || user.codigoVerificacion !== codigo) {
        return res.status(400).json({ error: 'Código incorrecto' });
      }
      if (new Date() > user.codigoExpira) {
        return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
      }
    }

    user.verificado = true;
    user.codigoVerificacion = null;
    user.codigoExpira = null;
    user.canalVerificacionUsado = null;
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
    await enviarCodigoPorCanal(user, codigo);
    res.json({ ok: true, mensaje: 'Código reenviado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// ✅ RECUPERAR CONTRASEÑA (Olvidé mi password)
// ==========================================
const solicitarRecuperacion = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'El correo es requerido' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    // Por seguridad, siempre respondemos lo mismo para no revelar si el correo existe o no
    if (!user) {
      return res.json({ ok: true, mensaje: 'Si el correo está registrado, se envió un enlace.' });
    }

    // Generar token temporal de 30 minutos para cambiar la contraseña
    const resetToken = jwt.sign(
      { id: user._id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    // Enviamos el correo real
    await enviarEnlaceRecuperacion(user.email, user.nombre, resetToken);

    res.json({ ok: true, mensaje: 'Si el correo está registrado, se envió un enlace.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
};
// ==========================================
// ✅ NUEVA: EJECUTAR EL CAMBIO DE CONTRASEÑA
// ==========================================
const restablecerPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    if (!validarPasswordSegura(newPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas, números y un carácter especial.' });
    }

    // Verificar que el token sea válido y sea de tipo 'password_reset'
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: 'Token inválido' });
    }

    // Buscar usuario
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Cambiar la contraseña
    user.password = newPassword;
    await user.save(); // El pre('save') del modelo se encargará de hashearla

    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
    }
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
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
    
    // ✅ CORREGIDO: Solo se incluye +password. Los demás campos vienen por defecto.
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

    // ✅ 2FA: Si tiene autenticación en dos pasos activada, pedir código antes de dar acceso
    if (user.twoFactorEnabled) {
      const tempToken = generarTempToken(user._id);
      return res.json({
        requiere2FA: true,
        tempToken
      });
    }
    
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
    
    const ahora = new Date();
    const diferencia = ahora - user.ultimaActividad;
    const quinceMinutos = 15 * 60 * 1000;
    
    if (diferencia > quinceMinutos) {
      res.clearCookie('refreshToken');
      return res.status(401).json({ 
        error: 'Sesión expirada por inactividad',
        sesionExpirada: true 
      });
    }
    
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

// ==========================================
// ✅ 2FA: Verificar código al hacer login (NO requiere authMiddleware)
// ==========================================
const verificar2FA = async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const decoded = verificarTempToken(tempToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Sesión inválida o expirada. Intenta de nuevo.' });
    }

    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'La autenticación en dos pasos no está activada en tu cuenta' });
    }

    const totp = new TOTP({
      issuer: 'ViveMas',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(user.twoFactorSecret)
    });

    const delta = totp.validate({ token: String(code).trim(), window: 1 });
    if (delta === null) {
      return res.status(400).json({ error: 'Código inválido. Asegúrate de que la app esté sincronizada.' });
    }

    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true, accessToken, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// ✅ 2FA: Usar código de recuperación (NO requiere authMiddleware)
// ==========================================
const recuperar2FA = async (req, res) => {
  try {
    const { tempToken, recoveryCode } = req.body;

    if (!tempToken || !recoveryCode) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const decoded = verificarTempToken(tempToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Sesión inválida o expirada. Intenta de nuevo.' });
    }

    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: 'La autenticación en dos pasos no está activa en tu cuenta.' });
    }

    const codigoLimpio = recoveryCode.trim().toUpperCase();
    let codigoEncontrado = false;

    for (const hashAlmacenado of user.twoFactorRecoveryCodes) {
      const coincide = await bcrypt.compare(codigoLimpio, hashAlmacenado);
      if (coincide) {
        codigoEncontrado = true;
        break;
      }
    }

    if (!codigoEncontrado) {
      return res.status(400).json({ error: 'Código de recuperación inválido o ya fue usado.' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorRecoveryCodes = [];
    await user.save();

    // ✅ Enviar alerta de seguridad por correo
    await enviarAlerta2FADesactivado(user.email, user.nombre);

    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    console.log(`🔐 Acceso por código de recuperación: ${user.email}`);

    res.json({ ok: true, accessToken, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// AUTENTICACIÓN EN DOS PASOS (2FA - TOTP)
// ==========================================

const generarCodigosRecuperacion = (cantidad = 8) => {
  const codigos = [];
  for (let i = 0; i < cantidad; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
    codigos.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codigos;
};

const iniciarSetup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'Ya tienes la autenticación en dos pasos activada' });
    }

    const secret = new Secret({ size: 20 }).base32;
    res.json({ ok: true, secret, email: user.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const confirmar2FA = async (req, res) => {
  try {
    const { secret, code } = req.body;
    if (!secret || !code) return res.status(400).json({ error: 'Faltan datos' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'Ya tienes la autenticación en dos pasos activada' });
    }

    const totp = new TOTP({
      issuer: 'ViveMas',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret)
    });

    const delta = totp.validate({ token: String(code).trim(), window: 1 });
    if (delta === null) {
      return res.status(400).json({ error: 'Código inválido. Asegúrate de que la app esté sincronizada.' });
    }

    const codigosRecuperacion = generarCodigosRecuperacion();
    const codigosHasheados = await Promise.all(codigosRecuperacion.map(c => bcrypt.hash(c, 10)));

    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;
    user.twoFactorRecoveryCodes = codigosHasheados;
    await user.save();

    res.json({ ok: true, recoveryCodes: codigosRecuperacion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const desactivar2FA = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Debes ingresar tu contraseña para desactivar la autenticación en dos pasos' });

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const passwordOk = await user.compararPassword(password);
    if (!passwordOk) return res.status(401).json({ error: 'Contraseña incorrecta' });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorRecoveryCodes = [];
    await user.save();

    res.json({ ok: true, mensaje: 'Autenticación en dos pasos desactivada.' });
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
    // El teléfono ya NO se cambia por aquí: requiere verificación OTP por SMS.
    // Ver solicitarCambioCelular / confirmarCambioCelular más abajo.
    const campos = {};
    if (!Object.keys(campos).length) return res.status(400).json({ error: 'Nada que actualizar' });
    const user = await User.findByIdAndUpdate(req.user.id, campos, { new: true }).select('-password');
    res.json({ ok: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// CAMBIO DE CELULAR (verificación OTP por SMS vía Twilio Verify)
// ==========================================
// Flujo en 2 pasos: 1) solicitarCambioCelular envía el código al número nuevo
// y lo deja guardado como "pendiente" (todavía no reemplaza el teléfono real);
// 2) confirmarCambioCelular valida el código contra Twilio y, si es correcto,
// recién ahí actualiza el teléfono real del usuario.

const solicitarCambioCelular = async (req, res) => {
  try {
    const { telefono } = req.body;
    const limpio = typeof telefono === 'string' ? telefono.replace(/\D/g, '').trim() : '';
    if (!limpio || limpio.length < 10) {
      return res.status(400).json({ error: 'Ingresa un número de celular válido (10 dígitos).' });
    }
    if (!twilioVerifyConfigurado()) {
      return res.status(503).json({ error: 'La verificación por SMS no está disponible en este momento. Intenta más tarde.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const enUso = await User.findOne({ telefono: limpio, _id: { $ne: user._id } });
    if (enUso) return res.status(400).json({ error: 'Ese número de celular ya está registrado en otra cuenta.' });

    const resultado = await enviarOTP(limpio);
    if (!resultado.ok) {
      return res.status(502).json({ error: 'No se pudo enviar el código por SMS. Verifica el número e intenta de nuevo.' });
    }

    user.telefonoPendiente = limpio;
    await user.save();

    res.json({ ok: true, mensaje: 'Te enviamos un código por SMS al nuevo número.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const confirmarCambioCelular = async (req, res) => {
  try {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Ingresa el código que te enviamos por SMS.' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!user.telefonoPendiente) {
      return res.status(400).json({ error: 'No hay un cambio de celular pendiente. Solicítalo de nuevo.' });
    }

    const resultado = await verificarOTP(user.telefonoPendiente, codigo);
    if (!resultado.ok) {
      return res.status(400).json({ error: 'Código incorrecto o vencido.' });
    }

    user.telefono = user.telefonoPendiente;
    user.telefonoPendiente = null;
    await user.save();

    res.json({ ok: true, mensaje: 'Tu número de celular fue actualizado correctamente.', user });
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

    if (user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
        console.log(`⏳ Stripe: cancel_at_period_end activado para ${user.email}`);
      } catch (stripeErr) {
        console.warn(`⚠️ No se pudo actualizar en Stripe: ${stripeErr.message}`);
      }
    }

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

    if (user.planFechaFin && new Date() > user.planFechaFin) {
      return res.status(400).json({ error: 'Tu plan ya venció. Contrata un nuevo plan desde tu panel.' });
    }

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

    user.cargoRecurrenteAutorizado = false;
    user.cargoRecurrenteRevocadoFecha = new Date();
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

const eliminarMiCuenta = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Debes ingresar tu contraseña para confirmar.' });

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const coincide = await bcrypt.compare(password, user.password);
    if (!coincide) return res.status(401).json({ error: 'Contraseña incorrecta.' });

    if (user.role === 'admin') return res.status(403).json({ error: 'Las cuentas de administrador no se pueden eliminar desde aquí.' });

    await Property.updateMany({ propietario: user._id }, { status: 'rechazada' });
    await User.findByIdAndDelete(user._id);

    console.log(`🗑️ Cuenta eliminada por el propio usuario: ${user.email}`);

    res.clearCookie('refreshToken');
    res.json({ ok: true, mensaje: 'Tu cuenta fue eliminada permanentemente.' });
  } catch (error) {
    console.error('❌ Error al eliminar cuenta:', error);
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
  solicitarRecuperacion, 
  restablecerPassword, 
  actualizarNotificaciones, 
  actualizarPerfil, 
  solicitarCambioCelular,
  confirmarCambioCelular,
  subirKyc,
  iniciarSetup2FA,
  confirmar2FA,
  desactivar2FA,
  cancelarSuscripcion,
  reactivarSuscripcion,
  autorizarCargoRecurrente,
  revocarCargoRecurrente,
  verificar2FA,
  recuperar2FA,
  eliminarMiCuenta
};