/* ═══════════════════════════════════════════════════════════════════════
   salud-admin.js — Vive Más Inmobiliaria · v1.2 (Task 46)
   MOTOR COMPLETO de "Salud del sistema" para el panel admin.
   ─────────────────────────────────────────────────────────────────────
   NOVEDAD v1.2 (Task 46)
   - GITHUB ELIMINADO a petición del usuario ("no es necesario"): la tarjeta
     desaparece del panel porque esta ruta ya no la manda.
   - NUEVO: si no hay token de Meta en el .env, el motor lo BUSCA EN LA BASE
     DE DATOS (donde lo guarda el botón "Conectar con Facebook" del panel).
     Si el token del .env está vencido (401), prueba también el de la BD.
     El token JAMÁS se incluye en la respuesta: solo se usa para verificar
     contra Graph API.

   POR QUÉ EXISTE ESTE ARCHIVO
   El panel admin (Sección "Salud del sistema") dejaba de mostrar las
   tarjetas de Cloudinary / Meta / Node / Stripe cuando una actualización
   del backend respondía esa ruta con una forma mínima (solo versión y
   conteos). Este módulo convierte GET /api/admin/salud en el endpoint
   DEFINITIVO: verifica de verdad cada servicio y responde una forma
   SUPERCONJUNTO que el panel pinta sin cambios.

   CÓMO INSTALARLO (app.js v7 YA lo llama — no hay que tocar más nada)
   1) Copia este archivo a la carpeta src/ de tu backend, JUNTO a app.js.
   2) Reinicia el servidor (PM2 restart …). Listo.

   QUÉ VERIFICA (de verdad, con red y con límite de tiempo)
   - Node.js   : versión, tiempo activo, memoria (siempre operativo).
   - MongoDB   : readyState + ping real a la BD (mide latencia).
   - Cloudinary: credenciales en .env + api.ping() del SDK.
   - Stripe    : STRIPE_SECRET_KEY + stripe.balance.retrieve().
   - Meta      : token del .env O guardado en la BD + GET graph.facebook.com/me.
   (GitHub retirado en v1.2 por decisión del usuario.)

   GARANTÍAS
   - NUNCA responde 500: todo va en try/catch con límites de tiempo
     (4 s por servicio) y una respuesta de emergencia si algo explotara.
   - NO expone claves: solo nombres de variables, estados y mensajes
     de error truncados (160 caracteres).
   - Caché en memoria de 30 s para no golpear las APIs externas en cada
     carga del panel. "Verificar ahora" o ?fresh=1 fuerzan re-verificación.
   - Forma superconjunto: servicios[], sistemas[], checks{}, estadoServicios{}
     + TODOS los campos legados (ok, status, version, db, uptimeSegundos,
     memoriaMB, marcas, cuentasMarcas…). Si tu admin.routes.js tuviera su
     propia ruta /salud, puede quedarse: esta le gana por orden de registro
     y le sirve de respaldo si algún día borras este módulo.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const VERSION_SALUD = 4;          // marcador interno de la forma de respuesta (v1.2: GitHub fuera + token de BD)
const CACHE_POR_DEFECTO_MS = 30000;
const LIMITE_POR_DEFECTO_MS = 4000;
const LIMITE_MONGO_MS = 2500;
const MAX_MENSAJE = 160;

const ESTADOS_DB = ['desconectada', 'conectada', 'conectando', 'desconectando'];

// ── utilidades ──────────────────────────────────────────────────────────
const limpiar = (t) => String(t == null ? '' : t).trim();
const truncar = (t, n) => {
  const s = limpiar(t);
  return s.length > (n || MAX_MENSAJE) ? s.slice(0, (n || MAX_MENSAJE) - 1) + '…' : s;
};

// Corre una promesa con límite de tiempo. Si tarda más, rechaza con un
// error claro (y limpia el temporizador para no dejar colas colgadas).
const conLimite = (promesa, ms) => new Promise((resolve, reject) => {
  let temporizador = null;
  let cerrado = false;
  temporizador = setTimeout(() => {
    if (cerrado) return;
    cerrado = true;
    reject(new Error('Sin respuesta tras ' + ms + ' ms'));
  }, ms);
  Promise.resolve(promesa).then(
    (v) => { if (!cerrado) { cerrado = true; clearTimeout(temporizador); resolve(v); } },
    (e) => { if (!cerrado) { cerrado = true; clearTimeout(temporizador); reject(e); } }
  );
});

const mensajeDe = (e) => truncar((e && (e.message || e.error || e)) || 'error desconocido');

// Convierte segundos de uptime en texto humano para el panel ("⏰ Tiempo activo")
const textoUptime = (seg) => {
  const d = Math.floor(seg / 86400);
  const h = Math.floor((seg % 86400) / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (d > 0) return d + ' d ' + h + ' h ' + m + ' min';
  if (h > 0) return h + ' h ' + m + ' min';
  return m + ' min';
};

// ── detección de configuración (solo NOMBRES de variables, jamás valores) ──
const PRIMERO = (env, lista) => {
  for (const k of lista) { if (env && limpiar(env[k])) return { variable: k, valor: limpiar(env[k]) }; }
  return null;
};

const credencialCloudinary = (env) => {
  if (PRIMERO(env, ['CLOUDINARY_URL'])) return { tipo: 'url', variable: 'CLOUDINARY_URL' };
  const pares = [
    ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
    ['CLOUD_NAME', 'API_KEY', 'API_SECRET'],
    ['CLOUDINARY_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
  ];
  for (const p of pares) if (p.every((k) => env && limpiar(env[k]))) return { tipo: 'trio', claves: p, variable: p[0] };
  return null;
};

// ═════════════════════════ VERIFICADORES ════════════════════════════════
// Cada verificador regresa la ficha del servicio. Jamás lanza: todo error
// se convierte en un ESTADO legible por el panel.

const verificarNode = (env) => {
  const up = process.uptime();
  const h = Math.floor(up / 3600);
  const m = Math.floor((up % 3600) / 60);
  return {
    key: 'node', nombre: 'Node.js', icono: '⚙️', categoria: 'core',
    descripcion: 'Servidor de la aplicación',
    estado: 'operativo', configurado: true, latenciaMs: 0,
    detalle: `Node ${process.version} · ${process.platform} · activo ${h}h ${m}m`,
    version: process.version,
    uptimeSegundos: Math.round(up),
    memoriaMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    plataforma: process.platform,
  };
};

const verificarMongo = async (mongoose) => {
  const base = {
    key: 'mongodb', nombre: 'MongoDB', icono: '🗄️', categoria: 'core',
    descripcion: 'Base de datos (propiedades, usuarios, leads)',
  };
  if (!mongoose || !mongoose.connection) {
    return { ...base, estado: 'error', configurado: false, latenciaMs: null, detalle: 'Mongoose no disponible en el servidor' };
  }
  const rs = mongoose.connection.readyState;
  const dbTxt = ESTADOS_DB[rs] || 'desconocida';
  if (rs === 2) return { ...base, estado: 'con-avisos', configurado: true, latenciaMs: null, detalle: 'Conectando a la base de datos…', readyState: rs };
  if (rs !== 1) return { ...base, estado: 'error', configurado: true, latenciaMs: null, detalle: 'Base de datos ' + dbTxt, readyState: rs };
  try {
    const admin = mongoose.connection.db && mongoose.connection.db.admin ? mongoose.connection.db.admin() : null;
    if (!admin) return { ...base, estado: 'con-avisos', configurado: true, latenciaMs: null, detalle: 'Conectada (sin handle para ping)', readyState: rs };
    const t0 = Date.now();
    await conLimite(admin.command({ ping: 1 }), LIMITE_MONGO_MS);
    return { ...base, estado: 'operativo', configurado: true, latenciaMs: Date.now() - t0, detalle: 'Conectada y respondiendo', readyState: rs };
  } catch (e) {
    return { ...base, estado: 'con-avisos', configurado: true, latenciaMs: null, detalle: 'Conectada, pero el ping falló: ' + mensajeDe(e), readyState: rs };
  }
};

const verificarCloudinary = async (env, requireFn, limiteMs) => {
  const base = {
    key: 'cloudinary', nombre: 'Cloudinary', icono: '☁️', categoria: 'media',
    descripcion: 'Imágenes y videos de las propiedades (CDN)',
  };
  const LIM = limiteMs || LIMITE_POR_DEFECTO_MS;
  const cred = credencialCloudinary(env);
  if (!cred) {
    return { ...base, estado: 'sin-configurar', ok: false, configurado: false, latenciaMs: null,
      detalle: 'Sin credenciales (CLOUDINARY_URL o CLOUDINARY_CLOUD_NAME + API_KEY + API_SECRET)' };
  }
  let lib;
  try {
    const pkg = requireFn('cloudinary');
    lib = (pkg && pkg.v2) ? pkg.v2 : pkg;
  } catch (e) {
    return { ...base, estado: 'con-avisos', configurado: true, latenciaMs: null,
      detalle: 'Paquete cloudinary no instalado en el servidor (npm i cloudinary)' };
  }
  if (!lib || !lib.api || typeof lib.api.ping !== 'function') {
    return { ...base, estado: 'con-avisos', configurado: true, latenciaMs: null, detalle: 'Paquete cloudinary con formato inesperado' };
  }
  try {
    if (cred.tipo === 'trio' && typeof lib.config === 'function') {
      lib.config({ cloud_name: env[cred.claves[0]], api_key: env[cred.claves[1]], api_secret: env[cred.claves[2]] });
    }
    const t0 = Date.now();
    const r = await conLimite(lib.api.ping(), LIM);
    const lat = Date.now() - t0;
    if (r && r.status === 'ok') return { ...base, estado: 'operativo', configurado: true, latenciaMs: lat, detalle: 'API respondió correctamente', variable: cred.variable };
    return { ...base, estado: 'error', configurado: true, latenciaMs: lat, detalle: 'Ping respondió estado inesperado: ' + truncar(r && r.status), variable: cred.variable };
  } catch (e) {
    return { ...base, estado: 'error', configurado: true, latenciaMs: null, detalle: mensajeDe(e), variable: cred.variable };
  }
};

const verificarStripe = async (env, requireFn, limiteMs) => {
  const base = {
    key: 'stripe', nombre: 'Stripe', icono: '💳', categoria: 'pagos',
    descripcion: 'Pagos y planes de agentes fundadores',
  };
  const LIM = limiteMs || LIMITE_POR_DEFECTO_MS;
  const cred = PRIMERO(env, ['STRIPE_SECRET_KEY', 'STRIPE_KEY', 'STRIPE_SK']);
  if (!cred) {
    return { ...base, estado: 'sin-configurar', ok: false, configurado: false, latenciaMs: null,
      detalle: 'Sin STRIPE_SECRET_KEY en el servidor' };
  }
  let Clase;
  try {
    const pkg = requireFn('stripe');
    Clase = (pkg && pkg.default) ? pkg.default : pkg;
  } catch (e) {
    return { ...base, estado: 'con-avisos', configurado: true, latenciaMs: null,
      detalle: 'Paquete stripe no instalado en el servidor (npm i stripe)' };
  }
  if (typeof Clase !== 'function') {
    return { ...base, estado: 'con-avisos', configurado: true, latenciaMs: null, detalle: 'Paquete stripe con formato inesperado' };
  }
  try {
    const stripe = new Clase(cred.valor);
    if (!stripe || !stripe.balance || typeof stripe.balance.retrieve !== 'function') {
      return { ...base, estado: 'con-avisos', configurado: true, latenciaMs: null, detalle: 'SDK de stripe sin balance.retrieve' };
    }
    const t0 = Date.now();
    await conLimite(stripe.balance.retrieve(), LIM);
    return { ...base, estado: 'operativo', configurado: true, latenciaMs: Date.now() - t0, detalle: 'API respondió correctamente', variable: cred.variable };
  } catch (e) {
    return { ...base, estado: 'error', configurado: true, latenciaMs: null, detalle: mensajeDe(e), variable: cred.variable };
  }
};

// ── token de Meta guardado en la base de datos (best-effort, JAMÁS lanza) ──
// Al conectar la cuenta desde el panel ("Conectar con Facebook"), el callback
// del OAuth guarda el token en la BD. Si no hay variable en el .env, escaneamos
// las colecciones probables buscando un campo con pinta de token de Meta.
// Filtros anti-falsos-positivos: el campo debe llamarse algo con "token/acceso"
// (o facebook/meta/instagram) Y el valor debe empezar por EA…/IG… (formato
// real de Meta) con longitud ≥ 30. Los JWT (eyJ…), claves de Stripe (sk_…),
// IDs de Mongo (hex en minúscula) y passwords NO pasan el filtro.
// NUNCA devolvemos el token en la respuesta: solo se usa contra Graph API.
const RE_TOKEN_VALOR_META = /^(EA|IG)[A-Za-z0-9_-]{10,}/;
const RE_NOMBRE_CAMPO_TOKEN = /token|acceso|access/i;
const RE_CLAVE_RED_SOCIAL = /facebook|meta|instagram|^fb|^ig/i;
const RE_COLECCIONES_META = /brand|cuenta|social|meta|facebook|instagram|config|setting|token|integraci|marketing|usuario|user|perfil|crm|auth/i;

const buscarTokenMetaEnDocumento = (doc, nivel) => {
  if (!doc || typeof doc !== 'object' || nivel > 3) return null;
  for (const clave of Object.keys(doc)) {
    const valor = doc[clave];
    if (typeof valor === 'string') {
      if (valor.length >= 30 && RE_TOKEN_VALOR_META.test(valor) &&
          (RE_NOMBRE_CAMPO_TOKEN.test(clave) || RE_CLAVE_RED_SOCIAL.test(clave))) {
        return valor;
      }
    } else if (valor && typeof valor === 'object' && !Buffer.isBuffer(valor)) {
      let hallado = null;
      if (Array.isArray(valor)) {
        for (const item of valor) {
          hallado = buscarTokenMetaEnDocumento(item, nivel + 1);
          if (hallado) return hallado;
        }
      } else {
        hallado = buscarTokenMetaEnDocumento(valor, nivel + 1);
        if (hallado) return hallado;
      }
    }
  }
  return null;
};

// Adapta las 3 formas que puede devolver el driver: CURSOR (MongoDB real:
// listCollections()/find() devuelven cursor síncrono con .toArray()), PROMESA
// (algunos wrappers/fakes) o ARRAY directo. Consumir la promesa con await es
// lo que evita el unhandledRejection cuando el driver rechaza.
const aResultado = async (x) => {
  if (x && typeof x.toArray === 'function') return x.toArray();
  return await x;
};

let escaneoEnVuelo = null; // dedup: si ya hay un escaneo corriendo, todos esperan el MISMO
const tokenMetaDesdeBD = (mongoose) => {
  if (escaneoEnVuelo) return escaneoEnVuelo;
  escaneoEnVuelo = (async () => {
    try {
      const conn = mongoose && mongoose.connection;
      if (!conn || conn.readyState !== 1 || !conn.db || typeof conn.db.listCollections !== 'function') return null;
      const colecciones = await Promise.resolve(conn.db.listCollections()).then((l) => aResultado(l));
      const candidatas = colecciones.map((c) => c && c.name).filter((n) => n && RE_COLECCIONES_META.test(n));
      for (const nombre of candidatas) {
        let docs = null;
        try {
          docs = await Promise.resolve(conn.db.collection(nombre).find({})).then((c) => {
            const paginado = c && typeof c.limit === 'function' ? c.limit(50) : c;
            return aResultado(paginado);
          });
        } catch (e) { continue; }
        for (const doc of docs) {
          const token = buscarTokenMetaEnDocumento(doc, 0);
          if (token) return token;
        }
      }
      return null;
    } catch (e) {
      return null; // el escaneo es opcional: jamás tumba la verificación de salud
    }
  })().finally(() => { escaneoEnVuelo = null; });
  return escaneoEnVuelo;
};

const verificarMeta = async (env, limiteMs, obtenerMetaToken) => {
  const base = {
    key: 'meta', nombre: 'Meta (Facebook)', icono: '📣', categoria: 'redes',
    descripcion: 'Publicación automática en Facebook/Instagram',
  };
  const LIM = limiteMs || LIMITE_POR_DEFECTO_MS;
  if (typeof fetch !== 'function') {
    return { ...base, estado: 'con-avisos', configurado: true, latenciaMs: null, detalle: 'Este Node no soporta fetch (actualiza a Node 18+)' };
  }

  // ── 1) candidatos a token: primero el .env, luego el guardado en la BD ──
  const candidatos = [];
  const cred = PRIMERO(env, ['META_PAGE_ACCESS_TOKEN', 'FACEBOOK_PAGE_ACCESS_TOKEN', 'FB_PAGE_TOKEN', 'FB_ACCESS_TOKEN', 'META_ACCESS_TOKEN', 'INSTAGRAM_ACCESS_TOKEN']);
  if (cred) candidatos.push({ token: cred.valor, fuente: 'variable ' + cred.variable });
  try {
    if (typeof obtenerMetaToken === 'function') {
      const crudo = await conLimite(Promise.resolve().then(() => obtenerMetaToken()), LIMITE_MONGO_MS);
      const t = crudo && String(crudo).trim();
      if (t && t.length >= 20 && (!cred || t !== cred.valor)) {
        candidatos.push({ token: t, fuente: 'token guardado en la base de datos' });
      }
    }
  } catch (e) { /* sin token en la BD (o tardó demasiado) → seguimos con lo que haya */ }

  if (candidatos.length === 0) {
    return { ...base, estado: 'sin-configurar', ok: false, configurado: false, latenciaMs: null,
      detalle: 'Sin token en el servidor (META_PAGE_ACCESS_TOKEN o similar). Pulsa "Conectar con Facebook" o define la variable en el .env' };
  }

  // ── 2) verificar contra Graph API: gana el PRIMER token que responda bien ──
  const ver = limpiar(env.META_GRAPH_VERSION) || 'v21.0';
  let ultimo = null;
  for (const c of candidatos) {
    try {
      const t0 = Date.now();
      const res = await conLimite(fetch('https://graph.facebook.com/' + ver + '/me?fields=id,name&access_token=' + encodeURIComponent(c.token)), LIM);
      const lat = Date.now() - t0;
      let datos = null;
      try { datos = await res.json(); } catch (e) { /* cuerpo vacío */ }
      if (res.ok && datos && datos.id) {
        return { ...base, estado: 'operativo', configurado: true, latenciaMs: lat,
          detalle: 'Página verificada: ' + truncar(datos.name || datos.id, 60) + ' (token de ' + c.fuente + ')',
          variable: cred ? cred.variable : undefined };
      }
      if (res.status === 401 || res.status === 400) {
        const extra = datos && datos.error && datos.error.message ? ': ' + truncar(datos.error.message, 90) : '';
        ultimo = { estado: 'error', latenciaMs: lat, detalle: 'Token inválido o expirado' + extra + ' (token de ' + c.fuente + ')' };
        continue; // token vencido → probamos el siguiente candidato (p.ej. el de la BD)
      }
      return { ...base, estado: 'error', configurado: true, latenciaMs: lat, detalle: 'Graph API respondió ' + res.status, variable: cred ? cred.variable : undefined };
    } catch (e) {
      return { ...base, estado: 'error', configurado: true, latenciaMs: null, detalle: mensajeDe(e), variable: cred ? cred.variable : undefined };
    }
  }
  return { ...base, estado: ultimo.estado, configurado: true, latenciaMs: ultimo.latenciaMs, detalle: ultimo.detalle, variable: cred ? cred.variable : undefined };
};

