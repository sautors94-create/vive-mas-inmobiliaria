const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { getUsuarios, cambiarPlan, suspenderUsuario } = require('../controllers/admin.controller');

router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/usuarios', getUsuarios);
router.patch('/usuarios/:id/plan', cambiarPlan);
router.patch('/usuarios/:id/suspender', suspenderUsuario);

module.exports = router;