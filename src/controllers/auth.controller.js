'use strict';

/**
 * src/controllers/auth.controller.js
 * ---------------------------------------------------------------------------
 * Correcciones aplicadas sobre la version original (mismas rutas, mismos
 * nombres exportados, mismas formas de respuesta; solo se retiran campos
 * sensibles del objeto `user` que el frontend nunca consumio):
 *
 * CRITICOS
 *  1. Stripe PEREZOSO: antes `new Stripe(process.env.STRIPE_SECRET_KEY)` a
 *     nivel de modulo tumbaba el proceso al hacer require sin .env (mismo
 *     problema que server.js/database.js). Ahora getStripe() inicializa al
 *     primer uso y los endpoints de suscripcion responden 503 controlado.
 *  2. Fuga del HASH de password: login hace select('+password') y respondia
 *     `user` completo. Todas las respuestas pasan por usuarioSeguro(), que
 *     elimina password, codigos, secretos 2FA, telefonoPendiente, etc.
 *  3. Auto-asignacion de plan: registro() aceptaba body.plan (cualquiera se
 *     registraba con plan:'premium' sin pagar). Todo registro nace 'gratuito';
 *     los planes de pago se asignan solo desde el flujo de pago (Stripe) o
 *     por un administrador.
 *  4. Fuerza bruta en login: bloqueo temporal por identificador e IP
 *     (5 fallos = 15 min) + comparacion bcrypt "fantasma" cuando el usuario
 *     no existe, para no filtrar por tiempos si el email esta registrado.
 *  5. Fuerza bruta en codigos: max 5 intentos para verificar cuenta / 2FA /
 *     correo corporativo, y cooldown de 60s para reenviar codigos.
 *
 * ALTOS
 *  6. El secret de 2FA ya no va y viene del cliente: iniciarSetup2FA lo guarda
 *     en el servidor (10 min) y confirmar2FA usa SIEMPRE el guardado, nunca
 *     el que manda el cliente en el body.
 *  7. Cookie del refresh token: sameSite 'lax' (CSRF) + secure en produccion
 *     (ajustable con COOKIE_SECURE=true|false en .env).
 *  8. Los 500 ya no devuelven error.message interno (se loguea en servidor y
 *     al cliente sale un mensaje generico).
 *  9. restablecerPassword y cambiarPassword sellan passwordChangedAt; el
 *     refreshToken emitido antes del cambio queda invalidado (campo opcional
 *     en el schema; si no existe, el check se omite sin romper nada).
 * 10. Cuentas suspendidas/bloqueadas tampoco pueden completar el paso de 2FA.
 * 11. eliminarMiCuenta cancela la suscripcion de Stripe ANTES de borrar al
 *     usuario (antes quedaba viva y seguia cobrando a una cuenta fantasma).
 * 12. Consistencia de cobros: si Stripe falla al cancelar/reactivar, la
 *     operacion NO se marca localmente (antes quedaba "cancelada" aqui y
 *     viva en Stripe, siguiendo cobrando).
 *
 * MEDIOS / BUGS
 *  13. actualizarPerfil estaba roto (campos vacios => siempre 400): ahora
 *      acepta una whitelist de campos seguros (nombre, bio, avatarUrl).
 *      El email no se toca aqui y el celular exige OTP (como ya estaba).
 *  14. PASSWORD_REGEX con tope de 72 caracteres (limite real de bcrypt;
 *      sin tope, bcrypt trunca silenciosamente).
 *  15. desactivar2FA ahora SI envia la alerta por correo (recuperar2FA ya lo
 *      hacia; era inconsistente).
 *  16. Validaciones KYC/KYB: formato de RFC, mimetype (JPG/PNG/WEBP/PDF/HEIC)
 *      y tamano maximo 10MB por documento.
 *  17. Emails normalizados a minusculas en registro/verificacion/reenvio
 *      (login ya normalizaba; registro no => usuarios "no encontrados").
 *  18. ultimaActividad se escribe con updateOne (no user.save() completo,
 *      que hacia escritura total + carrera con otros guards del modelo).
 *  19. Comparacion de codigos con crypto.timingSafeEqual.
 *
 * NOTAS DE OPERACION
 *  - Los limitadores anti-abuso viven en memoria (valido para una instancia).
 *    Si el backend corre multi-instancia (PM2 cluster/k8s), moverlos a Redis.
 *  - Campo opcional recomendado en el schema User: passwordChangedAt: Date.
 *    Sin el campo, el sellado se ignora y todo funciona igual que antes.
 *  - Variable opcional COOKIE_SECURE (true/false). Por defecto: secure en
 *    produccion. Si el despliegue aun no tiene HTTPS, poner COOKIE_SECURE=false
 *    (y migrar a HTTPS cuanto antes, es otro de los criticos del proyecto).
 */

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
const { generarCodigo, enviarCodigoVerificacion, enviarCodigoVerificacionCorreoCorporativo, enviarBienvenida, enviarEnlaceRecuperacion, enviarAlerta2FADesactivado } = require('../utils/email');
const { enviarOTP, verificarOTP, twilioVerifyConfigurado } = require('../utils/twilioVerify');

// ---------------------------------------------------------------------------
// Stripe PEREZOSO (fix critico 1): nunca instanciar en el require del modulo.
// Devuelve null si Stripe no esta configurado => endpoints responden 503.
// ---------------------------------------------------------------------------
let clienteStripe = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!clienteStripe) {
    try {
      clienteStripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    } catch (error) {
      console.error('[auth] No se pudo inicializar Stripe:', error.message);
      return null;
    }
  }
  return clienteStripe;
}

// ---------------------------------------------------------------------------
// Constantes de validacion
// ---------------------------------------------------------------------------
// Minimo 8, maximo 72 (bcrypt solo considera los primeros 72 bytes; sin tope,
// el truncamiento silencioso hacia creer que "72 caracteres iguales al final"
// no importaban). Requiere mayuscula, minuscula, numero y caracter especial.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// RFC mexicano: persona fisica (4 letras) o moral (3 letras) + fecha + homoclave
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const MIMES_DOCUMENTO_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const TAM_MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024; // 10MB

const validarPasswordSegura = (password) => PASSWORD_REGEX.test(password || '');
const esEmailValido = (email) => typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
const limpiarTelefono = (telefono) => (typeof telefono === 'string' ? telefono.replace(/\D/g, '').trim() : '');

const esDocumentoValido = (archivo) =>
  Boolean(
    archivo &&
    Buffer.isBuffer(archivo.buffer) &&
    archivo.buffer.length > 0 &&
    archivo.buffer.length <= TAM_MAX_DOCUMENTO_BYTES &&
    MIMES_DOCUMENTO_PERMITIDOS.includes(archivo.mimetype)
  );

// ---------------------------------------------------------------------------
// Cookie del refresh token (fix 7): sameSite + secure configurables.
// COOKIE_SECURE=true fuerza secure; false lo apaga; por defecto solo prod.
// ---------------------------------------------------------------------------
const secureCookie = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production';

const OPCIONES_COOKIE_REFRESH = {
  httpOnly: true,
  sameSite: 'lax',
  secure: secureCookie,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
};
const OPCIONES_COOKIE_CLEAR = { httpOnly: true, sameSite: 'lax', secure: secureCookie, path: '/' };

