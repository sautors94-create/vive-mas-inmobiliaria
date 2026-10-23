require('dotenv').config();
require('express-async-errors'); // convierte throws en rutas async en errores que llegan al manejador global
const connectDB = require('./config/database');
connectDB();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const path = require('path');
const mongoose = require('mongoose');

const NODE_ENV = process.env.NODE_ENV || 'development';
const EN_PRODUCCION = NODE_ENV === 'production';

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const propertyRoutes = require('./routes/property.routes');
const favoriteRoutes = require('./routes/favorite.routes');
const messageRoutes = require('./routes/message.routes');
const siteconfigRoutes = require('./routes/siteconfig.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const servicesRoutes = require('./routes/services.routes');
const reportRoutes = require('./routes/report.routes');
const pagoRoutes = require('./routes/pagos');
const { webhookStripe } = require('./routes/pagos');
const { iniciarMarketingAutomation } = require('../services/marketingAutomation');
const metaOAuthRoutes = require('../services/marketingAutomation/auth/metaOAuth.routes');

// NUEVO: CRM DE LEADS
const leadRoutes = require('./routes/lead.routes');

// ==========================================
// MÓDULOS NUEVOS: AGENTES FUNDADORES & SEO
// ==========================================
const seoController = require('./nuevo-modulo/controllers/seoController');
const founderController = require('./nuevo-modulo/controllers/founderController');
const foundersRoutes = require('./nuevo-modulo/routes/founders');
const propertiesRoutes = require('./nuevo-modulo/routes/properties');

// ==========================================
// MÓDULO: MARCAS Y PROFESIONALES ALIADOS (Directorio)
// ==========================================
const authMiddleware = require('./middleware/auth.middleware');
const requireRole = require('./middleware/role.middleware');
const { marcasRouter, adminMarcasRouter } = require('./marcas/routes');
const { sembrarCatalogos } = require('./marcas/utils/seed');

const app = express();

// Hostinger sirve la app detrás de un proxy (LiteSpeed). Sin esto, Express
// ignora el header X-Forwarded-For y express-rate-limit no puede identificar
// la IP real de cada usuario (los limitadores de abajo dependen de esto).
// "1" = confiar solo en el primer proxy (el de Hostinger), no en cualquiera.
app.set('trust proxy', 1);

// CRÍTICO: el webhook de Stripe debe registrarse ANTES de express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookStripe);

// ==========================================
// RATE LIMITERS
// ==========================================

// 1. Limitador para Login y Registro (Evita fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15,
  standardHeaders: true, // cabeceras RateLimit-* estándar
  legacyHeaders: false,  // sin X-RateLimit-* (menos ruido/fugas de info)
  message: { error: 'Demasiados intentos de registro/login. Intenta de nuevo en 15 minutos.' }
});

// 2. Limitador para enviar mensajes/contactos (Evita spam)
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has enviado muchos mensajes. Intenta de nuevo en 15 minutos.' }
});

// 3. Limitador para creación de propiedades (Evita spam de publicaciones)
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has publicado muchas propiedades. Intenta de nuevo en una hora.' },
  // Solo cuentan las operaciones de escritura: el catálogo público (GET) no consume cupo
  skip: (req) => !['POST', 'PUT', 'PATCH'].includes(req.method)
});

// NOTA: El chatbot (Max/Vivi) tiene SU PROPIO rate limiter adentro
// en chatBotController.js, por lo que NO necesita uno global aquí.

// ==========================================
// SEGURIDAD Y HEADERS
// ==========================================

// CSP aplicada (compatible con el frontend actual: mantiene 'unsafe-inline'
// temporalmente porque las páginas públicas usan scripts/estilos inline y
// atributos onclick; quitarlo sin migrar rompería el sitio).
// Endurecimientos seguros añadidos: object-src 'none', base-uri 'self',
// frame-ancestors 'self' (anti-clickjacking) y upgrade-insecure-requests
// en producción. Sin riesgo de rompimiento.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "unpkg.com", "cdnjs.cloudflare.com", "cdn.sheetjs.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com"],
      fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "res.cloudinary.com", "*.cloudinary.com", "*.tile.openstreetmap.org", "*.basemaps.cartocdn.com", "nominatim.openstreetmap.org", "unpkg.com", "api.qrserver.com", "images.unsplash.com"],
      connectSrc: ["'self'", "nominatim.openstreetmap.org", "ip-api.com", "*.openstreetmap.org", "unpkg.com", "api.zippopotam.us", "api.groq.com", "generativelanguage.googleapis.com"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
      ...(EN_PRODUCCION ? { upgradeInsecureRequests: [] } : {})
    }
  }
}));

