const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { enviarMensaje, misConversaciones, conversacionPropiedad } = require('../controllers/message.controller');

router.use(authMiddleware);

router.get('/', misConversaciones);
router.get('/:id', conversacionPropiedad);
router.post('/:id', enviarMensaje);

module.exports = router;