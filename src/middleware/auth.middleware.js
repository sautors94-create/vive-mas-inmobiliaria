'use strict';

/**
 * src/middleware/auth.middleware.js — Verificación de sesión (Bearer JWT)
 * ---------------------------------------------------------------------------
 * Correcciones aplicadas sobre la versión original:
 *  1. ❌ ANTES: se hidrataba el documento y se hacía user.save() en CADA
 *     petición (revalidaba todo el schema, tocaba updatedAt y generaba una
 *     escritura por request = write amplification). AHORA: lectura mínima
 *     con .lean() y escritura puntual con updateOne, a lo sumo 1 vez/minuto.
 *  2. Guard de JWT_SECRET ausente: 500 con mensaje claro (antes caía al
 *     catch genérico y respondía 401 engañoso).
 *  3. Token vacío tras 'Bearer ' se rechaza; payload sin `id` se rechaza.
 *  4. jwt.verify con algoritmo fijado a HS256 (anti alg-confusion).
 *  5. ultimaActividad null/undefined ya no puede expirar la sesión por un
 *     NaN (antes `ahora - null` = número gigante → 401 injusto).
 *  6. Los fallos de infraestructura (BD caída) responden 500 y NO 401, para
 *     no cerrar sesiones válidas por un error transitorio.
 *  7. (v2) role SIEMPRE desde la BD: req.user.role se sobrescribe con el rol
 *     real del documento. Cierra el gap de revocación de requireRole(): un
 *     admin degradado en la BD pierde el acceso en la petición siguiente,
 *     aunque su token aún diga role:'admin'.
 *
 * Mensajes y códigos preservados para el frontend:
 *   401 'Token requerido' | 401 'Usuario no encontrado' | 401 'Token inválido
 *   o expirado' | 401 {error:'Sesión expirada por inactividad',sesionExpirada:true}
 *   403 'Cuenta suspendida o bloqueada'
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Ventana de inactividad que expira la sesión (15 minutos, como antes)
const INACTIVIDAD_MS = 15 * 60 * 1000;
// La actividad se persiste como máximo una vez por minuto: en ráfagas de
// peticiones no se escribe en cada una, pero la marca queda siempre lo
// bastante fresca como para que el chequeo de 15 min sea correcto.
const FRECUENCIA_ESCRITURA_MS = 60 * 1000;

const authMiddleware = async (req, res, next) => {
  try {
    // ── 1. Token presente ────────────────────────────────────────────────
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    const token = header.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    // ── 2. Secreto configurado (fallo del servidor, no del cliente) ──────
    if (!process.env.JWT_SECRET) {
      console.error('[auth] JWT_SECRET no está definido; no se puede verificar el token');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    // ── 3. Firma, algoritmo y expiración ─────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // ── 4. Usuario existe y está activo (lectura mínima, SIN hidratar) ───
    //    `role` viaja también: es la fuente del req.user.role que consume
    //    requireRole() (ver punto 7 del encabezado).
    const user = await User.findById(decoded.id).select('status ultimaActividad role').lean();
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    if (user.status === 'suspendido' || user.status === 'bloqueado') {
      return res.status(403).json({ error: 'Cuenta suspendida o bloqueada' });
    }

    // ── 5. Inactividad (15 min). Sin marca previa NO se expira: se ───────
    //    registra la actividad y se continúa.
    const ahora = Date.now();
    const ultima = user.ultimaActividad ? new Date(user.ultimaActividad).getTime() : 0;
    if (ultima && ahora - ultima > INACTIVIDAD_MS) {
      return res.status(401).json({
        error: 'Sesión expirada por inactividad',
        sesionExpirada: true
      });
    }

    // ✅ Actualizar última actividad SIN user.save(): escritura puntual
    //    ($set) y como máximo una vez por minuto (throttle).
    if (!ultima || ahora - ultima > FRECUENCIA_ESCRITURA_MS) {
      try {
        await User.updateOne({ _id: user._id }, { $set: { ultimaActividad: new Date(ahora) } });
      } catch (err) {
        // Un fallo al registrar actividad no debe tumbar la petición autenticada
        console.error('[auth] No se pudo registrar ultimaActividad:', err && err.message);
      }
    }

    // ── 6. req.user = payload del token, con el role SIEMPRE desde la BD ──
    //    requireRole() lee req.user.role. Si ese rol viniera sólo del token,
    //    un admin degradado o despedido conservaría poderes hasta que expire
    //    su JWT (gap de revocación). La BD manda: si el documento trae role,
    //    sobrescribe el del payload; si no existe el campo (documentos
    //    antiguos), se conserva el del token para no romper nada.
    req.user = user.role ? { ...decoded, role: user.role } : decoded;
    next();
  } catch (error) {
    // Aquí sólo llegan fallos de infraestructura (p. ej. BD caída): 500, no
    // 401, para no invalidar sesiones correctas por un error transitorio.
    console.error('[auth] Error de autenticación:', error && error.message ? error.message : error);
    return res.status(500).json({ error: 'Error interno de autenticación' });
  }
};

module.exports = authMiddleware;