// ---------------------------------------------------------------------------
// Anti-abuso EN MEMORIA (fixes 4 y 5). Una sola instancia del servidor.
// Para multi-instancia: migrar a Redis con la misma logica.
// ---------------------------------------------------------------------------
const intentosCodigo = new Map();   // email -> { n, expira }  (verificacion de cuenta)
const intentos2FA = new Map();      // userId -> { n, expira } (TOTP y codigos de recuperacion)
const intentosKyb = new Map();      // userId -> { n, expira } (correo corporativo)
const ultimoReenvio = new Map();    // email -> timestamp      (cooldown reenvio de codigo)
const ultimoReset = new Map();      // email -> timestamp      (cooldown enlace de recuperacion)
const fallosLogin = new Map();      // clave -> { n, expira }  (brute force en login)
const secretos2FAPendientes = new Map(); // userId -> { secret, expira } (fix 6)

const MAX_INTENTOS_CODIGO = 5;
const MAX_INTENTOS_2FA = 5;
const MAX_FALLOS_LOGIN = 5;
const MAX_FALLOS_IP = 30;
const VENTANA_MS = 15 * 60 * 1000;
const COOLDOWN_REENVIO_MS = 60 * 1000;
const COOLDOWN_RESET_MS = 60 * 1000;
const TTL_SECRETO_2FA_MS = 10 * 60 * 1000;

function contarIntento(mapa, clave, ventanaMs) {
  const ahora = Date.now();
  const registro = mapa.get(clave);
  if (!registro || ahora > registro.expira) {
    mapa.set(clave, { n: 1, expira: ahora + ventanaMs });
    return 1;
  }
  registro.n += 1;
  return registro.n;
}

// Devuelve los segundos restantes de bloqueo, o 0 si puede continuar
function bloqueoSegundos(mapa, clave, max) {
  const registro = mapa.get(clave);
  if (!registro) return 0;
  const ahora = Date.now();
  if (ahora > registro.expira) {
    mapa.delete(clave);
    return 0;
  }
  return registro.n >= max ? Math.ceil((registro.expira - ahora) / 1000) : 0;
}

function limpiarIntentos(mapa, clave) {
  mapa.delete(clave);
}

const ipDeRequest = (req) => req.ip || (req.headers && req.headers['x-forwarded-for']) || 'desconocida';

function registrarFalloLogin(identificador, ip) {
  if (identificador) contarIntento(fallosLogin, `id:${identificador}`, VENTANA_MS);
  if (ip) contarIntento(fallosLogin, `ip:${ip}`, VENTANA_MS);
}

function loginBloqueadoSegundos(identificador, ip) {
  return Math.max(
    bloqueoSegundos(fallosLogin, `id:${identificador}`, MAX_FALLOS_LOGIN),
    bloqueoSegundos(fallosLogin, `ip:${ip}`, MAX_FALLOS_IP)
  );
}

function loginExitoso(identificador) {
  if (identificador) fallosLogin.delete(`id:${identificador}`);
}

// Barrido periodico para que los Map no crezcan indefinidamente
const limpiador = setInterval(() => {
  const ahora = Date.now();
  const vencido = (r) => !r || ahora > r.expira;
  for (const [k, v] of intentosCodigo) if (vencido(v)) intentosCodigo.delete(k);
  for (const [k, v] of intentos2FA) if (vencido(v)) intentos2FA.delete(k);
  for (const [k, v] of intentosKyb) if (vencido(v)) intentosKyb.delete(k);
  for (const [k, v] of secretos2FAPendientes) if (vencido(v)) secretos2FAPendientes.delete(k);
  for (const [k, ts] of ultimoReenvio) if (ahora - ts > 60 * 60 * 1000) ultimoReenvio.delete(k);
  for (const [k, ts] of ultimoReset) if (ahora - ts > 60 * 60 * 1000) ultimoReset.delete(k);
  for (const [k, v] of fallosLogin) if (vencido(v)) fallosLogin.delete(k);
}, 10 * 60 * 1000);
if (typeof limpiador.unref === 'function') limpiador.unref();

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

// Comparacion en tiempo constante para codigos (fix 19)
const comparacionSegura = (a, b) => {
  const ba = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (ba.length === 0 || bb.length === 0) return ba.length === bb.length;
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba); // gasta un tiempo comparable antes de fallar
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
};

// Fix 2: ninguna respuesta debe exponer credenciales/codigos/secretos
const CAMPOS_SENSIBLES = [
  'password',
  'codigoVerificacion',
  'codigoExpira',
  'canalVerificacionUsado',
  'twoFactorSecret',
  'twoFactorRecoveryCodes',
  'telefonoPendiente'
];

function usuarioSeguro(user) {
  if (!user) return user;
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  for (const campo of CAMPOS_SENSIBLES) delete obj[campo];
  if (obj.kyb && typeof obj.kyb === 'object') {
    const { correoCorporativoCodigo, correoCorporativoCodigoExpira, ...kybResto } = obj.kyb;
    obj.kyb = kybResto;
  }
  return obj;
}

const generarTokens = (user) => {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('Configuracion de JWT ausente: define JWT_SECRET y JWT_REFRESH_SECRET en el .env');
  }
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

// 2FA: token temporal (5 min) para el paso intermedio entre login y verificacion
const generarTempToken = (userId) => {
  return jwt.sign(
    { userId, type: '2fa_temp' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
};

const verificarTempToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== '2fa_temp') return null;
    return decoded;
  } catch (e) {
    return null;
  }
};

// Motor de puntos: +1 por iniciar sesion (fire-and-forget, no bloquea login)
// NOTA: con base = 1 punto, el multiplicador x1.2 de planes de pago es un
// no-op tras Math.round (1.2 -> 1). Si se quiere diferenciar, revisar reglas.
const otorgarPuntosLogin = async (userId) => {
  try {
    const Founder = require('../nuevo-modulo/models/Founder');
    const founder = await Founder.findOne({ userId: userId });
    if (founder) {
      const today = new Date().toDateString();
      const lastLogin = founder.lastLoginPointDate ? new Date(founder.lastLoginPointDate).toDateString() : null;
      if (lastLogin !== today) {
        let pointsToAdd = 1;
        const user = await User.findById(userId).select('plan');
        if (user && (user.plan === 'basico' || user.plan === 'premium')) {
          pointsToAdd = Math.round(pointsToAdd * 1.2);
        }
        founder.score += pointsToAdd;
        founder.weekScore += pointsToAdd;
        founder.lastLoginPointDate = new Date();
        await founder.save();
      }
    }
  } catch (e) { console.error('Error al sumar punto de login:', e.message); }
};

