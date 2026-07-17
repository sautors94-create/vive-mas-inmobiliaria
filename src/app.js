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
const pagoRoutes = require('./routes/pagos');
const { webhookStripe } = require('./routes/pagos');

const app = express();

// ⚠️ CRÍTICO: el webhook de Stripe debe registrarse ANTES de express.json()
// porque necesita el body como raw Buffer para verificar la firma
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookStripe);

// Rate limiters
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en 15 minutos' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login, intenta de nuevo en 15 minutos' }
});

// Seguridad y headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "unpkg.com", "cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com"],
      fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "res.cloudinary.com", "*.cloudinary.com", "*.tile.openstreetmap.org", "*.basemaps.cartocdn.com", "nominatim.openstreetmap.org", "unpkg.com"],
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

// Rate limiting
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/registro', authLimiter);

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
app.use('/api', pagoRoutes); // Rutas de pagos: /api/admin/pagos

// ==========================================
// ✅ NUEVO: LISTA DE ESPERA PREMIUM
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

// Ruta para que el Admin vea los correos de la lista de espera
app.get('/api/admin/waitlist', async (req, res) => {
  try {
    const correos = await Waitlist.find().sort({ createdAt: -1 });
    res.json({ ok: true, correos });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

module.exports = app;