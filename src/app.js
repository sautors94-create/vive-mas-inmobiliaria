require('dotenv').config();
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

// ==========================================
// MÓDULOS NUEVOS: AGENTES FUNDADORES & SEO
// ==========================================
const seoController = require('./nuevo-modulo/controllers/seoController');
const foundersRoutes = require('./nuevo-modulo/routes/founders');
const propertiesRoutes = require('./nuevo-modulo/routes/properties');

const app = express();

// Hostinger sirve la app detrás de un proxy (LiteSpeed). Sin esto, Express
// ignora el header X-Forwarded-For y express-rate-limit no puede identificar
// la IP real de cada usuario (los limitadores de abajo dependen de esto).
// "1" = confiar solo en el primer proxy (el de Hostinger), no en cualquiera.
app.set('trust proxy', 1);

// ⚠️ CRÍTICO: el webhook de Stripe debe registrarse ANTES de express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookStripe);

// ==========================================
// ✅ RATE LIMITERS CORREGIDOS
// ==========================================

// 1. Limitador para Login y Registro (Evita fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // ✅ Subí a 15 para evitar bloqueos mientras pruebas
  message: { error: 'Demasiados intentos de registro/login. Intenta de nuevo en 15 minutos.' }
});

// 2. Limitador para enviar mensajes/contactos (Evita spam)
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Has enviado muchos mensajes. Intenta de nuevo en 15 minutos.' }
});

// 3. Limitador para creación de propiedades (Evita spam de publicaciones)
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  message: { error: 'Has publicado muchas propiedades. Intenta de nuevo en una hora.' },
  skip: (req) => req.method === 'GET' // el catálogo público hace GET y no debe contar contra este límite
});

// NOTA: El chatbot (Max/Vivi) tiene SU PROPIO rate limiter adentro 
// en chatBotController.js, por lo que NO necesita uno global aquí.

// Seguridad y headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "unpkg.com", "cdnjs.cloudflare.com", "cdn.sheetjs.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com"],
      fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
      // ✅ SOLUCIÓN: Se agregó "images.unsplash.com" al final de imgSrc
      imgSrc: ["'self'", "data:", "blob:", "res.cloudinary.com", "*.cloudinary.com", "*.tile.openstreetmap.org", "*.basemaps.cartocdn.com", "nominatim.openstreetmap.org", "unpkg.com", "api.qrserver.com", "images.unsplash.com"],
      connectSrc: ["'self'", "nominatim.openstreetmap.org", "ip-api.com", "*.openstreetmap.org", "unpkg.com", "api.zippopotam.us", "api.groq.com", "generativelanguage.googleapis.com"],
      workerSrc: ["'self'", "blob:"],
    }
  }
}));

app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(morgan('dev'));

// Body parsers (DESPUÉS del webhook raw)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));
app.use(mongoSanitize());
app.use(xss());

// ✅ APLICAR RATE LIMITING SOLO DONDE ES NECESARIO (Eliminado el global)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/registro', authLimiter);
app.use('/api/mensajes', contactLimiter);
app.use('/api/propiedades', postLimiter); // Limita solo POST/PUT, no GET

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', proyecto: 'Vive Mas Inmobiliaria', version: '1.0.0' });
});

// Rutas principales
app.use('/api/auth/meta', metaOAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/propiedades', propertyRoutes);
app.use('/api/favoritos', favoriteRoutes);
app.use('/api/mensajes', messageRoutes);
app.use('/api/site', siteconfigRoutes);
app.use('/api/chat', chatbotRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/reportes', reportRoutes);
app.use('/api', pagoRoutes);

// ==========================================
// DIRECTORIO DE INMOBILIARIAS/AGENTES VERIFICADOS
// ==========================================
const User = require('./models/User');
const Property = require('./models/Property');

app.get('/api/directorio', async (req, res) => {
  try {
    const usuarios = await User.find({
      identidadVerificada: true,
      status: 'activo'
    }).select('nombre email telefono avatar plan role kyc');

    const directorio = await Promise.all(usuarios.map(async (u) => {
      const numPropiedades = await Property.countDocuments({
        propietario: u._id,
        status: 'aprobada'
      });
      return {
        id: u._id,
        name: u.nombre,
        type: u.role === 'basico_plus' ? 'inmobiliaria' : (u.role === 'services' ? 'agente' : 'inmobiliaria'),
        location: u.kyc?.estado || 'México',
        city: u.kyc?.ciudad || 'Mexico',
        properties: numPropiedades,
        verified: true,
        phone: u.telefono || '',
        email: u.email,
        image: u.avatar || '',
        description: `Inmobiliaria verificada en Vive Más Inmobiliaria. ${u.nombre} cuenta con ${numPropiedades} propiedades activas.`,
        tags: ['Verificado', 'KYC', 'Confiado']
      };
    }));

    res.json({ ok: true, directorio });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// LISTA DE ESPERA PREMIUM (Pública, sin auth)
// ==========================================
const Waitlist = require('./models/Waitlist');

app.post('/api/waitlist/premium', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
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

// Inicializar módulo de Marketing Automation
iniciarMarketingAutomation();

// ==========================================
// RUTAS DEL MÓDULO AGENTES FUNDADORES
// ==========================================
app.use('/api/fundadores', foundersRoutes);
app.use(propertiesRoutes); // Maneja /api/properties (nuevo) y /p/:slug

// ==========================================
// SEO MASIVO: Rutas dinámicas (Ej: /renta/departamentos/cdmx/polanco)
// ==========================================
app.get('/:operacion(renta|venta)/:tipo(departamentos|casas|terrenos|locales)/:estado?/:ciudad?', seoController.showDynamicSEOPage);

// ✅ CORRECCIÓN: Eliminé el middleware 404 duplicado que tenías
// 404
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
      console.log(`🗑️ Purga de mensajes: ${deletedCount} mensaje(s) de más de 6 meses eliminados.`);
    }
  } catch (error) {
    console.error('❌ Error en purga de mensajes antiguos:', error.message);
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
      console.log(`⏰ Plan vencido: ${u.email} (${u.plan}) → gratuito`);
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

    console.log(`⏰ ${usuariosVencidos.length} usuario(s) bajados a gratuito por vencimiento.`);
  } catch (error) {
    console.error('❌ Error en cron de planes vencidos:', error.message);
  }
};

// Luego cada 6 horas
setInterval(bajarPlanesVencidos, 6 * 60 * 60 * 1000);

// ==========================================
// MANEJADOR DE ERRORES GLOBAL — debe ir al final, después de todas las rutas.
// ==========================================
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo es demasiado grande.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Solicitud mal formada.' });
  }
  console.error('❌ Error no controlado:', err);
  res.status(err?.status || err?.statusCode || 500).json({
    error: err?.message || 'Ocurrió un error inesperado. Intenta de nuevo.'
  });
});

module.exports = app;