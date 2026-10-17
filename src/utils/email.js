'use strict';

/**
 * src/utils/email.js — Transporte de correo (SMTP Hostinger por defecto).
 * ---------------------------------------------------------------------------
 * RECONSTRUCCIÓN del módulo a partir del contrato que consume el ecosistema:
 *   - tests/marcas.integration.js sustituye `email.transporter.sendMail` ANTES
 *     de requerir los controladores → el módulo DEBE exportar `transporter`
 *     como objeto con sendMail (los tests registran los correos ahí).
 *   - src/app.js usa `enviarResumenEmbajador(...)` (cron semanal).
 *   - Los controladores de marcas envían el código OTP con
 *     transporter.sendMail DIRECTAMENTE (no vía enviarCorreo) para que el
 *     banco de pruebas intercepte el envío aunque EMAIL_USER no esté definido.
 *
 * Seguro por diseño: sin EMAIL_USER/EMAIL_PASS el envío real se omite con un
 * warning (nunca crashea el arranque; database.js ya no hace exit en fallos).
 */

const nodemailer = require('nodemailer');

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

module.exports = {
  transporter,
  enviarCorreo,
  correoConfigurado,
  enviarCodigoMarca,
  enviarResumenEmbajador,
};
