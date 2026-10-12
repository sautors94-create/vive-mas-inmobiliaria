const express = require('express');
const router = express.Router();
const adminRouter = express.Router();
const jwt = require('jsonwebtoken');
const ctrl = require('./controllers');

const BRAND_JWT_SECRET = process.env.JWT_BRAND_SECRET || process.env.JWT_SECRET + '_brand';

// Middlewares de autenticación
const authBrand = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const decoded = jwt.verify(token, BRAND_JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const authAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ==========================================
// RUTAS PÚBLICAS (Ajustadas a tu frontend)
// ==========================================
router.get('/publico', ctrl.obtenerMarcasPublico);
router.get('/publico/filtros', ctrl.obtenerCatalogos);
router.get('/publico/:slug', ctrl.obtenerMarcaPublico);

// ==========================================
// RUTAS DE AUTENTICACIÓN DE MARCAS
// ==========================================
router.post('/auth/solicitar', ctrl.registrarMarca);
router.post('/auth/register', ctrl.registrarMarca);
router.post('/auth/verificar', ctrl.verificarMarca);
router.post('/auth/verify', ctrl.verificarMarca);
router.post('/auth/login', ctrl.loginMarca);
router.post('/auth/refresh', ctrl.refreshToken);

// ==========================================
// RUTAS DEL PANEL DE LA MARCA (PROTEGIDAS)
// ==========================================
router.get('/panel/mi-marca', authBrand, ctrl.obtenerMiMarca);
router.put('/panel/mi-marca', authBrand, ctrl.actualizarMiMarca);
router.put('/panel/publicar', authBrand, ctrl.publicarMarca);

// ==========================================
// RUTAS DEL ADMINISTRADOR
// ==========================================
adminRouter.get('/', ctrl.adminObtenerMarcas);
adminRouter.put('/:id/status', ctrl.adminCambiarStatus);

module.exports = {
  marcasRouter: router,
  adminMarcasRouter: adminRouter
};