// Envía el código de verificación por el canal elegido por el usuario.
// SMS usa Twilio Verify: el código lo genera y valida Twilio, no nosotros.
// Si eligió SMS pero Twilio no está configurado (o falla), hace fallback a
// email para no dejar a nadie sin poder verificar su cuenta.
// Devuelve { ok } para que el llamador sepa si el envio funcionó (fix: antes
// un fallo de correo respondia 500 con la cuenta ya creada).
const enviarCodigoPorCanal = async (user, codigo) => {
  if (user.metodoVerificacion === 'sms' && user.telefono) {
    try {
      const resultado = await enviarOTP(user.telefono);
      if (resultado.ok) {
        user.canalVerificacionUsado = 'sms';
        user.codigoVerificacion = null;
        user.codigoExpira = null;
        await user.save();
        return { ok: true, canal: 'sms' };
      }
    } catch (e) {
      console.error('[auth] Error al enviar OTP por SMS:', e.message);
    }
    // Fallback a email
    user.canalVerificacionUsado = 'email';
    await user.save();
    try {
      await enviarCodigoVerificacion(user.email, user.nombre, codigo);
      return { ok: true, canal: 'email', fallback: true };
    } catch (e) {
      console.error('[auth] Error al enviar codigo de verificacion por email (fallback):', e.message);
      return { ok: false, canal: 'email' };
    }
  }
  user.canalVerificacionUsado = 'email';
  await user.save();
  try {
    await enviarCodigoVerificacion(user.email, user.nombre, codigo);
    return { ok: true, canal: 'email' };
  } catch (e) {
    console.error('[auth] Error al enviar codigo de verificacion por email:', e.message);
    return { ok: false, canal: 'email' };
  }
};

// ===========================================================================
// REGISTRO
// ===========================================================================
const registro = async (req, res) => {
  try {
    const { nombre, email, password, telefono, metodoVerificacion } = req.body;

    // Normalizacion (fix 17): registro no normalizaba el email mientras login
    // si lo hace => usuarios con email "NoEncontrado" por mayusculas/espacios.
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    const emailLimpio = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const telefonoLimpio = limpiarTelefono(telefono);
    const metodo = metodoVerificacion === 'sms' ? 'sms' : 'email';

    if (nombreLimpio.length < 2 || nombreLimpio.length > 80) {
      return res.status(400).json({ error: 'El nombre debe tener entre 2 y 80 caracteres' });
    }
    if (!esEmailValido(emailLimpio)) {
      return res.status(400).json({ error: 'Ingresa un correo electrónico válido' });
    }
    if (!validarPasswordSegura(password)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas, números y un carácter especial.' });
    }
    if (telefonoLimpio && (telefonoLimpio.length < 10 || telefonoLimpio.length > 15)) {
      return res.status(400).json({ error: 'Ingresa un número de celular válido (10 dígitos).' });
    }
    if (metodo === 'sms' && !telefonoLimpio) {
      return res.status(400).json({ error: 'Para verificar por SMS necesitas registrar un número de celular' });
    }

    const existe = await User.findOne({ email: emailLimpio });
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' });

    if (telefonoLimpio) {
      const telefonoEnUso = await User.findOne({ telefono: telefonoLimpio });
      if (telefonoEnUso) return res.status(400).json({ error: 'Ese número de celular ya está registrado en otra cuenta.' });
    }

    const codigo = generarCodigo();
    const expira = new Date(Date.now() + 15 * 60 * 1000);

    const user = await User.create({
      nombre: nombreLimpio,
      email: emailLimpio,
      password,
      telefono: telefonoLimpio || undefined,
      // FIX CRITICO 3: el plan NUNCA se toma del body (cualquiera podia
      // registrarse con plan:'premium' sin pagar). Los planes de pago se
      // asignan exclusivamente desde el flujo de Stripe o por un admin.
      plan: 'gratuito',
      metodoVerificacion: metodo,
      codigoVerificacion: codigo,
      codigoExpira: expira,
      verificado: false
    });

    const envio = await enviarCodigoPorCanal(user, codigo);

    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, OPCIONES_COOKIE_REFRESH);
    res.status(201).json({
      ok: true,
      accessToken,
      user: usuarioSeguro(user),
      requiereVerificacion: true,
      canalVerificacion: envio.canal,
      ...(envio.ok ? {} : { aviso: 'No pudimos enviarte el código en este momento. Usa "Reenviar código" en la pantalla de verificación.' })
    });
  } catch (error) {
    console.error('[auth] Error en registro:', error.message);
    res.status(500).json({ error: 'No se pudo completar el registro. Intenta de nuevo.' });
  }
};

const verificarCodigo = async (req, res) => {
  try {
    const emailLimpio = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const codigo = String(req.body.codigo ?? '').trim();
    const user = await User.findOne({ email: emailLimpio });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.verificado) return res.status(400).json({ error: 'La cuenta ya está verificada' });

    // Anti fuerza bruta (fix 5): 6 digitos y 15 minutos de ventana sin tope
    // = 1,000,000 combinaciones asequibles. Tope: 5 intentos por ventana.
    const agotado = bloqueoSegundos(intentosCodigo, emailLimpio, MAX_INTENTOS_CODIGO);
    if (agotado > 0) {
      return res.status(429).json({ error: `Demasiados intentos fallidos. Solicita un código nuevo e intenta de nuevo en ${agotado}s.` });
    }

    if (user.canalVerificacionUsado === 'sms' && user.telefono) {
      const resultado = await verificarOTP(user.telefono, codigo);
      if (!resultado.ok) {
        contarIntento(intentosCodigo, emailLimpio, VENTANA_MS);
        return res.status(400).json({ error: 'Código incorrecto o vencido' });
      }
    } else {
      if (!user.codigoVerificacion || !comparacionSegura(user.codigoVerificacion, codigo)) {
        contarIntento(intentosCodigo, emailLimpio, VENTANA_MS);
        return res.status(400).json({ error: 'Código incorrecto' });
      }
      if (!user.codigoExpira || new Date() > user.codigoExpira) {
        return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
      }
    }

    user.verificado = true;
    user.codigoVerificacion = null;
    user.codigoExpira = null;
    user.canalVerificacionUsado = null;
    await user.save();
    limpiarIntentos(intentosCodigo, emailLimpio);

    await enviarBienvenida(user.email, user.nombre, user.plan);
    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, OPCIONES_COOKIE_REFRESH);
    res.json({ ok: true, mensaje: '¡Cuenta verificada exitosamente!', accessToken, user: usuarioSeguro(user) });
  } catch (error) {
    console.error('[auth] Error en verificarCodigo:', error.message);
    res.status(500).json({ error: 'Error al verificar el código. Intenta de nuevo.' });
  }
};

const reenviarCodigo = async (req, res) => {
  try {
    const emailLimpio = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const user = await User.findOne({ email: emailLimpio });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.verificado) return res.status(400).json({ error: 'La cuenta ya está verificada' });

    // Cooldown (fix 5): antes se podia bombardear email/SMS sin limite
    // (costo economico en Twilio + vector de acoso al correo del usuario).
    const ultimo = ultimoReenvio.get(emailLimpio) || 0;
    const transcurrido = Date.now() - ultimo;
    if (transcurrido < COOLDOWN_REENVIO_MS) {
      const falta = Math.ceil((COOLDOWN_REENVIO_MS - transcurrido) / 1000);
      return res.status(429).json({ error: `Ya enviamos un código hace instantes. Espera ${falta}s para solicitar otro.` });
    }

    const codigo = generarCodigo();
    const expira = new Date(Date.now() + 15 * 60 * 1000);
    user.codigoVerificacion = codigo;
    user.codigoExpira = expira;
    await user.save();
    limpiarIntentos(intentosCodigo, emailLimpio); // codigo nuevo, intentos en cero

    const envio = await enviarCodigoPorCanal(user, codigo);
    if (!envio.ok) {
      return res.status(502).json({ error: 'No se pudo enviar el código en este momento. Espera un minuto y vuelve a intentarlo.' });
    }
    ultimoReenvio.set(emailLimpio, Date.now());
    res.json({ ok: true, mensaje: 'Código reenviado exitosamente', canalVerificacion: envio.canal });
  } catch (error) {
    console.error('[auth] Error en reenviarCodigo:', error.message);
    res.status(500).json({ error: 'No se pudo reenviar el código. Intenta de nuevo.' });
  }
};

