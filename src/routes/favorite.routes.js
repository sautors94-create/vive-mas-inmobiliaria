const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { agregarFavorito, listarFavoritos, eliminarFavorito } = require('../controllers/favorite.controller');

router.use(authMiddleware);

router.get('/', listarFavoritos);
router.post('/:id', agregarFavorito);
router.delete('/:id', eliminarFavorito);

module.exports = router;