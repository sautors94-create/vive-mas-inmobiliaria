const express = require('express');
const router = express.Router();
const { registro, login, logout, perfil, misLeads, refreshToken, verificarCodigo, reenviarCodigo, actualizarNotificaciones, actualizarPerfil, subirKyc } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { upload } = require('../config/cloudinary');

router.post('/registro', registro);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.post('/verificar', verificarCodigo);
router.post('/reenviar-codigo', reenviarCodigo);
router.get('/perfil', authMiddleware, perfil);
router.get('/leads', authMiddleware, misLeads);
router.patch('/notificaciones', authMiddleware, actualizarNotificaciones);
router.patch('/perfil', authMiddleware, actualizarPerfil);
router.post(
  '/kyc',
  authMiddleware,
  (req, res, next) => {
    upload.fields([
      { name: 'ineFrente', maxCount: 1 },
      { name: 'ineReverso', maxCount: 1 }
    ])(req, res, (err) => {
      if (!err) return next();

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Archivo demasiado grande (máximo 5MB)' });
      }

      if (err.message === 'Solo se permiten imágenes') {
        return res.status(400).json({ error: 'Solo se permiten imágenes' });
      }

      return res.status(400).json({ error: err.message || 'Error al subir archivos' });
    });
  },
  subirKyc
);

module.exports = router;