// POLÍTICA ESTRICTA EN MODO REPORTE — APAGADA POR DEFECTO desde v5.1.
// Historia: se activó como guía de migración a una CSP estricta, pero el
// frontend aún usa scripts/estilos inline de forma masiva (chatbot.js,
// main.js, social-widget.js, api.js), así que la consola del navegador se
// llenaba de cientos de reportes que NO bloquean nada y tapan los errores
// reales (500/404/CORS). Decisión: dejarla opt-in. Si más adelante se
// migran los inline a archivos y se quiere retomar la telemetría, basta
// definir CSP_REPORTE=1 en el .env de Hostinger — sin tocar código.
const CSP_ESTRICTA_REPORTE = [
  "default-src 'self'",
  "script-src 'self' fonts.googleapis.com unpkg.com cdnjs.cloudflare.com cdn.sheetjs.com",
  "style-src 'self' fonts.googleapis.com fonts.gstatic.com unpkg.com",
  "font-src 'self' fonts.gstatic.com",
  "img-src 'self' data: blob: res.cloudinary.com *.cloudinary.com *.tile.openstreetmap.org *.basemaps.cartocdn.com nominatim.openstreetmap.org unpkg.com api.qrserver.com images.unsplash.com",
  "connect-src 'self' nominatim.openstreetmap.org ip-api.com *.openstreetmap.org unpkg.com api.zippopotam.us api.groq.com generativelanguage.googleapis.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'"
].join('; ');

if (process.env.CSP_REPORTE === '1') {
  console.log('[CSP] Report-Only ACTIVADO vía CSP_REPORTE=1 (solo registra, no bloquea)');
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy-Report-Only', CSP_ESTRICTA_REPORTE);
    next();
  });
}

// ==========================================
// CORS CON WHITELIST (antes quedaba abierto a cualquier origen)
// - CLIENT_URL admite VARIOS orígenes separados por coma.
// - Sin CLIENT_URL en producción: solo el mismo origen sirve (el propio
//   backend hospeda el frontend), nunca '*'.
// - Peticiones sin cabecera Origin (curl, health checks, server-to-server):
//   permitidas siempre.
// - Origen no autorizado: se responde SIN cabeceras CORS (el navegador lo
//   bloquea) y se registra en el log.
// ==========================================
const origenesPermitidos = (process.env.CLIENT_URL || '')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// Dominio propio: el 1º de CLIENT_URL, o DOMINIO_PUBLICO, o el dominio del
// proyecto. Con la normalización www↔dominio-desnudo de abajo basta UNA
// entrada para cubrir ambas variantes.
const DOMINIO_PROPIO = (process.env.DOMINIO_PUBLICO
  || (() => { try { return new URL(origenesPermitidos[0] || 'https://somosvivemas.com').hostname; } catch { return 'somosvivemas.com'; } })())
  .replace(/^www\./, '')
  .toLowerCase();

if (origenesPermitidos.length === 0) {
  console.warn('[CORS] CLIENT_URL no definida: CORS limitado a mismo origen + dominio propio (' + DOMINIO_PROPIO + '). Define CLIENT_URL en .env (admite lista separada por comas).');
}

if (!EN_PRODUCCION) {
  // Puertos comunes de desarrollo local (live-server, VS Code, etc.)
  origenesPermitidos.push(
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:5500', 'http://127.0.0.1:5500',
    'http://localhost:5501', 'http://127.0.0.1:5501'
  );
}

// 'www.somosvivemas.com:443' → 'somosvivemas.com'
const hostDesnudo = (h) => String(h || '').toLowerCase().trim().replace(/:\d+$/, '').replace(/^www\./, '');

const URLSegura = (s) => { try { return new URL(s); } catch { return null; } };

/**
 * ¿El origen de la petición es de CONFIANZA? (v5 — anti "Origen bloqueado")
 * 1) MISMO ORIGEN: el hostname del Origin coincide con el Host del servidor.
 *    El backend hospeda su propio frontend → sus llamadas NUNCA se bloquean,
 *    sea www o dominio desnudo, sin depender del .env.
 * 2) CLIENT_URL: comparación normalizada (www ↔ dominio desnudo, sin puerto).
 * 3) DOMINIO PROPIO: se auto-permiten las variantes del dominio del proyecto
 *    (somosvivemas.com / www.somosvivemas.com) como cinturón de seguridad.
 * 4) Desarrollo local: localhost/127.0.0.1 (solo fuera de producción).
 */