// ===========================================================================
// RECUPERAR CONTRASEÑA (Olvidé mi password)
// ===========================================================================
const solicitarRecuperacion = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'El correo es requerido' });

    const emailLimpio = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: emailLimpio });

    // Por seguridad, siempre respondemos lo mismo para no revelar si el
    // correo existe o no (enumeracion de usuarios). El cooldown aplica solo
    // al envio real, tambien de forma silenciosa.
    if (!user) {
      return res.json({ ok: true, mensaje: 'Si el correo está registrado, se envió un enlace.' });
    }

    const ultimo = ultimoReset.get(emailLimpio) || 0;
    if (Date.now() - ultimo < COOLDOWN_RESET_MS) {
      return res.json({ ok: true, mensaje: 'Si el correo está registrado, se envió un enlace.' });
    }

    // Token temporal de 30 minutos para cambiar la contraseña
    const resetToken = jwt.sign(
      { id: user._id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    await enviarEnlaceRecuperacion(user.email, user.nombre, resetToken);
    ultimoReset.set(emailLimpio, Date.now());

    res.json({ ok: true, mensaje: 'Si el correo está registrado, se envió un enlace.' });
  } catch (error) {
    console.error('[auth] Error en solicitarRecuperacion:', error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
};

const restablecerPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    if (!validarPasswordSegura(newPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas, números y un carácter especial.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
      }
      return res.status(400).json({ error: 'Enlace inválido. Solicita uno nuevo.' });
    }

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.password = newPassword;
    // Fix 9: sello de cambio de contraseña. Si agregas `passwordChangedAt: Date`
    // al schema User, el refreshToken emitido antes del cambio queda invalidado.
    // Sin el campo, Mongoose lo descarta y el sistema sigue funcionando igual.
    user.passwordChangedAt = new Date();
    await user.save(); // El pre('save') del modelo se encarga de hashearla

    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('[auth] Error en restablecerPassword:', error.message);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
};

// ===========================================================================
// LOGIN
// ===========================================================================
const login = async (req, res) => {
  try {
    const { email, telefono, password } = req.body;
    const emailLimpio = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const telefonoLimpio = limpiarTelefono(telefono);
    if (!password || (!emailLimpio && !telefonoLimpio)) {
      return res.status(400).json({ error: 'Debes enviar correo o teléfono y contraseña' });
    }

    const identificador = emailLimpio || telefonoLimpio;
    const ip = ipDeRequest(req);

    // Anti fuerza bruta (fix 4): 5 fallos por identificador (o 30 por IP) en
    // 15 min => bloqueo temporal. Protege la cuenta aunque roten de IP.
    const bloqueo = loginBloqueadoSegundos(identificador, ip);
    if (bloqueo > 0) {
      return res.status(429).json({ error: `Demasiados intentos fallidos. Tu acceso quedó bloqueado temporalmente; intenta de nuevo en ${Math.ceil(bloqueo / 60)} minuto(s).` });
    }

    const criterio = emailLimpio ? { email: emailLimpio } : { telefono: telefonoLimpio };
    const user = await User.findOne(criterio).select('+password');

    if (!user) {
      // Comparacion bcrypt "fantasma": gasta el mismo tiempo que una real para
      // no revelar por tiempos de respuesta si el email/telefono existe.
      await bcrypt.compare(String(password), bcrypt.hashSync('equalizador-de-tiempo', 10));
      registrarFalloLogin(identificador, ip);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const passwordOk = await user.compararPassword(password);
    if (!passwordOk) {
      registrarFalloLogin(identificador, ip);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    if (user.status === 'suspendido') return res.status(403).json({ error: 'Cuenta suspendida' });
    if (user.status === 'bloqueado') return res.status(403).json({ error: 'Cuenta bloqueado. Contacta soporte.' });
    if (!user.verificado) return res.status(403).json({ error: 'Debes verificar tu cuenta antes de continuar', requiereVerificacion: true, email: emailLimpio });

    loginExitoso(identificador);

    // updateOne en vez de user.save(): escritura puntual, sin reescribir el
    // documento completo ni chocar con otros guards del modelo (fix 18).
    await User.updateOne({ _id: user._id }, { $set: { ultimaActividad: new Date() } });

    // MOTOR DE PUNTOS: +1 por iniciar sesión (sin await para no bloquear)
    otorgarPuntosLogin(user._id).catch(e => console.error('Error puntos login:', e.message));

    if (user.twoFactorEnabled) {
      const tempToken = generarTempToken(user._id);
      return res.json({
        requiere2FA: true,
        tempToken
      });
    }

    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, OPCIONES_COOKIE_REFRESH);
    res.json({ ok: true, accessToken, user: usuarioSeguro(user) });
  } catch (error) {
    console.error('[auth] Error en login:', error.message);
    res.status(500).json({ error: 'Error al iniciar sesión. Intenta de nuevo.' });
  }
};

const logout = async (req, res) => {
  res.clearCookie('refreshToken', OPCIONES_COOKIE_CLEAR);
  res.json({ ok: true, message: 'Sesión cerrada' });
};

const perfil = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ ok: true, user: usuarioSeguro(user) });
  } catch (error) {
    console.error('[auth] Error en perfil:', error.message);
    res.status(500).json({ error: 'Error al obtener el perfil.' });
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
    console.error('[auth] Error en misLeads:', error.message);
    res.status(500).json({ error: 'Error al obtener tus leads.' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: 'Refresh token requerido' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    if (user.status === 'suspendido') return res.status(403).json({ error: 'Cuenta suspendida' });

    // Fix 9: si la contraseña cambió DESPUÉS de emitirse este refresh token,
    // la sesión queda invalidada (protege ante robo de sesión + cambio de clave).
    if (user.passwordChangedAt && decoded.iat) {
      const cambioMs = new Date(user.passwordChangedAt).getTime();
      if (decoded.iat * 1000 < cambioMs - 1000) {
        res.clearCookie('refreshToken', OPCIONES_COOKIE_CLEAR);
        return res.status(401).json({ error: 'Sesión invalidada. Inicia sesión de nuevo.', sesionExpirada: true });
      }
    }

    const ahora = new Date();
    const diferencia = ahora - user.ultimaActividad;
    const quinceMinutos = 15 * 60 * 1000;

    if (diferencia > quinceMinutos) {
      res.clearCookie('refreshToken', OPCIONES_COOKIE_CLEAR);
      return res.status(401).json({
        error: 'Sesión expirada por inactividad',
        sesionExpirada: true
      });
    }

    await User.updateOne({ _id: user._id }, { $set: { ultimaActividad: ahora } });

    const { accessToken, refreshToken: newRefreshToken } = generarTokens(user);
    res.cookie('refreshToken', newRefreshToken, OPCIONES_COOKIE_REFRESH);
    res.json({ ok: true, accessToken });
  } catch (error) {
    console.error('[auth] Error en refreshToken:', error.message);
    res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
};

const actualizarNotificaciones = async (req, res) => {
  try {
    const { notificaciones } = req.body;
    if (!notificaciones || typeof notificaciones !== 'object' || Array.isArray(notificaciones)) {
      return res.status(400).json({ error: 'Formato de notificaciones inválido' });
    }
    // Copia superficial saneada: solo propiedades propias con valores planos
    // (el schema con strict filtrara las claves desconocidas).
    const limpio = {};
    for (const clave of Object.keys(notificaciones).slice(0, 20)) {
      const valor = notificaciones[clave];
      if (valor === null || typeof valor !== 'object') limpio[clave] = valor;
    }
    if (!Object.keys(limpio).length) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { notificaciones: limpio },
      { new: true }
    );
    res.json({ ok: true, user: usuarioSeguro(user) });
  } catch (error) {
    console.error('[auth] Error en actualizarNotificaciones:', error.message);
    res.status(500).json({ error: 'Error al actualizar las notificaciones.' });
  }
};

// ===========================================================================
// 2FA: VERIFICACIÓN AL HACER LOGIN (NO requiere authMiddleware)
// ===========================================================================
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

    // Fix 10: el status se re-chequea aquí (el login pudo haber pasado y la
    // cuenta haber sido suspendida ANTES de completar el 2FA).
    if (user.status === 'suspendido') return res.status(403).json({ error: 'Cuenta suspendida' });
    if (user.status === 'bloqueado') return res.status(403).json({ error: 'Cuenta bloqueado. Contacta soporte.' });

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'La autenticación en dos pasos no está activada en tu cuenta' });
    }

    // Anti fuerza bruta (fix 5): 5 intentos por ventana de 15 min
    const agotado = bloqueoSegundos(intentos2FA, String(user._id), MAX_INTENTOS_2FA);
    if (agotado > 0) {
      return res.status(429).json({ error: `Demasiados intentos. Espera ${agotado}s e intenta de nuevo.` });
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
      contarIntento(intentos2FA, String(user._id), VENTANA_MS);
      return res.status(400).json({ error: 'Código inválido. Asegúrate de que la app esté sincronizada.' });
    }
    limpiarIntentos(intentos2FA, String(user._id));

    // MOTOR DE PUNTOS: +1 por iniciar sesión
    otorgarPuntosLogin(user._id).catch(e => console.error('Error puntos login:', e.message));

    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, OPCIONES_COOKIE_REFRESH);
    res.json({ ok: true, accessToken, user: usuarioSeguro(user) });
  } catch (error) {
    console.error('[auth] Error en verificar2FA:', error.message);
    res.status(500).json({ error: 'Error de autenticación en dos pasos. Intenta de nuevo.' });
  }
};

