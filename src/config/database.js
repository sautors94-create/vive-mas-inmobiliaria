'use strict';

/**
 * src/config/database.js
 * ---------------------------------------------------------------------------
 * Conexion a MongoDB tolerante a fallos:
 *  - NO mata el proceso si la BD no responde (antes hacia process.exit(1)):
 *    reintenta con backoff exponencial y la app queda en modo degradado
 *    (sirviendo /health y endpoints sin datos) hasta que la BD vuelva.
 *  - Sin MONGODB_URI definida: avisa con la solucion exacta y no reintentara
 *    en vano (el .env no cambia durante la ejecucion).
 *  - Una vez conectado, mongoose mantiene el pool y reconecta solo si la
 *    conexion se cae.
 */

const mongoose = require('mongoose');

// Parametros de reintento (sobreescribibles por .env para pruebas/operacion)
const MAX_INTENTOS_INICIALES = Number.parseInt(process.env.DB_RETRY_MAX, 10) || 8;
const BACKOFF_BASE_MS = Number.parseInt(process.env.DB_RETRY_BASE_MS, 10) || 2000;
const RETRY_SEGUNDO_PLANO_MS = Number.parseInt(process.env.DB_RETRY_FOREVER_MS, 10) || 60000;

let conexionEnCurso = null; // memo: evita llamar dos veces a mongoose.connect

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (intento) => Math.min(BACKOFF_BASE_MS * 2 ** intento, 30_000);

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

async function conectarUnaVez() {
  return mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 10,                // mantener 10 conexiones listas
    minPoolSize: 5,                 // minimo 5 siempre activas
    serverSelectionTimeoutMS: 5000, // si no encuentra servidor en 5s, falla rapido
    socketTimeoutMS: 45000,         // cerrar sockets inactivos a los 45s
    connectTimeoutMS: 10000         // timeout de conexion inicial
  });
}

const connectDB = async () => {
  if (conexionEnCurso) return conexionEnCurso;

  if (!process.env.MONGODB_URI) {
    console.error(
      '[DB] MONGODB_URI no esta definida en el entorno.\n' +
      '     La app arranca en modo degradado (los endpoints de datos fallaran hasta definirla).\n' +
      '     Solucion: copia .env.example como .env y define MONGODB_URI.'
    );
    return undefined;
  }

  conexionEnCurso = (async () => {
    for (let intento = 1; intento <= MAX_INTENTOS_INICIALES; intento++) {
      try {
        const conn = await conectarUnaVez();
        console.log(`MongoDB conectado: ${conn.connection.host}/${conn.connection.name}`);
        return conn;
      } catch (error) {
        const espera = backoffMs(intento);
        console.error(`[DB] Intento ${intento}/${MAX_INTENTOS_INICIALES} fallo: ${error.message}. Reintento en ${Math.round(espera / 1000)}s...`);
        await esperar(espera);
      }
    }

    // Agotados los intentos iniciales: NO cerrar la app. La dejamos viva en
    // modo degradado y seguimos reintentando en segundo plano (auto-sanacion).
    console.error('[DB] Sin conexion inicial a MongoDB. La app sigue arriba en modo degradado y reintentara cada minuto.');
    const timer = setInterval(async () => {
      try {
        const conn = await conectarUnaVez();
        clearInterval(timer);
        console.log(`MongoDB conectado (reintento tardio): ${conn.connection.host}/${conn.connection.name}`);
      } catch (e) {
        console.error(`[DB] Reintento de fondo fallo: ${e.message}`);
      }
    }, RETRY_SEGUNDO_PLANO_MS);
    if (typeof timer.unref === 'function') timer.unref(); // no impide el apagado
  })();

  return conexionEnCurso;
};

// Visibilidad del ciclo de vida de la conexion
mongoose.connection.on('disconnected', () => {
  console.warn('[DB] Conexion a MongoDB perdida. Mongoose reconectara automaticamente.');
});
mongoose.connection.on('reconnected', () => {
  console.log('[DB] MongoDB reconectado.');
});

module.exports = connectDB;
module.exports.isDbConnected = isDbConnected;
