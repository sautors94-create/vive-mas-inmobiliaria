const express = require('express');
const router = express.Router();

// ✅ TODAS LAS IMPORTACIONES JUNTAS ARRIBA (Sin esto, falla el "before initialization")
const { 
  registro, 
  login, 
  logout, 
  perfil, 
  misLeads, 
  refreshToken, 
  verificarCodigo, 
  reenviarCodigo, 
  solicitarRecuperacion, 
  restablecerPassword, // <--- Aquí está la función
  actualizarNotificaciones, 
  actualizarPerfil, 
  solicitarCambioCelular,
  confirmarCambioCelular,
  subirKyc,
  solicitarVerificacionCorreoCorporativo,
  confirmarVerificacionCorreoCorporativo,
  subirKyb,
  iniciarSetup2FA,
  confirmar2FA,
  desactivar2FA,
  cancelarSuscripcion,
  reactivarSuscripcion,
  autorizarCargoRecurrente,
  revocarCargoRecurrente,
  verificar2FA,
  recuperar2FA,
  eliminarMiCuenta
} = require('../controllers/auth.controller');

const authMiddleware = require('../middleware/auth.middleware');
const { upload, uploadDocumentos } = require('../config/cloudinary');

// ==========================================
// RUTAS PÚBLICAS (No requieren estar logueado)
// ==========================================
router.post('/registro', registro);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.post('/verificar', verificarCodigo);
router.post('/reenviar-codigo', reenviarCodigo);
router.post('/recuperar', solicitarRecuperacion); // Olvidé mi contraseña (envía email)
router.post('/reset-password', restablecerPassword); // Crear nueva contraseña

// ✅ 2FA: verificar código y usar código de recuperación (NO requieren auth completo — usan tempToken)
router.post('/verificar-2fa', verificar2FA);
router.post('/2fa/recuperar', recuperar2FA);

// ==========================================
// RUTAS PROTEGIDAS (Requieren token válido)
// ==========================================
router.get('/perfil', authMiddleware, perfil);
router.get('/leads', authMiddleware, misLeads);
router.patch('/notificaciones', authMiddleware, actualizarNotificaciones);
router.patch('/perfil', authMiddleware, actualizarPerfil);

// Cambio de celular con verificación OTP por SMS (Twilio Verify)
router.post('/celular/solicitar-cambio', authMiddleware, solicitarCambioCelular);
router.post('/celular/confirmar-cambio', authMiddleware, confirmarCambioCelular);

// Verificar si el plan cambió (al regresar de Stripe)
router.get('/verificar-plan', authMiddleware, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user.id).select('plan planFechaFin planFechaInicio planPeriodo planCancelado cargoRecurrenteAutorizado nombre email');
    if (!user) return res.status(404).json({ ok: false });
    res.json({ ok: true, plan: user.plan, planFechaFin: user.planFechaFin, planFechaInicio: user.planFechaInicio, planPeriodo: user.planPeriodo, planCancelado: user.planCancelado, cargoRecurrenteAutorizado: user.cargoRecurrenteAutorizado, user });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Suscripción: cancelar, reactivar
router.post('/cancelar-suscripcion', authMiddleware, cancelarSuscripcion);
router.post('/reactivar-suscripcion', authMiddleware, reactivarSuscripcion);

// Cargo recurrente: autorizar, revocar (Ley Banxico)
router.post('/autorizar-cargo-recurrente', authMiddleware, autorizarCargoRecurrente);
router.post('/revocar-cargo-recurrente', authMiddleware, revocarCargoRecurrente);
router.delete('/cuenta', authMiddleware, eliminarMiCuenta);

// ✅ 2FA: setup, confirmar, desactivar (requieren auth)
router.get('/2fa/setup', authMiddleware, iniciarSetup2FA);
router.post('/2fa/confirmar', authMiddleware, confirmar2FA);
router.post('/2fa/desactivar', authMiddleware, desactivar2FA);

// KYC (persona) — INE o Pasaporte
router.post(
  '/kyc',
  authMiddleware,
  (req, res, next) => {
    upload.fields([
      { name: 'documentoFrente', maxCount: 1 },
      { name: 'documentoReverso', maxCount: 1 }
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

// KYB (empresa) — correo corporativo + documentos
router.post('/kyb/correo/solicitar', authMiddleware, solicitarVerificacionCorreoCorporativo);
router.post('/kyb/correo/confirmar', authMiddleware, confirmarVerificacionCorreoCorporativo);
router.post(
  '/kyb',
  authMiddleware,
  (req, res, next) => {
    uploadDocumentos.fields([
      { name: 'constanciaSituacionFiscal', maxCount: 1 },
      { name: 'actaConstitutiva', maxCount: 1 },
      { name: 'comprobanteDomicilio', maxCount: 1 },
      { name: 'representanteDocumentoFrente', maxCount: 1 },
      { name: 'representanteDocumentoReverso', maxCount: 1 }
    ])(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Archivo demasiado grande (máximo 10MB)' });
      }
      return res.status(400).json({ error: err.message || 'Error al subir archivos' });
    });
  },
  subirKyb
);

module.exports = router;