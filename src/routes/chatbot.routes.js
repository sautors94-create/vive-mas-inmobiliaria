const express = require('express');
const router = express.Router();
const { chatSoporte, chatServicios, guardarLead } = require('../controllers/chatbot.controller');

router.post('/soporte', chatSoporte);
router.post('/servicios', chatServicios);
router.post('/lead', guardarLead);

module.exports = router;