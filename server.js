'use strict';

/**
 * server.js - Punto de entrada de vive-mas-inmobiliaria
 * ---------------------------------------------------------------------------
 * Diseno tolerante a fallos de configuracion:
 *  1. Diagnostica el entorno ANTES de cargar la app y avisa lo que falte.
 *  2. La app arranca aunque falten variables opcionales (servicios degradados).
 *  3. Maneja EADDRINUSE, SIGTERM/SIGINT y errores no capturados.
 */

require('dotenv').config();

// Diagnostico temprano: debe ejecutarse ANTES de require('./src/app') para
// que los avisos aparezcan antes de cualquier inicializacion de SDKs.
const { checkEnvironment, features } = require('./src/config/env');
checkEnvironment();

const app = require('./src/app');

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, () => {
  const degradados = [
    !features.stripe && 'pagos',
    !features.chatbot && 'chatbot',
    !features.email && 'correo',
    !features.sms && 'sms',
    !features.cloudinary && 'imagenes',
  ].filter(Boolean);

  console.log('------------------------------------------------------------');
  console.log(`Servidor corriendo en http://localhost:${PORT} [${NODE_ENV}]`);
  console.log(degradados.length
    ? `Servicios sin configurar (degradados): ${degradados.join(', ')}`
    : 'Todos los servicios opcionales configurados');
  console.log('------------------------------------------------------------');
});

// Errores del listener (puerto ocupado, permisos, etc.)
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[FATAL] El puerto ${PORT} ya esta en uso. Libera el puerto o define otro PORT en .env`);
  } else {
    console.error('[FATAL] Error al iniciar el servidor:', err && err.message ? err.message : err);
  }
  process.exit(1);
});

// Apagado ordenado: Hostinger/PM2/Docker envian SIGTERM en deploy/reinicio.
const shutdown = (signal) => {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  server.close(() => process.exit(0));
  // Red de seguridad: si alguna conexion colgada impide el close, salir igual.
  setTimeout(() => process.exit(0), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Errores no capturados: registrar con detalle completo.
// - unhandledRejection: se registra y se sigue vivo (disponibilidad > pureza).
// - uncaughtException: estado posiblemente corrupto, se sale con codigo 1.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});