const origenDeConfianza = (origin, req) => {
  if (!origin) return true; // curl / misma página / health checks
  const o = URLSegura(origin);
  if (!o) return false;
  const hostOrigen = hostDesnudo(o.hostname);
  if (hostOrigen === hostDesnudo(req && req.headers && req.headers.host)) return true;
  if (origenesPermitidos.some((p) => {
    const q = URLSegura(/^[a-z][a-z0-9+.-]*:\/\//i.test(p) ? p : `https://${p}`);
    return q ? hostDesnudo(q.hostname) === hostOrigen : hostDesnudo(p) === hostOrigen;
  })) return true;
  if (hostOrigen === DOMINIO_PROPIO || hostOrigen === `www.${DOMINIO_PROPIO}`) return true;
  if (!EN_PRODUCCION && /^(localhost|127\.0\.0\.1)$/.test(hostOrigen)) return true;
  return false;
};

// Configuración DINÁMICA (recibe req) para poder comparar contra el Host del
// propio servidor: esto es lo que mata el "[CORS] Origen bloqueado:
// https://somosvivemas.com" aunque el .env esté incompleto.
app.use(cors((req, callback) => {
  const origin = req.headers.origin;
  if (origenDeConfianza(origin, req)) {
    return callback(null, { origin: true, credentials: true });
  }
  console.warn(`[CORS] Origen bloqueado: ${origin || '(sin origen)'} — host pedido: ${req.headers.host || '?'}. Añádelo a CLIENT_URL en .env si es legítimo.`);
  return callback(null, { origin: false }); // sin cabeceras CORS -> el navegador lo bloquea
}));

app.use(morgan(EN_PRODUCCION ? 'combined' : 'dev'));

// Body parsers (DESPUÉS del webhook raw)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Ruta ABSOLUTA (antes 'public' dependía del directorio desde donde se
// arrancara el proceso: si PM2/Hostinger arrancaba desde otra carpeta,
// CSS/JS/HTML dejaban de servirse).
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(mongoSanitize());
app.use(xss());

// ==========================================
// CONTADOR DE COMPARTIDAS (backend-compartidas.js — módulo autocontenido)
// Registrado AQUÍ (antes de los rate limiters y de los montajes
// /api/propiedades y /api/admin) por 3 razones:
//  1. POST /api/propiedades/:id/compartir NO debe consumir el cupo de
//     publicaciones (postLimiter): el módulo trae SU PROPIO límite
//     anti-spam de 30 registros/hora por IP.
//  2. GET /api/admin/propiedades/compartidas debe responder SIEMPRE,
//     aunque admin.routes tenga rutas genéricas tipo /propiedades/:id
//     (mismo criterio que /api/admin/salud más abajo).
//  3. El conteo vive en el campo `compartidas` del documento de la
//     propiedad ($inc): sin migración ni colección nueva; el KPI del
//     dashboard y el badge de propiedad.html lo leen solos.
// Tolerante: si el archivo no está en src/, el servidor arranca igual
// y el panel muestra "—" hasta que se suba.
// ==========================================
try {
  const { registrarRutasCompartidas } = require('./backend-compartidas');
  registrarRutasCompartidas(app, { authAdmin: [authMiddleware, requireRole('admin')] });
} catch (e) {
  console.warn('[compartidas] backend-compartidas.js no encontrado en src/ — rutas de compartidas desactivadas:', e.message);
}

// APLICAR RATE LIMITING SOLO DONDE ES NECESARIO
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/registro', authLimiter);
app.use('/api/mensajes', contactLimiter);
app.use('/api/propiedades', postLimiter);

// Health check (con estado de BD para monitoreo en Hostinger)
const ESTADOS_DB = ['desconectada', 'conectada', 'conectando', 'desconectando'];
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    proyecto: 'Vive Mas Inmobiliaria',
    version: '1.0.0',
    entorno: NODE_ENV,
    db: ESTADOS_DB[mongoose.connection.readyState] || 'desconocida'
  });
});

