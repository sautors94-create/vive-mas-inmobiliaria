'use strict';

/**
 * src/utils/email.js — VERSIÓN DE COMPATIBILIDAD COMPLETA (11 funciones)
 * ---------------------------------------------------------------------------
 * ⚠️ POR QUÉ EXISTE ESTE ARCHIVO
 *
 * En el último despliegue pudo haberse subido el email.js "de banco de
 * pruebas", que sólo exporta 5 cosas (transporter, enviarCorreo,
 * correoConfigurado, enviarCodigoMarca, enviarResumenEmbajador). Pero
 * auth.controller.js destruye 6 funciones que ese archivo NO tiene:
 *
 *   const { generarCodigo, enviarCodigoVerificacion,
 *           enviarCodigoVerificacionCorreoCorporativo, enviarBienvenida,
 *           enviarEnlaceRecuperacion, enviarAlerta2FADesactivado } =
 *         require('../utils/email');
 *
 * Con el archivo de banco, registro/verificación/recuperación de contraseña
 * revientan con "undefined is not a function" (500).
 *
 * Este módulo implementa TODAS: conserva el contrato del banco (mismo
 * transporter para que el módulo Marcas siga enviando, mismo
 * correoConfigurado, mismo enviarResumenEmbajador para el cron de app.js) y
 * añade las 6 de auth. Sin EMAIL_USER/EMAIL_PASS los envíos se OMITEN con
 * warning (nunca crashea el arranque ni las respuestas HTTP).
 *
 * Si más adelante restauras el email.js ORIGINAL del repo vía git, este
 * archivo se puede sustituir sin tocar nada más: las firmas aquí son las que
 * consume el código.
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
  port: Number(process.env.EMAIL_PORT || 465),
  secure: String(process.env.EMAIL_SECURE == null ? 'true' : process.env.EMAIL_SECURE) !== 'false',
  auth: process.env.EMAIL_USER
    ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    : undefined,
});

const correoConfigurado = () => !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

/**
 * Envío genérico con remitente institucional. Respeta { from } si llega.
 */
const enviarCorreo = async (opciones = {}) => {
  if (!correoConfigurado()) {
    console.warn('[email] EMAIL_USER/EMAIL_PASS sin configurar: correo omitido');
    return { ok: false, omitido: true };
  }
  return transporter.sendMail({
    from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
    ...opciones,
  });
};

/**
 * Código OTP del módulo Marcas (asunto con formato ": NNNNNN " — el banco de
 * pruebas extrae el código del asunto con /: (\d{6}) /).
 */
const enviarCodigoMarca = async (para, codigo) =>
  transporter.sendMail({
    from: `"SomosViveMás" <${process.env.EMAIL_USER || 'no-reply@somosvivemas.com'}>`,
    to: para,
    subject: `Tu código: ${codigo} (válido 10 minutos) - SomosViveMás`,
    html: `<div style="font-family:Arial,sans-serif;text-align:center;padding:24px">
      <h2 style="color:#1a472a">Verifica tu cuenta de Marca</h2>
      <p>Ingresa este código en la pantalla de verificación:</p>
      <h1 style="color:#1a472a;font-size:40px;letter-spacing:8px">${codigo}</h1>
      <p style="color:#777">El código expira en 10 minutos. Si no solicitaste este correo, ignóralo.</p>
    </div>`,
  });

/**
 * Compat con app.js (cron semanal de embajadores). Misma firma que el módulo
 * real del repo; cuerpo resumido.
 */
const enviarResumenEmbajador = async (email, nombre, rango, score, siguiente, faltante) => {
  if (!correoConfigurado()) {
    console.warn('[email] EMAIL_USER/EMAIL_PASS sin configurar: resumen omitido');
    return { ok: false, omitido: true };
  }
  return transporter.sendMail({
    from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Tu resumen semanal como Agente Fundador - SomosViveMás',
    html: `<div style="font-family:Arial,sans-serif;padding:24px">
      <h2>Hola ${nombre || ''}, este es tu resumen semanal</h2>
      <p>Rango actual: <b>${rango || '-'}</b> · Score: <b>${score || 0}</b></p>
      ${siguiente ? `<p>Tu siguiente rango es <b>${siguiente}</b>; te faltan <b>${faltante || 0}</b> puntos.</p>` : '<p>¡Estás en el rango máximo, felicidades!</p>'}
    </div>`,
  });
};

// ===========================================================================
// FUNCIONES CONSUMIDAS POR auth.controller.js (6)
// ===========================================================================

/** Código de 6 dígitos como string (comparación exacta con String()). */
const generarCodigo = () => String(crypto.randomInt(100000, 1000000));

