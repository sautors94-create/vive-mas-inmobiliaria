const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const founderController = require('../controllers/founderController');
const authMiddleware = require('../../middleware/auth.middleware');

// Carpeta temporal para fotos subidas desde el formulario (celular/PC)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../../tmp_uploads/'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

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