// Rutas principales
app.use('/api/auth/meta', metaOAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/marcas', marcasRouter);

// ==========================================
// SALUD DEL PANEL ADMIN (v6) — MOTOR COMPLETO en src/salud-admin.js
// ──────────────────────────────────────────
// Por qué el panel dejaba de mostrar las tarjetas (Cloudinary, Meta, Node,
// GitHub, Stripe): la ruta básica de v5 está registrada ANTES del montaje
// /api/admin (más abajo) y Express responde con la PRIMERA coincidencia →
// tapaba el endpoint real de admin.routes.js. El panel recibía 200 con una
// forma que no entendía → "Salud del sistema" vacía.
//
// Solución v6: la ruta AHORA ES el motor completo (módulo autocontenido
// salud-admin.js): verifica de verdad Node, MongoDB, Cloudinary, Stripe,
// Meta (Graph API) y GitHub, con límites de tiempo (4 s por servicio),
// caché de 30 s y una forma SUPERCONJUNTO (servicios[], sistemas[],
// checks{}, estadoServicios{} + TODOS los campos legados) para que el
// panel la pinte sin cambios. Nunca responde 500 y jamás expone claves.
// Si src/salud-admin.js no está, entra la ruta básica v5 de respaldo
// (registrada aquí mismo SOLO en ese caso).
// ==========================================
let saludRegistrada = false;
try {
  const { registrarSaludAdmin } = require('./salud-admin');
  registrarSaludAdmin(app, {
    mongoose,
    env: process.env,
    version: '1.0.0',
    entorno: NODE_ENV,
    logger: console,
  });
  saludRegistrada = true;
} catch (e) {
  console.warn('[salud] salud-admin.js no encontrado en src/ — Salud mostrará solo datos básicos:', e.message);
}
if (!saludRegistrada) {
  // RESPALDO v5 (solo se usa si falta src/salud-admin.js)
  app.get('/api/admin/salud', async (req, res) => {
    const estado = {
      ok: true,
      status: 'ok',
      proyecto: 'Vive Mas Inmobiliaria',
      version: '1.0.0',
      entorno: NODE_ENV,
      db: ESTADOS_DB[mongoose.connection.readyState] || 'desconocida',
      uptimeSegundos: Math.round(process.uptime()),
      memoriaMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: new Date().toISOString(),
    };
    try {
      // Conteos informativos (opcionales: si un modelo no existe, no tumba la ruta)
      const Brand = mongoose.models.Brand;
      const BrandAccount = mongoose.models.BrandAccount;
      if (Brand && mongoose.connection.readyState === 1) {
        estado.marcas = {
          total: await Brand.countDocuments({ estado: { $ne: 'eliminado' } }),
          publicadas: await Brand.countDocuments({ estado: 'publicado' }),
        };
      }
      if (BrandAccount && mongoose.connection.readyState === 1) {
        estado.cuentasMarcas = await BrandAccount.estimatedDocumentCount();
      }
    } catch (e) {
      // Los conteos son best-effort: la salud NUNCA debe 500 por ellos.
      estado.advertencia = `conteos omitidos: ${e && e.message}`;
    }
    return res.json(estado);
  });
}

// MÓDULO DE HERRAMIENTAS PÚBLICAS (calculadora de renta, etc.)
app.use('/api/herramientas', require('./routes/herramientas.routes'));

app.use('/api/admin/marcas', authMiddleware, requireRole('admin'), adminMarcasRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/propiedades', propertyRoutes);
app.use('/api/favoritos', favoriteRoutes);
app.use('/api/mensajes', messageRoutes);
app.use('/api/site', siteconfigRoutes);
app.use('/api/chat', chatbotRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/reportes', reportRoutes);
app.use('/api', pagoRoutes);

// NUEVO: RUTAS DEL CRM DE LEADS
app.use('/api/leads', leadRoutes);

// ==========================================
// DIRECTORIO DE INMOBILIARIAS/AGENTES VERIFICADOS (FILTRO ESTRICTO)
// ==========================================
const User = require('./models/User');
const Property = require('./models/Property');

app.get('/api/directorio', async (req, res) => {
  try {
    // FILTRO ESTRICTO: Solo usuarios activos que tengan kyc o kyb en 'aprobado'
    const usuarios = await User.find({
      status: 'activo',
      $or: [
        { 'kyc.status': 'aprobado' },
        { 'kyb.status': 'aprobado' }
      ]
    }).select('nombre email telefono avatar plan role kyc kyb');

    const directorio = await Promise.all(usuarios.map(async (u) => {
      const numPropiedades = await Property.countDocuments({
        propietario: u._id,
        status: 'aprobada'
      });

      // Determinar si es empresa (KYB) o persona (KYC)
      const esEmpresa = u.kyb && u.kyb.status === 'aprobado';

      return {
        id: u._id,
        name: u.nombre,
        type: esEmpresa ? 'inmobiliaria' : 'agente',
        location: esEmpresa ? (u.kyb?.estado || 'México') : (u.kyc?.estado || 'México'),
        city: esEmpresa ? (u.kyb?.ciudad || 'Mexico') : (u.kyc?.ciudad || 'Mexico'),
        properties: numPropiedades,
        verified: true,
        phone: u.telefono || '',
        email: u.email,
        image: u.avatar || '',
        description: `${esEmpresa ? 'Inmobiliaria' : 'Asesor'} verificado en Vive Más Inmobiliaria. ${u.nombre} cuenta con ${numPropiedades} propiedades activas.`,
        tags: ['Verificado', esEmpresa ? 'KYB' : 'KYC', 'Confiado']
      };
    }));

    res.json({ ok: true, directorio });
  } catch (error) {
    console.error('Error en /api/directorio:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// LISTA DE ESPERA PREMIUM (Pública, sin auth)
// ==========================================
const Waitlist = require('./models/Waitlist');

app.post('/api/waitlist/premium', async (req, res) => {
  try {
    // Normalización y validación estricta (antes solo pedía un '@')
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    await Waitlist.create({ email });
    res.json({ ok: true });
  } catch (error) {
    // Si el error es de duplicado, ya estaba registrado
    if (error.code === 11000) {
      return res.json({ ok: true });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Categorías y ciudades iniciales del directorio de marcas (solo inserta lo que falta).
// Corrige la carrera: si la conexión ya estaba abierta cuando se registró el
// listener 'open', el seed nunca se ejecutaba.
const sembrar = () => Promise.resolve(sembrarCatalogos())
  .catch((e) => console.error('Error sembrando catálogos:', e.message));

if (mongoose.connection.readyState === 1) {
  sembrar();
} else {
  mongoose.connection.once('open', sembrar);
}

// Inicializar módulo de Marketing Automation
iniciarMarketingAutomation();

// ==========================================
// RUTAS DEL MÓDULO AGENTES FUNDADORES
// ==========================================
app.use('/api/fundadores', foundersRoutes);
app.use(propertiesRoutes); // Maneja /p/:slug (página pública compartible)

// Páginas del landing de Agentes Fundadores (registro público, sin login)
app.get('/agentes-fundadores', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/embajador-invitacion.html'));
});
app.get('/admin/agentes-fundadores', (req, res) => {
  res.sendFile(path.join(__dirname, 'nuevo-modulo/views/dashboard.html'));
});

// Perfil público del agente (SSR, con og: para compartir bien el link)
app.get('/agente/:referralCode', founderController.getPublicProfile);

// Panel personal del agente (ve su rango, referidos, enlaces)
app.get('/agentes-fundadores/panel/:referralCode', (req, res) => {
  res.sendFile(path.join(__dirname, 'nuevo-modulo/views/panel.html'));
});
app.get('/agentes-fundadores/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'nuevo-modulo/views/panel.html'));
});

// ==========================================
// SEO MASIVO: Rutas dinámicas (Ej: /renta/departamentos/cdmx/polanco)
// ==========================================
app.get('/:operacion(renta|venta)/:tipo(departamentos|casas|terrenos|locales)/:estado?/:ciudad?', seoController.showDynamicSEOPage);

// ==========================================
// RUTAS PÚBLICAS DE MARCAS Y PROFESIONALES
// ==========================================
app.get('/marcas/acceso', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/marca-acceso.html'));
});

app.get('/marcas/panel', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/marca-panel.html'));
});

app.get('/marca/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/marca.html'));
});

// 404 (único; debe quedar debajo de todas las rutas)
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ==========================================
// CRON: Bajar a gratuito cuando vence el plan
// ==========================================
const { purgarMensajesAntiguos } = require('./controllers/message.controller');

const ejecutarPurgaMensajes = async () => {
  try {
    const deletedCount = await purgarMensajesAntiguos();
    if (deletedCount > 0) {
      console.log(`Purga de mensajes: ${deletedCount} mensaje(s) de más de 6 meses eliminados.`);
    }
  } catch (error) {
    console.error('Error en purga de mensajes antiguos:', error.message);
  }
};

// Ejecutar una vez al arrancar
setTimeout(ejecutarPurgaMensajes, 15000);

// Luego una vez al día
setInterval(ejecutarPurgaMensajes, 24 * 60 * 60 * 1000);

const bajarPlanesVencidos = async () => {
  try {
    const ahora = new Date();
    const usuariosVencidos = await User.find({
      plan: { $ne: 'gratuito' },
      planFechaFin: { $lt: ahora },
      $or: [
        { planCancelado: true },
        { planCancelado: { $exists: false } },
        { planCancelado: null }
      ]
    });

    if (usuariosVencidos.length === 0) return;

    for (const u of usuariosVencidos) {
      console.log(`Plan vencido: ${u.email} (${u.plan}) → gratuito`);
      u.plan = 'gratuito';
      u.planFechaFin = null;
      u.planCancelado = false;
      u.stripeSubscriptionId = null;
      u.cargoRecurrenteAutorizado = false;
      await u.save();

      await Property.updateMany(
        { propietario: u._id },
        { $set: { planPeso: 0 } }
      );
    }

    console.log(`${usuariosVencidos.length} usuario(s) bajados a gratuito por vencimiento.`);
  } catch (error) {
    console.error('Error en cron de planes vencidos:', error.message);
  }
};

// ==========================================
// CRON NATIVO: ENVÍO DE CORREOS SEMANALES (Lunes 9:00 AM)
// ==========================================
const FounderModel = require('./nuevo-modulo/models/Founder');
// Acceso TOLERANTE al módulo de correo: si tu email.js no exporta
// enviarResumenEmbajador, el cron semanal se omite con un aviso en lugar
// de fallar (TypeError) cada semana.
const _moduloEmailApp = require('./utils/email');
const enviarResumenEmbajador = typeof _moduloEmailApp.enviarResumenEmbajador === 'function'
  ? _moduloEmailApp.enviarResumenEmbajador
  : async () => { console.warn('[email] enviarResumenEmbajador no existe en utils/email: resumen omitido'); return { ok: false, omitido: true }; };

let lastEmailWeekSent = '';

const getNextRank = (score) => {
  if (score >= 700) return { next: null, needed: 0 };
  if (score >= 350) return { next: 'Élite', needed: 700 - score };
  if (score >= 150) return { next: 'Diamante', needed: 350 - score };
  if (score >= 50) return { next: 'Oro', needed: 150 - score };
  return { next: 'Plata', needed: 50 - score };
};

// Función para obtener el número de semana del año (para no enviarlo dos veces)
const getWeekNumber = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + "-" + weekNo;
}

// Revisa cada hora si es lunes a las 9 AM (o 21 hrs por si hay desfase de horario del servidor)
setInterval(async () => {
  const now = new Date();
  const day = now.getDay(); // 0=Domingo, 1=Lunes
  const hour = now.getHours();
  const weekKey = getWeekNumber(now);

  // Si es Lunes y son las 9 AM (o 9 PM) y no hemos enviado el correo esta semana
  if ((day === 1 && hour === 9) || (day === 1 && hour === 21)) {
    if (lastEmailWeekSent !== weekKey) {
      lastEmailWeekSent = weekKey;
      console.log('Iniciando envío de correos semanales de embajadores...');
      try {
        const founders = await FounderModel.find({ userId: { $ne: null } }).populate('userId', 'nombre email notificaciones');

        let enviados = 0;
        for (const founder of founders) {
          if (founder.userId && founder.userId.notificaciones && founder.userId.notificaciones.novedades !== false) {
            const rankInfo = getNextRank(founder.score || 0);

            await enviarResumenEmbajador(
              founder.userId.email,
              founder.userId.nombre,
              founder.rankTitle,
              founder.score || 0,
              rankInfo.next,
              rankInfo.needed
            );
            enviados++;
          }

          // Aprovechamos el ciclo para reiniciar el weekScore de todos
          founder.weekScore = 0;
          await founder.save();
        }
        console.log(`Correos semanales enviados: ${enviados}. Scores semanales reiniciados.`);
      } catch (err) {
        console.error('Error en cron semanal de embajadores:', err);
      }
    }
  }
}, 60 * 60 * 1000); // Se ejecuta cada 1 hora (3600000 ms)

// ==========================================
// MANEJADOR DE ERRORES GLOBAL — debe ir al final, después de todas las rutas.
// ==========================================
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err); // si ya se respondió, delegar al manejador por defecto
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo es demasiado grande.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Solicitud mal formada.' });
  }
  console.error('Error no controlado:', err);
  res.status(err?.status || err?.statusCode || 500).json({
    error: err?.message || 'Ocurrió un error inesperado. Intenta de nuevo.'
  });
});

module.exports = app;
