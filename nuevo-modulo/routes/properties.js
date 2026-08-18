const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');

router.post('/api/properties', propertyController.create); // Ruta post para guardar
router.get('/p/:slug', propertyController.showPublicPage); // Ruta pública

module.exports = router;