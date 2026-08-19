const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const founderController = require('../controllers/founderController');

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

router.post('/register', founderController.register);
router.post('/generate-card', upload.single('photo'), founderController.generateCard);
router.get('/stats', founderController.getDashboardData);
router.get('/admin-list', founderController.getAdminList);
router.get('/panel-data/:referralCode', founderController.getAgentPanelData);
router.post('/view/:referralCode', founderController.trackProfileView);

module.exports = router;