// ===========================================================================
// 2FA: USAR CÓDIGO DE RECUPERACIÓN (NO requiere authMiddleware)
// ===========================================================================
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

    if (user.status === 'suspendido') return res.status(403).json({ error: 'Cuenta suspendida' });
    if (user.status === 'bloqueado') return res.status(403).json({ error: 'Cuenta bloqueado. Contacta soporte.' });

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: 'La autenticación en dos pasos no está activa en tu cuenta.' });
    }

    const agotado = bloqueoSegundos(intentos2FA, String(user._id), MAX_INTENTOS_2FA);
    if (agotado > 0) {
      return res.status(429).json({ error: `Demasiados intentos. Espera ${agotado}s e intenta de nuevo.` });
    }

    const codigoLimpio = recoveryCode.trim().toUpperCase();
    let codigoEncontrado = false;

    for (const hashAlmacenado of user.twoFactorRecoveryCodes || []) {
      const coincide = await bcrypt.compare(codigoLimpio, hashAlmacenado);
      if (coincide) {
        codigoEncontrado = true;
        break;
      }
    }

    if (!codigoEncontrado) {
      contarIntento(intentos2FA, String(user._id), VENTANA_MS);
      return res.status(400).json({ error: 'Código de recuperación inválido o ya fue usado.' });
    }
    limpiarIntentos(intentos2FA, String(user._id));

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorRecoveryCodes = [];
    await user.save();

    await enviarAlerta2FADesactivado(user.email, user.nombre);

    // MOTOR DE PUNTOS: +1 por iniciar sesión
    otorgarPuntosLogin(user._id).catch(e => console.error('Error puntos login:', e.message));

    const { accessToken, refreshToken } = generarTokens(user);
    res.cookie('refreshToken', refreshToken, OPCIONES_COOKIE_REFRESH);

    console.log(`🔐 Acceso por código de recuperación: ${user.email}`);

    res.json({ ok: true, accessToken, user: usuarioSeguro(user) });
  } catch (error) {
    console.error('[auth] Error en recuperar2FA:', error.message);
    res.status(500).json({ error: 'Error de autenticación en dos pasos. Intenta de nuevo.' });
  }
};

// ===========================================================================
// AUTENTICACIÓN EN DOS PASOS (2FA - TOTP)
// ===========================================================================

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

    // Fix 6: el secret queda en el SERVIDOR con vigencia de 10 minutos.
    // Antes solo viajaba al cliente y confirmar2FA confiaba del secret que
    // volviera en el body (un atacante con la sesión podía amarrar su propio
    // secret o forzar uno conocido).
    secretos2FAPendientes.set(String(user._id), {
      secret,
      expira: Date.now() + TTL_SECRETO_2FA_MS
    });

    res.json({ ok: true, secret, email: user.email });
  } catch (error) {
    console.error('[auth] Error en iniciarSetup2FA:', error.message);
    res.status(500).json({ error: 'Error al iniciar la configuración 2FA.' });
  }
};

const confirmar2FA = async (req, res) => {
  try {
    const { code } = req.body;
    // NOTA: `secret` del body se IGNORA a propósito (fix 6). Se usa siempre el
    // guardado en servidor por iniciarSetup2FA.
    if (!code) return res.status(400).json({ error: 'Faltan datos' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'Ya tienes la autenticación en dos pasos activada' });
    }

    const pendiente = secretos2FAPendientes.get(String(user._id));
    if (!pendiente || Date.now() > pendiente.expira) {
      secretos2FAPendientes.delete(String(user._id));
      return res.status(400).json({ error: 'La configuración 2FA expiró. Vuelve a iniciarla.' });
    }

    const totp = new TOTP({
      issuer: 'ViveMas',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(pendiente.secret)
    });

    const delta = totp.validate({ token: String(code).trim(), window: 1 });
    if (delta === null) {
      return res.status(400).json({ error: 'Código inválido. Asegúrate de que la app esté sincronizada.' });
    }

    const codigosRecuperacion = generarCodigosRecuperacion();
    const codigosHasheados = await Promise.all(codigosRecuperacion.map(c => bcrypt.hash(c, 10)));

    user.twoFactorEnabled = true;
    user.twoFactorSecret = pendiente.secret;
    user.twoFactorRecoveryCodes = codigosHasheados;
    await user.save();
    secretos2FAPendientes.delete(String(user._id));

    res.json({ ok: true, recoveryCodes: codigosRecuperacion });
  } catch (error) {
    console.error('[auth] Error en confirmar2FA:', error.message);
    res.status(500).json({ error: 'Error al confirmar la configuración 2FA.' });
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

    // Fix 15: alerta consistente. recuperar2FA ya avisaba por correo; el
    // desactivado manual con contraseña tambien debe notificar.
    try {
      await enviarAlerta2FADesactivado(user.email, user.nombre);
    } catch (e) {
      console.error('[auth] No se pudo enviar la alerta de 2FA desactivado:', e.message);
    }

    res.json({ ok: true, mensaje: 'Autenticación en dos pasos desactivada.' });
  } catch (error) {
    console.error('[auth] Error en desactivar2FA:', error.message);
    res.status(500).json({ error: 'Error al desactivar la autenticación en dos pasos.' });
  }
};

