const express = require('express');
const router = express.Router();
const { registro, login, logout, perfil, refreshToken } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/registro', registro);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.get('/perfil', authMiddleware, perfil);

module.exports = router;