// ═════════════════════════ ARMADO DE LA RESPUESTA ═══════════════════════
// Cada ficha recibe ALIAS en varios estilos para que cualquier panel la
// pinte: ok/online (booleanos), estado/status (texto), detalle/mensaje,
// latenciaMs/responseTime, key/id, nombre/servicio.

const armarFicha = (f) => {
  const ok = f.estado === 'operativo' || f.estado === 'con-avisos';
  return {
    ...f,
    id: f.key,
    servicio: f.nombre,
    ok,
    online: ok,
    status: f.estado,
    mensaje: f.detalle,
    latencia: f.latenciaMs != null ? f.latenciaMs : null,   // ← el panel lee s.latencia
    responseTime: f.latenciaMs != null ? f.latenciaMs : null,
  };
};

const calcularSalud = async (opciones = {}) => {
  const env = opciones.env || process.env;
  const requireFn = opciones.requireFn || require;
  const mongoose = opciones.mongoose != null ? opciones.mongoose : (function () { try { return require('mongoose'); } catch (e) { return null; } }());
  const version = opciones.version || '1.0.0';
  const limiteMs = opciones.limiteMs || LIMITE_POR_DEFECTO_MS;

  const t0 = Date.now();
  const errores = [];
  const seguro = async (etiqueta, fn) => {
    try { return await fn(); } catch (e) { errores.push(etiqueta + ': ' + mensajeDe(e)); return null; }
  };

  // ——— servicios core (locales, instantáneos) ———
  const nodo = await seguro('node', async () => verificarNode(env)) ||
    { key: 'node', nombre: 'Node.js', icono: '⚙️', categoria: 'core', descripcion: 'Servidor', estado: 'error', configurado: true, latenciaMs: null, detalle: errores[errores.length - 1] || 'fallo inesperado' };
  const mongo = await seguro('mongodb', () => verificarMongo(mongoose)) ||
    { key: 'mongodb', nombre: 'MongoDB', icono: '🗄️', categoria: 'core', descripcion: 'Base de datos', estado: 'error', configurado: true, latenciaMs: null, detalle: errores[errores.length - 1] || 'fallo inesperado' };

  // ——— servicios externos (con red, con límite de tiempo) ———
  const cloudinary = await seguro('cloudinary', () => verificarCloudinary(env, requireFn, limiteMs)) ||
    { key: 'cloudinary', nombre: 'Cloudinary', icono: '☁️', categoria: 'media', descripcion: 'Imágenes', estado: 'error', configurado: true, latenciaMs: null, detalle: errores[errores.length - 1] || 'fallo inesperado' };
  const stripe = await seguro('stripe', () => verificarStripe(env, requireFn, limiteMs)) ||
    { key: 'stripe', nombre: 'Stripe', icono: '💳', categoria: 'pagos', descripcion: 'Pagos', estado: 'error', configurado: true, latenciaMs: null, detalle: errores[errores.length - 1] || 'fallo inesperado' };
  // Token de Meta: por defecto se busca también en la BD (lo guarda el botón
  // "Conectar con Facebook" del panel). Pasar obtenerMetaToken: null lo apaga.
  const obtenerMetaToken = opciones.obtenerMetaToken !== undefined
    ? opciones.obtenerMetaToken
    : () => tokenMetaDesdeBD(mongoose);
  const meta = await seguro('meta', () => verificarMeta(env, limiteMs, obtenerMetaToken)) ||
    { key: 'meta', nombre: 'Meta (Facebook)', icono: '📣', categoria: 'redes', descripcion: 'Redes sociales', estado: 'error', configurado: true, latenciaMs: null, detalle: errores[errores.length - 1] || 'fallo inesperado' };

  const fichas = [nodo, mongo, cloudinary, stripe, meta].map(armarFicha);

  // ——— conteos informativos legados (best-effort, jamás tumban la ruta) ———
  let extra = {};
  try {
    if (typeof opciones.obtenerExtra === 'function') {
      extra = (await opciones.obtenerExtra({ mongoose, env })) || {};
    } else if (mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      const Brand = mongoose.models.Brand;
      const BrandAccount = mongoose.models.BrandAccount;
      if (Brand) {
        extra.marcas = {
          total: await Brand.countDocuments({ estado: { $ne: 'eliminado' } }),
          publicadas: await Brand.countDocuments({ estado: 'publicado' }),
        };
      }
      if (BrandAccount) extra.cuentasMarcas = await BrandAccount.estimatedDocumentCount();
    }
  } catch (e) {
    extra.advertencia = 'conteos omitidos: ' + mensajeDe(e);
  }

  // ——— resumen y estado global ———
  const porEstado = (e) => fichas.filter((f) => f.estado === e).length;
  const resumen = {
    total: fichas.length,
    operativos: porEstado('operativo'),
    conAvisos: porEstado('con-avisos'),
    errores: porEstado('error'),
    sinConfigurar: porEstado('sin-configurar'),
  };
  const mongoError = mongo.estado === 'error';
  let estadoGlobal = 'operativo';
  if (mongoError || resumen.errores >= 2) estadoGlobal = 'critico';
  else if (resumen.errores === 1) estadoGlobal = 'degradado';

  let rs = mongo.readyState;
  if (rs == null) {
    try { rs = mongoose && mongoose.connection ? mongoose.connection.readyState : -1; }
    catch (e) { rs = -1; }
  }
  const checks = {};
  const estadoServicios = {};
  for (const f of fichas) { checks[f.key] = f; estadoServicios[f.key] = f.estado; }
  // alias clásicos por si el panel busca "db"
  checks.db = mongo; estadoServicios.db = mongo.estado;

  return {
    // ═══ campos legados v5 (intactos — nada que ya funcione se rompe) ═══
    ok: true,
    status: estadoGlobal === 'operativo' ? 'ok' : estadoGlobal,
    proyecto: 'Vive Mas Inmobiliaria',
    version,
    entorno: opciones.entorno || process.env.NODE_ENV || 'development',
    db: ESTADOS_DB[rs] || 'desconocida',
    uptimeSegundos: Math.round(process.uptime()),
    uptime: textoUptime(process.uptime()),
    memoriaMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    timestamp: new Date().toISOString(),

    // ═══ v2: lo que el panel de Salud necesita para pintar las tarjetas ═══
    versionSalud: VERSION_SALUD,
    estado: estadoGlobal,
    estadoGeneral: estadoGlobal,
    resumen,
    totalServicios: fichas.length,
    dbInfo: { estado: ESTADOS_DB[rs] || 'desconocida', readyState: rs, latenciaMs: mongo.latenciaMs != null ? mongo.latenciaMs : null },
    servicios: fichas,
    sistemas: fichas,
    checks,
    estadoServicios,
    latenciaTotalMs: Date.now() - t0,
    verificadoEn: new Date().toISOString(),
    ...extra,
  };
};