// ===========================================================================
// KYC — Verificación de identidad (persona física)
// ===========================================================================
const subirKyc = async (req, res) => {
  try {
    const rfcRaw = req.body.rfc;
    const rfc = typeof rfcRaw === 'string' ? rfcRaw.trim().toUpperCase() : '';
    const tipoDocumento = req.body.tipoDocumento === 'pasaporte' ? 'pasaporte' : 'ine';

    if (!rfc) {
      return res.status(400).json({ error: 'RFC es requerido' });
    }
    if (!RFC_REGEX.test(rfc)) {
      return res.status(400).json({ error: 'El RFC no tiene un formato válido (ej. ABCD123456XY9).' });
    }

    const documentoFrente = req.files?.documentoFrente?.[0];
    const documentoReverso = req.files?.documentoReverso?.[0];

    if (!documentoFrente) {
      return res.status(400).json({ error: tipoDocumento === 'ine' ? 'Debes subir el INE (frente)' : 'Debes subir la página del pasaporte' });
    }
    if (tipoDocumento === 'ine' && !documentoReverso) {
      return res.status(400).json({ error: 'Debes subir el INE (reverso)' });
    }

    // Fix 16: validación de tipo y tamaño ANTES de gastar ancho de banda/Cloudinary
    if (!esDocumentoValido(documentoFrente) || (tipoDocumento === 'ine' && !esDocumentoValido(documentoReverso))) {
      return res.status(400).json({ error: 'Cada documento debe ser JPG, PNG, WEBP, HEIC o PDF y pesar máximo 10MB.' });
    }

    let documentoFrenteUrl;
    let documentoReversoUrl = null;
    try {
      const subidas = [subirACloudinary(documentoFrente.buffer, documentoFrente.mimetype, 'vive-mas/kyc/identificacion')];
      if (tipoDocumento === 'ine') {
        subidas.push(subirACloudinary(documentoReverso.buffer, documentoReverso.mimetype, 'vive-mas/kyc/identificacion'));
      }
      const [frente, reverso] = await Promise.all(subidas);
      documentoFrenteUrl = frente;
      documentoReversoUrl = tipoDocumento === 'ine' ? reverso : null;
    } catch (e) {
      console.error('[auth] Error de Cloudinary en subirKyc:', e.message);
      return res.status(502).json({ error: 'No se pudieron subir los documentos. Intenta de nuevo.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        rfc,
        kyc: {
          tipoDocumento,
          documentoFrenteUrl,
          documentoReversoUrl,
          status: 'en_revision',
          motivoRechazo: null,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({
      ok: true,
      mensaje: 'Documentos recibidos. Tu verificación está en revisión.',
      user: usuarioSeguro(user)
    });
  } catch (error) {
    console.error('[auth] Error en subirKyc:', error.message);
    res.status(500).json({ error: 'Error al procesar los documentos. Intenta de nuevo.' });
  }
};

// ===========================================================================
// KYB — Verificación de empresas (persona moral)
// ===========================================================================
// Flujo: 1) el usuario captura el correo corporativo y lo verifica con un
// código (solicitarVerificacionCorreoCorporativo / confirmarVerificacionCorreoCorporativo);
// 2) solo con el correo ya verificado puede enviar el resto de los documentos (subirKyb).

const solicitarVerificacionCorreoCorporativo = async (req, res) => {
  try {
    const { correoCorporativo, razonSocial } = req.body;
    const correo = typeof correoCorporativo === 'string' ? correoCorporativo.trim().toLowerCase() : '';
    if (!esEmailValido(correo)) {
      return res.status(400).json({ error: 'Ingresa un correo corporativo válido' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const codigo = generarCodigo();
    const expira = new Date(Date.now() + 15 * 60 * 1000);

    user.kyb = user.kyb || {};
    user.kyb.correoCorporativo = correo;
    user.kyb.correoCorporativoVerificado = false;
    user.kyb.correoCorporativoCodigo = codigo;
    user.kyb.correoCorporativoCodigoExpira = expira;
    if (razonSocial) user.kyb.razonSocial = razonSocial.trim();
    await user.save();

    limpiarIntentos(intentosKyb, String(user._id));

    await enviarCodigoVerificacionCorreoCorporativo(correo, user.kyb.razonSocial, codigo);

    res.json({ ok: true, mensaje: 'Te enviamos un código de verificación a ese correo.' });
  } catch (error) {
    console.error('[auth] Error en solicitarVerificacionCorreoCorporativo:', error.message);
    res.status(500).json({ error: 'Error al enviar el código de verificación. Intenta de nuevo.' });
  }
};

const confirmarVerificacionCorreoCorporativo = async (req, res) => {
  try {
    const codigo = String(req.body.codigo ?? '').trim();
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const agotado = bloqueoSegundos(intentosKyb, String(user._id), MAX_INTENTOS_CODIGO);
    if (agotado > 0) {
      return res.status(429).json({ error: `Demasiados intentos. Espera ${agotado}s e intenta de nuevo.` });
    }

    if (!user.kyb?.correoCorporativoCodigo || !codigo || !comparacionSegura(user.kyb.correoCorporativoCodigo, codigo)) {
      contarIntento(intentosKyb, String(user._id), VENTANA_MS);
      return res.status(400).json({ error: 'Código incorrecto' });
    }
    if (!user.kyb.correoCorporativoCodigoExpira || new Date() > user.kyb.correoCorporativoCodigoExpira) {
      return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
    }

    user.kyb.correoCorporativoVerificado = true;
    user.kyb.correoCorporativoCodigo = null;
    user.kyb.correoCorporativoCodigoExpira = null;
    await user.save();
    limpiarIntentos(intentosKyb, String(user._id));

    res.json({ ok: true, mensaje: 'Correo corporativo verificado.' });
  } catch (error) {
    console.error('[auth] Error en confirmarVerificacionCorreoCorporativo:', error.message);
    res.status(500).json({ error: 'Error al verificar el código. Intenta de nuevo.' });
  }
};

const subirKyb = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!user.kyb?.correoCorporativoVerificado) {
      return res.status(400).json({ error: 'Primero debes verificar el correo corporativo.' });
    }

    const { razonSocial, rfcEmpresa, representanteNombre } = req.body;
    const representanteTipoDocumento = req.body.representanteTipoDocumento === 'pasaporte' ? 'pasaporte' : 'ine';

    if (!razonSocial || !rfcEmpresa || !representanteNombre) {
      return res.status(400).json({ error: 'Faltan datos: razón social, RFC de la empresa y nombre del representante legal.' });
    }
    const rfcEmpresaLimpio = rfcEmpresa.trim().toUpperCase();
    if (!RFC_REGEX.test(rfcEmpresaLimpio)) {
      return res.status(400).json({ error: 'El RFC de la empresa no tiene un formato válido (ej. ABC123456XY9).' });
    }

    const constanciaSituacionFiscal = req.files?.constanciaSituacionFiscal?.[0];
    const actaConstitutiva = req.files?.actaConstitutiva?.[0];
    const comprobanteDomicilio = req.files?.comprobanteDomicilio?.[0];
    const representanteDocumentoFrente = req.files?.representanteDocumentoFrente?.[0];
    const representanteDocumentoReverso = req.files?.representanteDocumentoReverso?.[0];

    if (!constanciaSituacionFiscal || !actaConstitutiva || !comprobanteDomicilio || !representanteDocumentoFrente) {
      return res.status(400).json({ error: 'Debes adjuntar Constancia de Situación Fiscal, Acta Constitutiva, Comprobante de domicilio e identificación del representante legal.' });
    }
    if (representanteTipoDocumento === 'ine' && !representanteDocumentoReverso) {
      return res.status(400).json({ error: 'Debes subir el INE del representante legal (reverso).' });
    }
    if (
      !esDocumentoValido(constanciaSituacionFiscal) ||
      !esDocumentoValido(actaConstitutiva) ||
      !esDocumentoValido(comprobanteDomicilio) ||
      !esDocumentoValido(representanteDocumentoFrente) ||
      (representanteDocumentoReverso && !esDocumentoValido(representanteDocumentoReverso))
    ) {
      return res.status(400).json({ error: 'Cada documento debe ser JPG, PNG, WEBP, HEIC o PDF y pesar máximo 10MB.' });
    }

    let constanciaSituacionFiscalUrl, actaConstitutivaUrl, comprobanteDomicilioUrl, representanteDocumentoFrenteUrl, representanteDocumentoReversoUrl = null;
    try {
      [
        constanciaSituacionFiscalUrl,
        actaConstitutivaUrl,
        comprobanteDomicilioUrl,
        representanteDocumentoFrenteUrl,
        representanteDocumentoReversoUrl
      ] = await Promise.all([
        subirACloudinary(constanciaSituacionFiscal.buffer, constanciaSituacionFiscal.mimetype, 'vive-mas/kyb/documentos'),
        subirACloudinary(actaConstitutiva.buffer, actaConstitutiva.mimetype, 'vive-mas/kyb/documentos'),
        subirACloudinary(comprobanteDomicilio.buffer, comprobanteDomicilio.mimetype, 'vive-mas/kyb/documentos'),
        subirACloudinary(representanteDocumentoFrente.buffer, representanteDocumentoFrente.mimetype, 'vive-mas/kyb/identificacion'),
        representanteTipoDocumento === 'ine'
          ? subirACloudinary(representanteDocumentoReverso.buffer, representanteDocumentoReverso.mimetype, 'vive-mas/kyb/identificacion')
          : Promise.resolve(null)
      ]);
    } catch (e) {
      console.error('[auth] Error de Cloudinary en subirKyb:', e.message);
      return res.status(502).json({ error: 'No se pudieron subir los documentos. Intenta de nuevo.' });
    }

    user.tipoCuenta = 'empresa';
    user.kyb.razonSocial = razonSocial.trim();
    user.kyb.rfcEmpresa = rfcEmpresaLimpio;
    user.kyb.representanteNombre = representanteNombre.trim();
    user.kyb.representanteTipoDocumento = representanteTipoDocumento;
    user.kyb.constanciaSituacionFiscalUrl = constanciaSituacionFiscalUrl;
    user.kyb.actaConstitutivaUrl = actaConstitutivaUrl;
    user.kyb.comprobanteDomicilioUrl = comprobanteDomicilioUrl;
    user.kyb.representanteDocumentoFrenteUrl = representanteDocumentoFrenteUrl;
    user.kyb.representanteDocumentoReversoUrl = representanteDocumentoReversoUrl;
    user.kyb.status = 'en_revision';
    user.kyb.motivoRechazo = null;
    user.kyb.updatedAt = new Date();
    await user.save();

    res.json({ ok: true, mensaje: 'Documentos de tu empresa recibidos. Tu verificación KYB está en revisión.', user: usuarioSeguro(user) });
  } catch (error) {
    console.error('[auth] Error en subirKyb:', error.message);
    res.status(500).json({ error: 'Error al procesar los documentos. Intenta de nuevo.' });
  }
};

// ===========================================================================
// PERFIL
// ===========================================================================
const actualizarPerfil = async (req, res) => {
  try {
    // El teléfono ya NO se cambia por aquí: requiere verificación OTP por SMS
    // (solicitarCambioCelular / confirmarCambioCelular). El email tampoco se
    // edita por aquí. Whitelist de campos seguros (fix 13: antes la función
    // construía un objeto vacío y respondía SIEMPRE 400 "Nada que actualizar").
    const { nombre, bio, avatarUrl } = req.body;
    const campos = {};

    if (nombre !== undefined) {
      const nombreLimpio = String(nombre).trim();
      if (nombreLimpio.length < 2 || nombreLimpio.length > 80) {
        return res.status(400).json({ error: 'El nombre debe tener entre 2 y 80 caracteres' });
      }
      campos.nombre = nombreLimpio;
    }
    if (bio !== undefined) {
      const bioLimpia = String(bio).trim();
      if (bioLimpia.length > 500) {
        return res.status(400).json({ error: 'La bio no puede exceder 500 caracteres' });
      }
      campos.bio = bioLimpia;
    }
    if (avatarUrl !== undefined) {
      const url = String(avatarUrl).trim();
      if (url && !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: 'avatarUrl debe ser una URL http(s) válida' });
      }
      if (url.length > 500) {
        return res.status(400).json({ error: 'avatarUrl excede la longitud permitida' });
      }
      campos.avatarUrl = url;
    }
    // Para agregar más campos editables: incluirlos aquí con su validación.
    // NO agregar email, plan, role, status ni campos de pago a esta whitelist.

    if (!Object.keys(campos).length) {
      return res.status(400).json({ error: 'Nada que actualizar. Campos permitidos: nombre, bio, avatarUrl.' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, campos, { new: true }).select('-password');
    res.json({ ok: true, user: usuarioSeguro(user) });
  } catch (error) {
    console.error('[auth] Error en actualizarPerfil:', error.message);
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
};

// ===========================================================================
// CAMBIO DE CELULAR (verificación OTP por SMS vía Twilio Verify)
// ===========================================================================
// Flujo en 2 pasos: 1) solicitarCambioCelular envía el código al número nuevo
// y lo deja guardado como "pendiente" (todavía no reemplaza el teléfono real);
// 2) confirmarCambioCelular valida el código contra Twilio y, si es correcto,
// recién ahí actualiza el teléfono real del usuario.

const solicitarCambioCelular = async (req, res) => {
  try {
    const { telefono } = req.body;
    const limpio = limpiarTelefono(telefono);
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

    await User.updateOne({ _id: user._id }, { $set: { telefonoPendiente: limpio } });

    res.json({ ok: true, mensaje: 'Te enviamos un código por SMS al nuevo número.' });
  } catch (error) {
    console.error('[auth] Error en solicitarCambioCelular:', error.message);
    res.status(500).json({ error: 'Error al iniciar el cambio de celular. Intenta de nuevo.' });
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

    res.json({ ok: true, mensaje: 'Tu número de celular fue actualizado correctamente.', user: usuarioSeguro(user) });
  } catch (error) {
    console.error('[auth] Error en confirmarCambioCelular:', error.message);
    res.status(500).json({ error: 'Error al confirmar el cambio de celular. Intenta de nuevo.' });
  }
};

// ===========================================================================
// CANCELACIÓN DE SUSCRIPCIÓN (LeyMex)
// ===========================================================================
// Fix 12: si Stripe está configurado pero la llamada falla, la operación NO
// se marca localmente (antes quedaba "cancelada" aquí mientras Stripe seguía
// cobrando). Si Stripe no está configurado y no hay suscripción asociada,
// el cambio local procede (planes asignados manualmente por admin).

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
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'El servicio de pagos no está disponible en este momento. Intenta más tarde.' });
      }
      try {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
        console.log(`⏳ Stripe: cancel_at_period_end activado para ${user.email}`);
      } catch (stripeErr) {
        console.error(`[auth] No se pudo cancelar en Stripe (${user.email}): ${stripeErr.message}`);
        return res.status(502).json({ error: 'No se pudo comunicar con el procesador de pagos. Tu cancelación NO fue aplicada; intenta de nuevo.' });
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
    console.error('[auth] Error al cancelar suscripción:', error.message);
    res.status(500).json({ error: 'Error al cancelar la suscripción. Intenta más tarde.' });
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
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'El servicio de pagos no está disponible en este momento. Intenta más tarde.' });
      }
      try {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: false
        });
        console.log(`🔄 Stripe: cancel_at_period_end desactivado para ${user.email}`);
      } catch (stripeErr) {
        console.error(`[auth] No se pudo reactivar en Stripe (${user.email}): ${stripeErr.message}`);
        return res.status(502).json({ error: 'No se pudo comunicar con el procesador de pagos. Tu reactivación NO fue aplicada; intenta de nuevo.' });
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
    console.error('[auth] Error al reactivar suscripción:', error.message);
    res.status(500).json({ error: 'Error al reactivar la suscripción. Intenta más tarde.' });
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
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'El servicio de pagos no está disponible en este momento. Intenta más tarde.' });
      }
      try {
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        if (sub.cancel_at_period_end) {
          await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: false
          });
        }
      } catch (stripeErr) {
        console.error(`[auth] No se pudo verificar la suscripción en Stripe (${user.email}): ${stripeErr.message}`);
        return res.status(502).json({ error: 'No se pudo comunicar con el procesador de pagos. La autorización NO fue aplicada; intenta de nuevo.' });
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
    console.error('[auth] Error al autorizar cargo recurrente:', error.message);
    res.status(500).json({ error: 'Error al autorizar el cargo recurrente. Intenta más tarde.' });
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
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'El servicio de pagos no está disponible en este momento. Intenta más tarde.' });
      }
      try {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
        console.log(`⏳ Stripe: cancel_at_period_end activado por revocación de ${user.email}`);
      } catch (stripeErr) {
        console.error(`[auth] No se pudo revocar en Stripe (${user.email}): ${stripeErr.message}`);
        return res.status(502).json({ error: 'No se pudo comunicar con el procesador de pagos. La revocación NO fue aplicada; intenta de nuevo.' });
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
    console.error('[auth] Error al revocar cargo recurrente:', error.message);
    res.status(500).json({ error: 'Error al revocar el cargo recurrente. Intenta más tarde.' });
  }
};

