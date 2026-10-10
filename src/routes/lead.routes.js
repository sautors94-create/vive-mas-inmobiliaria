const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const leadController = require('../controllers/lead.controller');

router.use(authMiddleware);

// Rutas del CRM
router.get('/crm', leadController.getMisLeadsCRM);
router.put('/:id/mover', leadController.moverLeadEtapa);
router.post('/:id/notas', leadController.agregarNotaLead);
router.post('/:id/tareas', leadController.agregarTareaLead);
router.put('/:id/tareas/:tareaId', leadController.completarTareaLead);

module.exports = router;