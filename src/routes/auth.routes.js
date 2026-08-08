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
const { enviarNotificacionCobro } = require('../utils/email');

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
    const user = await require('../models/User').findById(req.user.id).select('plan planFechaFin planFechaInicio planPeriodo planCancelado cargoRecurrenteAutorizado nombre email ultimoAvisoCobroEnviado notificaciones');
    if (!user) return res.status(404).json({ ok: false });

    // ==========================================
    // AVISO DE PRÓXIMO COBRO (Ley Banxico / LeyMex)
    // Solo aplica a planes de pago mensuales, no cancelados, con cargo recurrente autorizado
    // Amarillo: faltan ≤10 días | Rojo: faltan ≤5 días
    // Se envía un máximo de 1 email por día (campo ultimoAvisoCobroEnviado)
    // ==========================================
    let avisoCobro = null;
    const planUser = (user.plan || 'gratuito').toLowerCase();
    const tienePlanPago = planUser === 'basico' || planUser === 'premium';
    const planMensual = (user.planPeriodo || 'mensual') === 'mensual';
    const cargoAutorizado = user.cargoRecurrenteAutorizado === true;
    const noCancelado = user.planCancelado !== true;
    const planFechaFin = user.planFechaFin ? new Date(user.planFechaFin) : null;

    if (tienePlanPago && planMensual && noCancelado && cargoAutorizado && planFechaFin && planFechaFin > new Date()) {
      const diasRestantes = Math.ceil((planFechaFin - new Date()) / (1000 * 60 * 60 * 24));
      const fechaCobroTexto = planFechaFin.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

      // Determinar si aplica aviso (rojo ≤5, amarillo ≤10)
      let color = null;
      let tipoAviso = null;
      if (diasRestantes <= 5) {
        color = 'rojo';
        tipoAviso = 'proximo_cobro';
      } else if (diasRestantes <= 10) {
        color = 'amarillo';
        tipoAviso = 'proximo_cobro';
      }

      if (color) {
        // Enviar notificación por email máximo 1 vez al día
        const ahora = Date.now();
        const ultimoAviso = user.ultimoAvisoCobroEnviado ? new Date(user.ultimoAvisoCobroEnviado).getTime() : 0;
        const pasaron24h = ahora - ultimoAviso >= 24 * 60 * 60 * 1000;
        const notifCargoActivada = user.notificaciones?.cargoRecurrente !== false;

        if (pasaron24h && notifCargoActivada) {
          try {
            await enviarNotificacionCobro(user.email, user.nombre, tipoAviso, {
              plan: user.plan,
              monto: 99,
              fechaCobro: fechaCobroTexto,
              fechaFin: fechaCobroTexto
            });
            user.ultimoAvisoCobroEnviado = new Date();
            await user.save();
            console.log(`📧 Aviso de próximo cobro enviado a ${user.email} (${diasRestantes} días, ${color})`);
          } catch (emailErr) {
            console.warn(`⚠️ No se pudo enviar aviso de cobro a ${user.email}: ${emailErr.message}`);
          }
        }

        avisoCobro = {
          diasRestantes,
          color,
          fechaCobro: fechaCobroTexto,
          mensaje: diasRestantes <= 5
            ? `¡Atención! Se realizará el cobro de tu plan en ${diasRestantes} día(s).`
            : `Próximo cobro en ${diasRestantes} día(s).`
        };
      }
    }

    res.json({
      ok: true,
      plan: user.plan,
      planFechaFin: user.planFechaFin,
      planFechaInicio: user.planFechaInicio,
      planPeriodo: user.planPeriodo,
      planCancelado: user.planCancelado,
      cargoRecurrenteAutorizado: user.cargoRecurrenteAutorizado,
      avisoCobro,
      user
    });
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