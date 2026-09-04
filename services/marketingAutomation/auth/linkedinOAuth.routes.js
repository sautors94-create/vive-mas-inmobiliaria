const express = require('express');

const router = express.Router();

const authMiddleware = require('../../../src/middleware/auth.middleware');
const linkedinOAuthController = require('./linkedinOAuth.controller');

// GET /api/auth/linkedin/connect
// Genera la URL de autorización de LinkedIn
router.get('/connect', authMiddleware, linkedinOAuthController.connect);

// GET /api/auth/linkedin/callback
// Recibe el código de autorización de LinkedIn
router.get('/callback', linkedinOAuthController.callback);

// POST /api/auth/linkedin/disconnect
// Desconecta LinkedIn
router.post('/disconnect', authMiddleware, linkedinOAuthController.disconnect);

// GET /api/auth/linkedin/status
// Consulta el estado de conexión
router.get('/status', authMiddleware, linkedinOAuthController.status);

module.exports = router;