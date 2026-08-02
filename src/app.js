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

const app = express();

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
      imgSrc: ["'self'", "data:", "blob:", "res.cloudinary.com", "*.cloudinary.com", "*.tile.openstreetmap.org", "*.basemaps.cartocdn.com", "nominatim.openstreetmap.org", "unpkg.com", "api.qrserver.com"],
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

// Rutas
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

// ✅ CORRECCIÓN: Eliminé el middleware 404 duplicado que tenías
// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ==========================================
// CRON: Bajar a gratuito cuando vence el plan
// ==========================================
const User = require('./models/User');
const Property = require('./models/Property');
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

// Ejecutar una vez al arrancar
setTimeout(bajarPlanesVencidos, 5000);

// Luego cada 6 horas
setInterval(bajarPlanesVencidos, 6 * 60 * 60 * 1000);

module.exports = app;