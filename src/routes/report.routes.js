const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { crearReporte, getReportes, getReportesStats, actualizarReporte, eliminarReporte } = require('../controllers/report.controller');

// Cualquier usuario autenticado puede reportar
router.post('/', authMiddleware, crearReporte);

// Solo admin puede ver y gestionar reportes
router.get('/admin', authMiddleware, requireRole('admin'), getReportes);
router.get('/admin/stats', authMiddleware, requireRole('admin'), getReportesStats);
router.patch('/admin/:id', authMiddleware, requireRole('admin'), actualizarReporte);
router.delete('/admin/:id', authMiddleware, requireRole('admin'), eliminarReporte);

module.exports = router;