// ==========================================
// SMS — Twilio
// ==========================================
// Requiere estas variables de entorno (ver .env.example):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_PHONE_NUMBER   (número de Twilio remitente, formato E.164, ej. +14155551234)
//
// Mientras esas variables no estén configuradas, enviarCodigoSMS() no falla ni
// tumba el registro/login: registra un aviso claro en consola y devuelve
// { ok: false, motivo: 'twilio_no_configurado' } para que el controlador decida
// qué hacer (por ahora, auth.controller.js hace fallback a email si esto pasa).

let clienteTwilio = null;
let avisoMostrado = false;

const twilioConfigurado = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);

const obtenerCliente = () => {
  if (!twilioConfigurado()) return null;
  if (!clienteTwilio) {
    const twilio = require('twilio');
    clienteTwilio = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return clienteTwilio;
};

const enviarCodigoSMS = async (telefono, codigo) => {
  if (!twilioConfigurado()) {
    if (!avisoMostrado) {
      console.warn('⚠️ SMS no configurado (faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER en .env). El código de verificación no se pudo enviar por SMS.');
      avisoMostrado = true;
    }
    return { ok: false, motivo: 'twilio_no_configurado' };
  }

  try {
    const client = obtenerCliente();
    await client.messages.create({
      body: `Vive Más Inmobiliaria: tu código de verificación es ${codigo}. Vence en 15 minutos.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: telefono,
    });
    return { ok: true };
  } catch (error) {
    console.error('❌ Error al enviar SMS con Twilio:', error.message);
    return { ok: false, motivo: 'error_envio', error: error.message };
  }
};

module.exports = { enviarCodigoSMS, twilioConfigurado };