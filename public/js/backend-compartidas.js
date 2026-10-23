/* ═══════════════════════════════════════════════════════════════════
   backend-compartidas.js — Vive Más Inmobiliaria
   Módulo AUTOCONTENIDO que cuenta cuántas veces se comparte cada
   propiedad (el contador que faltaba detrás del KPI "🔄 Compartidas").
   ───────────────────────────────────────────────────────────────────
   CÓMO INSTALARLO (1 paso — app.js YA lo llama):

   1) Copia este archivo a la carpeta src/ de tu backend, JUNTO a app.js.

      (src/app.js ya incluye la llamada tolerante:
         registrarRutasCompartidas(app, { authAdmin: [authMiddleware, requireRole('admin')] })
       y server.js no necesita NINGÚN cambio.)

   2) Reinicia el servidor (PM2 restart …). Listo — no hay que tocar nada más:
      - POST /api/propiedades/:id/compartir   → suma 1 (lo llama el
        nuevo contador-compartidas.js desde propiedad.html)
      - GET  /api/propiedades/:id/compartir   → lee el conteo
        (badge "🔄 N veces compartida" en la página de la propiedad)
      - GET  /api/admin/propiedades/compartidas?ids=a,b,c → conteo
        masivo para la columna "🔄 Compartidas" del panel admin

   NOTA: el campo `compartidas` se guarda DENTRO del documento de la
   propiedad ($inc), así que no requiere migración ni colección nueva.
   Tu endpoint /propiedades/mis-propiedades ya lo devolverá solo
   (salvo que use .select() con lista explícita de campos: en ese
   caso agrega "compartidas" a esa lista) y el KPI del resumen del
   dashboard se encenderá automáticamente, sin cambios en dashboard.js.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

// ── Límite anti-spam en memoria: máx. 30 registros por IP por hora ──
const LIMITES = new Map(); // ip -> { contador, inicio }
const MAX_POR_HORA = 30;

const ipDe = (req) => {
  const fwd = (req.headers && req.headers['x-forwarded-for']) || '';
  return String(fwd).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '?';
};

const permitido = (ip) => {
  const ahora = Date.now();
  let r = LIMITES.get(ip);
  if (!r || ahora - r.inicio > 3600000) { r = { contador: 0, inicio: ahora }; LIMITES.set(ip, r); }
  r.contador += 1;
  return r.contador <= MAX_POR_HORA;
};

// Devuelve el modelo Mongoose de propiedades en tiempo de petición
// (así funciona aunque el módulo se cargue antes de conectar la BD).
// Detecta SOLO el nombre: tu proyecto registra el modelo como
// "Property" (src/models/Property.js, igual que usa app.js); se
// acepta también "Propiedad" por si cambia la convención.
const modeloPropiedad = () => {
  const mongoose = require('mongoose');
  if (mongoose.models.Property) return mongoose.models.Property;      // nombre real del proyecto
  if (mongoose.models.Propiedad) return mongoose.models.Propiedad;    // variante en español
  try { return require('./models/Property'); } catch (e) { /* ruta distinta */ }
  return mongoose.model('Propiedad'); // ◄ AJUSTAR solo si tu modelo tiene otro nombre
};

const ES_ID_VALIDO = (id) => {
  try {
    const mongoose = require('mongoose');
    return mongoose.Types.ObjectId.isValid(id);
  } catch (e) { return false; }
};

const registrarRutasCompartidas = (app, opciones = {}) => {
  const authAdmin = Array.isArray(opciones.authAdmin) ? opciones.authAdmin : [];
  if (!authAdmin.length) {
    console.warn('[compartidas] Aviso: GET /api/admin/propiedades/compartidas quedó PÚBLICO ' +
      '(solo expone conteos). Pasa { authAdmin: [...] } para protegerlo.');
  }

  // ── 1) SUMAR una compartida (público — lo llama contador-compartidas.js) ──
  app.post('/api/propiedades/:id/compartir', async (req, res) => {
    try {
      if (!permitido(ipDe(req))) {
        return res.status(429).json({ ok: false, error: 'Demasiadas solicitudes, intenta más tarde' });
      }
      if (!ES_ID_VALIDO(req.params.id)) {
        return res.status(400).json({ ok: false, error: 'Id inválido' });
      }
      const p = await modeloPropiedad().findByIdAndUpdate(
        req.params.id,
        { $inc: { compartidas: 1 } },
        { new: true, select: 'compartidas' }
      );
      if (!p) return res.status(404).json({ ok: false, error: 'Propiedad no encontrada' });
      res.json({ ok: true, compartidas: p.compartidas || 0 });
    } catch (e) {
      console.error('[compartidas] error al sumar:', e.message);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  });

  // ── 2) CONSULTAR el conteo (público — badge en propiedad.html) ──
  app.get('/api/propiedades/:id/compartir', async (req, res) => {
    try {
      if (!ES_ID_VALIDO(req.params.id)) {
        return res.status(400).json({ ok: false, error: 'Id inválido' });
      }
      const p = await modeloPropiedad().findById(req.params.id).select('compartidas');
      if (!p) return res.status(404).json({ ok: false, error: 'Propiedad no encontrada' });
      res.json({ ok: true, compartidas: p.compartidas || 0 });
    } catch (e) {
      console.error('[compartidas] error al consultar:', e.message);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  });

  // ── 3) CONTEO MASIVO para el panel admin (protegido con authAdmin) ──
  app.get('/api/admin/propiedades/compartidas', ...authAdmin, async (req, res) => {
    try {
      const ids = String((req.query && req.query.ids) || '')
        .split(',').map(s => s.trim()).filter(s => /^[a-f0-9]{24}$/i.test(s)).slice(0, 200);
      if (!ids.length) return res.json({ ok: true, conteos: {} });
      const lista = await modeloPropiedad()
        .find({ _id: { $in: ids } })
        .select('compartidas')
        .lean();
      const conteos = {};
      lista.forEach(p => { conteos[String(p._id)] = p.compartidas || 0; });
      res.json({ ok: true, conteos });
    } catch (e) {
      console.error('[compartidas] error en conteo masivo:', e.message);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  });

  console.log('[compartidas] Rutas registradas: POST+GET /api/propiedades/:id/compartir · GET /api/admin/propiedades/compartidas');
};

module.exports = { registrarRutasCompartidas };
