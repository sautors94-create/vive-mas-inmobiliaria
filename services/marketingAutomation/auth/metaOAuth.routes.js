// ==========================================
// RUTAS DE OAUTH DE META
// ==========================================
// Expone los endpoints de conexión con Facebook/Instagram.
// Se montan en /api/auth/meta

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../../src/middleware/auth.middleware');
const metaOAuthController = require('./metaOAuth.controller');

// GET /api/auth/meta/connect — Genera URL de autorización
router.get('/connect', authMiddleware, metaOAuthController.connect);

// GET /api/auth/meta/callback — Recibe el código de autorización (NO requiere auth, lo redirige Meta)
router.get('/callback', metaOAuthController.callback);

// POST /api/auth/meta/disconnect — Desconecta la cuenta
router.post('/disconnect', authMiddleware, metaOAuthController.disconnect);

// GET /api/auth/meta/status — Estado de conexión
router.get('/status', authMiddleware, metaOAuthController.status);

// POST /api/auth/meta/data-deletion — Requerido por Meta en modo en vivo
router.post('/data-deletion', metaOAuthController.dataDeletion);

module.exports = router;
