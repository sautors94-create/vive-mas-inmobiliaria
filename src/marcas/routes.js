'use strict';

/**
 * src/marcas/routes.js — Enrutado del módulo Marcas y Profesionales Aliados.
 * ---------------------------------------------------------------------------
 * REESCRITO según el contrato de tests/marcas.integration.js (Camino B).
 *
 * MONTAJE (src/app.js):
 *   app.use('/api/marcas', marcasRouter);
 *   app.use('/api/admin/marcas', authMiddleware, requireRole('admin'), adminMarcasRouter);
 *
 * SEGURIDAD (regla de una sola vez):
 *   - El panel del proveedor lleva SU PROPIA sesión: ctrl.autenticarMarca
 *     verifica el Bearer con el secreto de marca (JWT_BRAND_SECRET o
 *     JWT_SECRET+'_brand'). Un token de usuario/admin NO abre este panel.
 *   - El panel admin NO repite guards aquí: la protección vive en el montaje
 *     de app.js (authMiddleware + requireRole('admin')).
 *
 * ORDEN DE REGISTRO (lea antes de tocar):
 *   1. /publico/filtros y /publico/catalogos ANTES que /publico/:slug
 *      (si no, ":slug" se traga las rutas fijas → 404/500).
 *   2. /auth/canales, /auth/solicitar, /auth/verificar son públicos;
 *      /auth/solicitar lleva límite anti-abuso por IP (10 por hora).
 *   3. En el admin, las rutas fijas de /catalogos/* van ANTES que /:id.
 */

const express = require('express');
const ctrl = require('./controllers');

const marcasRouter = express.Router();
const adminMarcasRouter = express.Router();

// ============================================================
// UPLOAD (multer en memoria + límites estrictos)
// ============================================================
let multer = null;
try {
  multer = require('multer');
} catch (error) {
  console.warn('[marcas] multer no está instalado: la subida de imágenes queda deshabilitada');
}

const FORMATOS_IMAGEN = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMG_MB = Math.min(20, Math.max(1, Number(process.env.MAX_IMG_MB) || 5));

const subida = multer
  ? multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_IMG_MB * 1024 * 1024, files: 1 },
      fileFilter: (req, file, cb) => {
        // Primera barrera: mimetype declarado. La firma real la valida el
        // controller (un "png" que es texto plano se rechaza allá con 400).
        if (!FORMATOS_IMAGEN.has(String(file.mimetype || '').toLowerCase())) {
          return cb(new Error('FORMATO_NO_PERMITIDO'));
        }
        return cb(null, true);
      },
    })
  : null;

/** Envoltorio que mapea errores de multer a 413/400 sin filtrar al handler global. */
const recibirImagen = (req, res, next) => {
  if (!subida) {
    return res.status(500).json({ error: 'El servidor no puede procesar imágenes (falta multer).' });
  }
  subida.single('imagen')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `La imagen supera el máximo de ${MAX_IMG_MB} MB.` });
    }
    if (err.message === 'FORMATO_NO_PERMITIDO') {
      return res.status(400).json({ error: 'Formato de imagen no permitido (usa PNG, JPG o WebP).' });
    }
    return res.status(400).json({ error: 'No se pudo procesar el archivo.' });
  });
};

// ============================================================
// LÍMITE ANTI-ABUSO para pedir códigos (por IP, 10 por hora)
// Memoria local: en cluster/PM2 multi-instancia mover a Redis si hace falta.
// ============================================================
const VENTANA_IP_MS = 60 * 60 * 1000;
const MAX_SOLICITUDES_POR_IP = 10;
const solicitudesPorIp = new Map();

const marcasAuthLimiter = (req, res, next) => {
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'desconocida';
  const ahora = Date.now();
  const marcas = (solicitudesPorIp.get(ip) || []).filter((t) => ahora - t < VENTANA_IP_MS);
  if (marcas.length >= MAX_SOLICITUDES_POR_IP) {
    marcas.push(ahora);
    solicitudesPorIp.set(ip, marcas);
    return res.status(429).json({ error: 'Demasiadas solicitudes de código. Intenta más tarde.' });
  }
  marcas.push(ahora);
  solicitudesPorIp.set(ip, marcas);
  if (solicitudesPorIp.size > 5000) {
    for (const [k, v] of solicitudesPorIp) {
      if (!v.some((t) => ahora - t < VENTANA_IP_MS)) solicitudesPorIp.delete(k);
    }
  }
  return next();
};

