'use strict';

/**
 * src/utils/twilioVerify.js — Verificación por SMS vía Twilio Verify v2.
 * ---------------------------------------------------------------------------
 * Contrato que consumen los controladores de Marcas y el test de integración:
 *   - twilioVerifyConfigurado(): bool — el test la sustituye para activar/
 *     desactivar el canal SMS sin tocar process.env. Los controladores NUNCA
 *     leen las variables de Twilio directamente (antes lo hacían y por eso el
 *     test "SMS no disponible si Twilio no está configurado (no se finge)"
 *     era imposible de pasar).
 *   - normalizarTelefono(raw): '+52XXXXXXXXXX' en E.164 o null si inválido.
 *       '55 1234 5678'      → '+525512345678'  (10 dígitos locales)
 *       '+52 55 1234 5678'  → '+525512345678'  (con lada país)
 *       '+521 55 1234 5678' → '+525512345678'  (México dejó de usar el '1')
 *       '123'               → null (el controller responde 400)
 *   - enviarOTP(telefono) / verificarOTP(telefono, codigo): usados por el
 *     registro SMS y por "agregar teléfono al panel". El stub del test devuelve
 *     { ok: codigo === '654321' }.
 */

const twilioVerifyConfigurado = () =>
  !!(process.env.SID_TWILIO && process.env.TOKEN_TWILIO && process.env.SID_SERVICIO_TWILIO);

const normalizarTelefono = (raw) => {
  if (raw == null) return null;
  let digitos = String(raw).replace(/\D/g, '');
  if (digitos.length === 12 && digitos.startsWith('521')) digitos = digitos.slice(3);
  else if (digitos.length === 12 && digitos.startsWith('52')) digitos = digitos.slice(2);
  else if (digitos.length === 11 && digitos.startsWith('52')) digitos = digitos.slice(2);
  if (digitos.length !== 10) return null;
  return `+52${digitos}`;
};

const cliente = () => require('twilio')(process.env.SID_TWILIO, process.env.TOKEN_TWILIO);

const enviarOTP = async (telefono) =>
  cliente()
    .verify.v2.services(process.env.SID_SERVICIO_TWILIO)
    .verifications.create({ to: telefono, channel: 'sms' });

const verificarOTP = async (telefono, codigo) => {
  try {
    const resultado = await cliente()
      .verify.v2.services(process.env.SID_SERVICIO_TWILIO)
      .verificationChecks.create({ to: telefono, code: String(codigo) });
    return { ok: resultado.status === 'approved', status: resultado.status };
  } catch (error) {
    return { ok: false, error: error && error.message };
  }
};

module.exports = { twilioVerifyConfigurado, normalizarTelefono, enviarOTP, verificarOTP };
