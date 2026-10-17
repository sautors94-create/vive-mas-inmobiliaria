'use strict';

/**
 * src/config/env.js
 * ---------------------------------------------------------------------------
 * Fuente unica de verdad sobre el estado de las variables de entorno.
 *
 * - checkEnvironment(): diagnostico legible al arrancar. NO mata el proceso;
 *   informa que falta y que funcionalidad queda degradada.
 * - features: flags que indican que servicios opcionales estan configurados.
 *   Los controladores deben consultarlos para inicializar sus SDKs de forma
 *   perezosa (lazy) en lugar de crashear al hacer require del modulo.
 *
 * NOTA: los nombres de variables se ajustaran a los usos reales del codigo
 * a medida que se revisen los modulos (app.js, controladores, servicios).
 */

// ---- OBLIGATORIAS: sin ellas las funciones nucleares no pueden operar ----
const REQUIRED = [
  { name: 'MONGODB_URI',        what: 'Cadena de conexion a MongoDB', how: 'mongodb://127.0.0.1:27017/vive-mas' },
  { name: 'JWT_SECRET',         what: 'Firma de tokens de acceso',    how: 'valor generado con: openssl rand -hex 32' },
  { name: 'JWT_REFRESH_SECRET', what: 'Firma de refresh tokens',      how: 'valor generado con: openssl rand -hex 32' },
];

// ---- OPCIONALES: degradan una funcion concreta, no tumban la app ---------
const OPTIONAL = [
  { feature: 'Pagos (Stripe)',        vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
  { feature: 'Chatbot IA (Groq)',     vars: ['GROQ_API_KEY'] },
  { feature: 'Correo (Nodemailer)',   vars: ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM'] },
  { feature: 'SMS (Twilio)',          vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'] },
  { feature: 'Imagenes (Cloudinary)', vars: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] },
  { feature: 'CORS restringido',      vars: ['CLIENT_URL'] },
];

// Flags de capacidad consultables desde cualquier modulo del proyecto
const features = {
  stripe: false,      // SDK de Stripe inicializable
  chatbot: false,     // Groq inicializable
  email: false,       // Transporter de correo inicializable
  sms: false,         // Cliente Twilio inicializable
  cloudinary: false,  // SDK Cloudinary inicializable
  corsLocked: false,  // true cuando CLIENT_URL esta definida (CORS cerrado)
};

function refreshFeatures() {
  const all = (names) => names.every((n) => Boolean(process.env[n]));

  features.stripe     = all(['STRIPE_SECRET_KEY']);
  features.chatbot    = all(['GROQ_API_KEY']);
  features.email      = all(['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS']);
  features.sms        = all(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']);
  features.cloudinary = all(['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']);
  features.corsLocked = all(['CLIENT_URL']);
}

/**
 * Diagnostico de arranque. Nunca lanza ni hace exit: el objetivo es que la
 * app degrade funciones en lugar de crashear por variables ausentes.
 */
function checkEnvironment({ logger = console } = {}) {
  refreshFeatures();

  const missingRequired = REQUIRED.filter((v) => !process.env[v.name]);
  const missingOptional = OPTIONAL.filter((g) => !g.vars.every((n) => Boolean(process.env[n])));

  logger.log('=== Verificacion de variables de entorno ===');

  if (missingRequired.length === 0) {
    logger.log(`  OK   Obligatorias: ${REQUIRED.length}/${REQUIRED.length} presentes`);
  } else {
    logger.log(`  !!   Obligatorias faltantes (${missingRequired.length}):`);
    for (const v of missingRequired) {
      logger.log(`       - ${v.name}: ${v.what}`);
      logger.log(`         Ejemplo: ${v.name}=${v.how}`);
    }
    logger.log('  La app intentara arrancar; las funciones que dependan de estas variables fallaran de forma controlada.');
  }

  if (missingOptional.length === 0) {
    logger.log('  OK   Opcionales: todos los servicios configurados');
  } else {
    logger.log(`  ..   Servicios degradados (${missingOptional.length}):`);
    for (const g of missingOptional) {
      const faltan = g.vars.filter((n) => !process.env[n]).join(', ');
      logger.log(`       - ${g.feature}: faltan ${faltan}`);
    }
    logger.log('  La app arranca igual; cada servicio degradado respondera 503 hasta configurarse.');
  }

  logger.log('=============================================');

  return { missingRequired, missingOptional, features };
}

module.exports = { REQUIRED, OPTIONAL, features, refreshFeatures, checkEnvironment };