// ============================================================
// AUTENTICACIÓN DE MARCAS (público)
// ============================================================
marcasRouter.get('/auth/canales', ctrl.canales);
marcasRouter.post('/auth/solicitar', marcasAuthLimiter, ctrl.solicitarCodigo);
marcasRouter.post('/auth/verificar', ctrl.verificarCodigo);
marcasRouter.post('/auth/login', marcasAuthLimiter, ctrl.loginMarca);
marcasRouter.post('/auth/refrescar', ctrl.refrescarSesion);

// ============================================================
// DIRECTORIO PÚBLICO — rutas FIJAS antes que /publico/:slug
// ============================================================
marcasRouter.get('/publico', ctrl.listarMarcasPublico);
marcasRouter.get('/publico/filtros', ctrl.obtenerFiltrosPublico);
marcasRouter.get('/publico/catalogos', ctrl.obtenerCatalogos);
marcasRouter.get('/publico/:slug', ctrl.obtenerMarcaPublico);

// ============================================================
// PANEL DEL PROVEEDOR (sesión de marca)
// ============================================================
const panelRouter = express.Router();
panelRouter.use(ctrl.autenticarMarca);

panelRouter.get('/mi-marca', ctrl.obtenerMiMarca);
panelRouter.get('/mi-marca/vista-previa', ctrl.vistaPreviaMarca);
panelRouter.put('/mi-marca', ctrl.actualizarMiMarca);
panelRouter.post('/mi-marca/publicar', ctrl.publicarMarca);
panelRouter.post('/mi-marca/despublicar', ctrl.despublicarMarca);
panelRouter.post('/mi-marca/imagenes/:tipo', recibirImagen, ctrl.subirImagen);
panelRouter.delete('/mi-marca/imagenes/:tipo', ctrl.eliminarImagen);
panelRouter.post('/mi-marca/promociones', ctrl.agregarPromocion);
panelRouter.put('/mi-marca/promociones/:promoId', ctrl.actualizarPromocion);
panelRouter.delete('/mi-marca/promociones/:promoId', ctrl.eliminarPromocion);
panelRouter.get('/mi-marca/solicitudes', ctrl.obtenerSolicitudes);
panelRouter.post('/mi-marca/solicitudes/:solicitudId/atender', ctrl.atenderSolicitud);
panelRouter.post('/cuenta/acceso/solicitar', ctrl.solicitarAcceso);
panelRouter.post('/cuenta/acceso/confirmar', ctrl.confirmarAcceso);
panelRouter.post('/cuenta/contrasena', ctrl.fijarContrasena);
panelRouter.delete('/mi-marca', ctrl.eliminarMiMarca);

marcasRouter.use('/panel', panelRouter);

// ============================================================
// PANEL ADMINISTRATIVO — rutas fijas de catálogos antes que /:id
// ============================================================
adminMarcasRouter.get('/', ctrl.adminListarMarcas);
adminMarcasRouter.post('/catalogos/categorias', ctrl.adminCrearCategoria);
adminMarcasRouter.put('/catalogos/categorias/:id', ctrl.adminActualizarCategoria);
adminMarcasRouter.get('/:id', ctrl.adminObtenerMarca);
adminMarcasRouter.post('/:id/solicitudes', ctrl.adminCrearSolicitud);
adminMarcasRouter.patch('/:id/solicitudes/:solicitudId', ctrl.adminResolverSolicitud);
adminMarcasRouter.post('/:id/bloquear', ctrl.adminBloquear);
adminMarcasRouter.post('/:id/reactivar', ctrl.adminReactivar);
adminMarcasRouter.post('/:id/desactivar', ctrl.adminDesactivar);
adminMarcasRouter.delete('/:id', ctrl.adminEliminarMarca);

module.exports = { marcasRouter, adminMarcasRouter };
