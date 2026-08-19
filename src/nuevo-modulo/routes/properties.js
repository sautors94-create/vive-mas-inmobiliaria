const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');

// Página pública compartible con meta og: (WhatsApp/Facebook preview)
router.get('/p/:slug', propertyController.showPublicPage);

module.exports = router;
