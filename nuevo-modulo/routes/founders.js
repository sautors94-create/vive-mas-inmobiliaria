const express = require('express');
const router = express.Router();
const multer = require('multer');
const founderController = require('../controllers/founderController');

// Configuración de Multer (Dónde guarda las fotos que suban del celular)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'tmp_uploads/'); // Asegúrate de crear esta carpeta en tu proyecto
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.post('/register', founderController.register);
// El .single('photo') significa que el input del HTML debe tener name="photo"
router.post('/generate-card', upload.single('photo'), founderController.generateCard); 
router.get('/stats', founderController.getDashboardData);

const path = require('path'); // Pon esto arriba del todo del archivo
module.exports = router;