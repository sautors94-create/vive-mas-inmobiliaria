const express = require('express');
const router = express.Router();
const { registro, login, logout, perfil, refreshToken, verificarCodigo, reenviarCodigo } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/registro', registro);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.post('/verificar', verificarCodigo);
router.post('/reenviar-codigo', reenviarCodigo);
router.get('/perfil', authMiddleware, perfil);

module.exports = router;