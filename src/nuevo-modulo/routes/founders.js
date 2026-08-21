const express = require('express');
const multer = require('multer');
const router = express.Router();
const founderController = require('../controllers/founderController');
const authMiddleware = require('../../middleware/auth.middleware');

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
router.get('/stats', founderController.getDashboardData);
router.get('/admin-list', founderController.getAdminList);
router.get('/panel-data/:referralCode', founderController.getAgentPanelData);
router.post('/view/:referralCode', founderController.trackProfileView);

// --- Flujo para usuarios YA logueados en la plataforma (dashboard real) ---
router.get('/mine', authMiddleware, founderController.getOrCreateMine);
router.post('/mine/referrer', authMiddleware, founderController.setReferrer);
router.patch('/mine/social', authMiddleware, founderController.updateSocial);
router.post('/mine/generate-card', authMiddleware, upload.single('photo'), founderController.generateCardMine);

module.exports = router;