const eliminarMiCuenta = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Debes ingresar tu contraseña para confirmar.' });

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const coincide = await user.compararPassword(password);
    if (!coincide) return res.status(401).json({ error: 'Contraseña incorrecta.' });

    if (user.role === 'admin') return res.status(403).json({ error: 'Las cuentas de administrador no se pueden eliminar desde aquí.' });

    // Fix 11: cancelar la suscripción en Stripe ANTES de borrar al usuario
    // (después del delete el stripeSubscriptionId se pierde y el cobro seguía).
    if (user.stripeSubscriptionId) {
      const stripe = getStripe();
      if (stripe) {
        try {
          await stripe.subscriptions.del(user.stripeSubscriptionId);
          console.log(`🛑 Stripe: suscripción cancelada por eliminación de cuenta de ${user.email}`);
        } catch (stripeErr) {
          // No bloquea la eliminación, pero queda registrado para revisión manual
          console.error(`[auth] IMPORTANTE: no se pudo cancelar la suscripción de ${user.email} en Stripe: ${stripeErr.message}`);
        }
      } else {
        console.error(`[auth] IMPORTANTE: Stripe no configurado; la suscripción de ${user.email} NO pudo cancelarse antes de eliminar la cuenta.`);
      }
    }

    await Property.updateMany({ propietario: user._id }, { status: 'rechazada' });
    await User.findByIdAndDelete(user._id);

    console.log(`🗑️ Cuenta eliminada por el propio usuario: ${user.email}`);

    res.clearCookie('refreshToken', OPCIONES_COOKIE_CLEAR);
    res.json({ ok: true, mensaje: 'Tu cuenta fue eliminada permanentemente.' });
  } catch (error) {
    console.error('[auth] Error al eliminar cuenta:', error.message);
    res.status(500).json({ error: 'Error al eliminar la cuenta. Contacta a soporte.' });
  }
};