/** Plantilla base institucional para los correos transaccionales de auth. */
const plantilla = (titulo, cuerpoHtml) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222">
    <h2 style="color:#1a472a;border-bottom:2px solid #1a472a;padding-bottom:8px">SomosViveMás</h2>
    <h3>${titulo}</h3>
    ${cuerpoHtml}
    <p style="color:#999;font-size:12px;margin-top:24px">Si no solicitaste esto, ignora este correo; tu cuenta está segura.</p>
  </div>`;

/** Código de verificación de cuenta nueva (registro / reenvío). */
const enviarCodigoVerificacion = async (email, nombre, codigo) => {
  if (!correoConfigurado()) return { ok: false, omitido: true };
  return transporter.sendMail({
    from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Tu código de verificación: ${codigo} - SomosViveMás`,
    html: plantilla('Verifica tu cuenta', `
      <p>Hola ${nombre || ''},</p>
      <p>Ingresa este código en la pantalla de verificación:</p>
      <h1 style="color:#1a472a;font-size:40px;letter-spacing:8px">${codigo}</h1>
      <p style="color:#777">El código expira en 15 minutos.</p>`),
  });
};

/** Código de verificación para un correo corporativo dentro del flujo KYB. */
const enviarCodigoVerificacionCorreoCorporativo = async (correo, razonSocial, codigo) => {
  if (!correoConfigurado()) return { ok: false, omitido: true };
  return transporter.sendMail({
    from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: `Verifica el correo corporativo de tu empresa: ${codigo} - SomosViveMás`,
    html: plantilla('Verifica tu correo corporativo', `
      <p>La empresa <b>${razonSocial || ''}</b> registró este correo en SomosViveMás.</p>
      <p>Código de verificación:</p>
      <h1 style="color:#1a472a;font-size:40px;letter-spacing:8px">${codigo}</h1>
      <p style="color:#777">El código expira en 15 minutos.</p>`),
  });
};

/** Correo de bienvenida al verificar la cuenta. */
const enviarBienvenida = async (email, nombre, plan) => {
  if (!correoConfigurado()) return { ok: false, omitido: true };
  return transporter.sendMail({
    from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '¡Bienvenido a SomosViveMás!',
    html: plantilla('Tu cuenta está verificada', `
      <p>Hola ${nombre || ''},</p>
      <p>Tu cuenta <b>${email}</b> ya está activa con el plan <b>${plan || 'gratuito'}</b>.</p>
      <p>¡Bienvenido a SomosViveMás!</p>`),
  });
};

/**
 * Enlace de restablecimiento de contraseña. `resetToken` es el JWT de un solo
 * uso que ya genera auth.controller; aquí se envuelve en la URL del frontend.
 * Si tu página de restablecimiento tiene otra ruta, define en el .env:
 *   RESET_URL_TEMPLATE=https://somosvivemas.com/pages/tu-pagina.html?token={TOKEN}
 */
const urlRestablecimiento = (token) => {
  const plantillaUrl = process.env.RESET_URL_TEMPLATE;
  if (plantillaUrl) return plantillaUrl.replace('{TOKEN}', encodeURIComponent(token));
  const base = (process.env.FRONTEND_URL || 'https://somosvivemas.com').replace(/\/+$/, '');
  return `${base}/restablecer.html?token=${encodeURIComponent(token)}`;
};

const enviarEnlaceRecuperacion = async (email, nombre, resetToken) => {
  if (!correoConfigurado()) return { ok: false, omitido: true };
  const enlace = urlRestablecimiento(resetToken);
  return transporter.sendMail({
    from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Recupera tu contraseña - SomosViveMás',
    html: plantilla('Recupera tu contraseña', `
      <p>Hola ${nombre || ''},</p>
      <p>Solicitaste restablecer tu contraseña. El enlace expira en 1 hora y funciona una sola vez:</p>
      <p><a href="${enlace}" style="display:inline-block;background:#1a472a;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">Restablecer contraseña</a></p>
      <p style="color:#777;font-size:12px;word-break:break-all">Si el botón no funciona, copia y pega: ${enlace}</p>`),
  });
};

/** Alerta de seguridad cuando la 2FA se desactiva (recuperación o manual). */
const enviarAlerta2FADesactivado = async (email, nombre) => {
  if (!correoConfigurado()) return { ok: false, omitido: true };
  return transporter.sendMail({
    from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '⚠️ La verificación en dos pasos fue desactivada - SomosViveMás',
    html: plantilla('Aviso de seguridad', `
      <p>Hola ${nombre || ''},</p>
      <p>La <b>verificación en dos pasos (2FA)</b> de tu cuenta <b>${email}</b> fue <b>desactivada</b>.</p>
      <p>Si <b>no</b> fuiste tú, restablece tu contraseña de inmediato y contacta a soporte.</p>`),
  });
};

module.exports = {
  // contrato del banco / Marcas / app.js
  transporter,
  enviarCorreo,
  correoConfigurado,
  enviarCodigoMarca,
  enviarResumenEmbajador,
  // contrato de auth.controller.js
  generarCodigo,
  enviarCodigoVerificacion,
  enviarCodigoVerificacionCorreoCorporativo,
  enviarBienvenida,
  enviarEnlaceRecuperacion,
  enviarAlerta2FADesactivado,
};
