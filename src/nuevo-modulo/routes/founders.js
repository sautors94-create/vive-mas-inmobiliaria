const express = require('express');
const multer = require('multer');
const router = express.Router();
const founderController = require('../controllers/founderController');
const authMiddleware = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/role.middleware');

// Guardamos el archivo subido EN MEMORIA (no en disco). Esto evita por
// completo el error "ENOENT: no such file or directory ... tmp_uploads/..."
// que da en Hostinger: su hosting despliega cada versión en una carpeta
// nueva (hbuilds/versions/<hash>/...) y una carpeta vacía como tmp_uploads
// no siempre sobrevive el despliegue. Como la imagen se procesa al vuelo
// (se dibuja en el canvas y no se vuelve a necesitar), no hace falta
// escribirla a disco en ningún momento.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB máx por foto
});

// --- Flujo público, sin login (recruiting externo: Marketplace, grupos de FB) ---
router.post('/register', founderController.register);
router.post('/generate-card', upload.single('photo'), founderController.generateCard);
router.get('/panel-data/:referralCode', founderController.getAgentPanelData);
router.post('/view/:referralCode', founderController.trackProfileView);
router.get('/directory-list', founderController.getDirectoryList); // directorio.html público

// --- Solo admin (antes sin protección — cualquiera podía ver teléfonos de
// todos los agentes en /admin-list sin loguearse) ---
router.get('/stats', authMiddleware, requireRole('admin'), founderController.getDashboardData);
router.get('/admin-list', authMiddleware, requireRole('admin'), founderController.getAdminList);
router.delete('/admin/:id', authMiddleware, requireRole('admin'), founderController.eliminarFundador);

// --- Flujo para usuarios YA logueados en la plataforma (dashboard real) ---
router.get('/mine', authMiddleware, founderController.getMineStatus); // solo consulta, nunca crea
router.post('/mine/register', authMiddleware, founderController.registerMine); // inscripción explícita
router.post('/mine/referrer', authMiddleware, founderController.setReferrer);
router.patch('/mine/social', authMiddleware, founderController.updateSocial);
router.post('/mine/generate-card', authMiddleware, upload.single('photo'), founderController.generateCardMine);

module.exports = router;