// ===========================================================================
// CAMBIO DE CONTRASEÑA EN DASHBOARD
// ===========================================================================
const cambiarPassword = async (req, res) => {
  try {
    const { passwordActual, nuevaPassword } = req.body;

    if (!passwordActual || !nuevaPassword) {
      return res.status(400).json({ error: 'Debes ingresar tu contraseña actual y la nueva' });
    }

    if (!validarPasswordSegura(nuevaPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas, números y un carácter especial.' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Verificar que la contraseña actual sea correcta
    const esCorrecta = await user.compararPassword(passwordActual);
    if (!esCorrecta) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    // Validar que la nueva no sea igual a la actual
    const esIgual = await user.compararPassword(nuevaPassword);
    if (esIgual) {
      return res.status(400).json({ error: 'La nueva contraseña no puede ser igual a la actual' });
    }

    // Guardar la nueva (el modelo de Mongoose se encarga de encriptarla en el pre('save'))
    user.password = nuevaPassword;
    // Fix 9: sello de cambio; invalida refresh tokens emitidos antes del cambio
    // si agregas `passwordChangedAt: Date` al schema User.
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('[auth] Error en cambiarPassword:', error.message);
    res.status(500).json({ error: 'Error al cambiar la contraseña.' });
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
  solicitarVerificacionCorreoCorporativo,
  confirmarVerificacionCorreoCorporativo,
  subirKyb,
  iniciarSetup2FA,
  confirmar2FA,
  desactivar2FA,
  cancelarSuscripcion,
  reactivarSuscripcion,
  autorizarCargoRecurrente,
  revocarCargoRecurrente,
  verificar2FA,
  recuperar2FA,
  eliminarMiCuenta,
  cambiarPassword
};