// ═════════════════════════ REGISTRO DE LA RUTA ══════════════════════════
const registrarSaludAdmin = (app, opciones = {}) => {
  const cacheMs = opciones.cacheMs != null ? opciones.cacheMs : CACHE_POR_DEFECTO_MS;
  const limiteMs = opciones.limiteMs || LIMITE_POR_DEFECTO_MS;
  const logger = opciones.logger || console;
  const cache = { datos: null, expira: 0 };
  let enVuelo = null;

  const respuestaEmergencia = (e) => ({
    ok: true, status: 'ok', proyecto: 'Vive Mas Inmobiliaria',
    version: opciones.version || '1.0.0',
    entorno: process.env.NODE_ENV || 'development',
    db: 'desconocida',
    uptimeSegundos: Math.round(process.uptime()),
    uptime: textoUptime(process.uptime()),
    memoriaMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    timestamp: new Date().toISOString(),
    versionSalud: VERSION_SALUD,
    estado: 'desconocido', estadoGeneral: 'desconocido',
    resumen: { total: 0, operativos: 0, conAvisos: 0, errores: 0, sinConfigurar: 0 },
    totalServicios: 0,
    servicios: [], sistemas: [], checks: {}, estadoServicios: {},
    latenciaTotalMs: null,
    verificadoEn: new Date().toISOString(),
    advertencia: 'verificación falló: ' + mensajeDe(e),
  });

  app.get('/api/admin/salud', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const q = req.query || {};
    const fresco = q.fresh === '1' || q.verificar === '1' || q.nocache === '1' || q.actualizar === '1' ||
      (req.headers && req.headers['cache-control'] === 'no-cache');

    // 1) caché vigente y no piden frescor → respuesta inmediata
    if (!fresco && cache.datos && Date.now() < cache.expira) {
      return res.json({ ...cache.datos, cache: true });
    }
    // 2) hay una verificación en vuelo → todos esperan la MISMA (sin tormenta)
    if (enVuelo) {
      try { return res.json(await enVuelo); }
      catch (e) { return res.json(respuestaEmergencia(e)); }
    }
    // 3) verificación nueva (el motor JAMÁS lanza, pero por si acaso…)
    enVuelo = calcularSalud({ ...opciones, limiteMs })
      .then((datos) => {
        cache.datos = datos;
        cache.expira = Date.now() + cacheMs;
        const r = datos.resumen || {};
        logger.log && logger.log('[salud] verificación completa en ' + datos.latenciaTotalMs + ' ms — ' +
          datos.estado.toUpperCase() + ' (' + r.operativos + ' operativos, ' + r.conAvisos + ' avisos, ' +
          r.errores + ' errores, ' + r.sinConfigurar + ' sin configurar)');
        return datos;
      })
      .finally(() => { enVuelo = null; });
    try { return res.json(await enVuelo); }
    catch (e) { return res.json(respuestaEmergencia(e)); }
  });

  return { ruta: '/api/admin/salud', versionSalud: VERSION_SALUD };
};

module.exports = { registrarSaludAdmin, calcularSalud, VERSION_SALUD };
