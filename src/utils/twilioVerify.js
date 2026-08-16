// ==========================================
// Twilio Verify — envío y validación de OTP
// ==========================================
// Variables de entorno requeridas (ver .env del servidor):
//   SID_TWILIO            (Account SID)
//   Token_TWILIO           (Auth Token)
//   SID_SERVICIO_TWILIO    (Verify Service SID, empieza con "VA...")
//
// A diferencia del envío de SMS "a mano" (src/utils/sms.js, ya NO se usa
// para el flujo de OTP), Twilio Verify genera, envía, expira y valida el
// código por su cuenta: nosotros no generamos ni guardamos el código en
// nuestra base de datos para el canal SMS.
//
// Mientras las 3 variables no estén configuradas, enviarOTP()/verificarOTP()
// no truenan: devuelven { ok:false, motivo:'twilio_no_configurado' } para que
// el controlador decida qué hacer (fallback a email en registro; error claro
// en cambio de celular, ya que ahí no existe un fallback posible).

let clienteTwilio = null;
let avisoMostrado = false;

const twilioVerifyConfigurado = () =>
  !!(process.env.SID_TWILIO && process.env.Token_TWILIO && process.env.SID_SERVICIO_TWILIO);

const obtenerCliente = () => {
  if (!twilioVerifyConfigurado()) return null;
  if (!clienteTwilio) {
    const twilio = require('twilio');
    clienteTwilio = twilio(process.env.SID_TWILIO, process.env.Token_TWILIO);
  }
  return clienteTwilio;
};

// Normaliza a formato E.164 para la llamada a Twilio (no se usa para guardar
// en la base de datos: ahí se sigue guardando el número tal cual lo escribió
// el usuario, como ya hacía el resto del sitio).
const normalizarTelefono = (telefono) => {
  if (!telefono) return null;
  const limpio = String(telefono).trim();
  if (limpio.startsWith('+')) return `+${limpio.slice(1).replace(/\D/g, '')}`;
  const soloDigitos = limpio.replace(/\D/g, '');
  if (soloDigitos.length === 10) return `+52${soloDigitos}`; // celular MX sin lada de país
  if (soloDigitos.length === 12 && soloDigitos.startsWith('52')) return `+${soloDigitos}`;
  return `+${soloDigitos}`;
};

const enviarOTP = async (telefono) => {
  if (!twilioVerifyConfigurado()) {
    if (!avisoMostrado) {
      console.warn('⚠️ Twilio Verify no configurado (faltan SID_TWILIO / Token_TWILIO / SID_SERVICIO_TWILIO en .env). No se pudo enviar el código OTP por SMS.');
      avisoMostrado = true;
    }
    return { ok: false, motivo: 'twilio_no_configurado' };
  }

  const telefonoE164 = normalizarTelefono(telefono);
  try {
    const client = obtenerCliente();
    const verificacion = await client.verify.v2
      .services(process.env.SID_SERVICIO_TWILIO)
      .verifications.create({ to: telefonoE164, channel: 'sms' });
    return { ok: true, status: verificacion.status };
  } catch (error) {
    console.error('❌ Error al enviar OTP con Twilio Verify:', error.message);
    return { ok: false, motivo: 'error_envio', error: error.message };
  }
};

const verificarOTP = async (telefono, codigo) => {
  if (!twilioVerifyConfigurado()) {
    return { ok: false, motivo: 'twilio_no_configurado' };
  }
  if (!codigo) return { ok: false, motivo: 'codigo_vacio' };

  const telefonoE164 = normalizarTelefono(telefono);
  try {
    const client = obtenerCliente();
    const resultado = await client.verify.v2
      .services(process.env.SID_SERVICIO_TWILIO)
      .verificationChecks.create({ to: telefonoE164, code: String(codigo).trim() });
    return { ok: resultado.status === 'approved', status: resultado.status };
  } catch (error) {
    // Twilio responde error (404 "not found") cuando ya no hay una verificación
    // pendiente para ese número: código vencido, ya usado, o nunca se envió.
    console.error('❌ Error al validar OTP con Twilio Verify:', error.message);
    return { ok: false, motivo: 'error_validacion', error: error.message };
  }
};

// Verifica la conexión real contra Twilio (sin mandar SMS ni gastar saldo):
// consulta los datos del Verify Service con las credenciales configuradas.
// Se usa en el panel de Salud para diagnosticar con la causa exacta en vez
// de solo confirmar que las 3 variables existan.
const verificarConexion = async () => {
  if (!twilioVerifyConfigurado()) {
    return { ok: false, detalle: 'Faltan SID_TWILIO / Token_TWILIO / SID_SERVICIO_TWILIO en el .env' };
  }
  if (!process.env.SID_SERVICIO_TWILIO.startsWith('VA')) {
    return {
      ok: false,
      detalle: `SID_SERVICIO_TWILIO no tiene el formato esperado (debe empezar con "VA...", el tuyo empieza con "${process.env.SID_SERVICIO_TWILIO.slice(0, 4)}") — revisa que no hayas puesto el Account SID (empieza con "AC...") por error`
    };
  }
  try {
    const client = obtenerCliente();
    const servicio = await client.verify.v2.services(process.env.SID_SERVICIO_TWILIO).fetch();
    return { ok: true, detalle: `Conectado — servicio "${servicio.friendlyName}"` };
  } catch (error) {
    return { ok: false, detalle: `Twilio rechazó la conexión: ${error.message}${error.code ? ` (código ${error.code})` : ''}` };
  }
};

module.exports = { enviarOTP, verificarOTP, twilioVerifyConfigurado, normalizarTelefono, verificarConexion };