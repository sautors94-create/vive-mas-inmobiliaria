const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const Lead = require('../models/Lead');

router.use(authMiddleware);
router.use(requireRole('admin', 'services'));

router.get('/leads', async (req, res) => {
  try {
    const { status, search } = req.query;
    const filtro = {};
    if (status) filtro.status = status;
    if (search) filtro.$or = [
      { nombre: { $regex: search, $options: 'i' } },
      { telefono: { $regex: search, $options: 'i' } },
      { servicio: { $regex: search, $options: 'i' } }
    ];
    const leads = await Lead.find(filtro)
      .populate('atendidoPor', 'nombre')
      .sort({ createdAt: -1 });
    res.json({ ok: true, total: leads.length, leads });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/leads/:id', async (req, res) => {
  try {
    const { status, notas } = req.body;
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status, notas, atendidoPor: req.user.id },
      { new: true }
    ).populate('atendidoPor', 'nombre');
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    res.json({ ok: true, lead });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/leads/:id', async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ ok: true, mensaje: 'Lead eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/leads/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('atendidoPor', 'nombre');
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    res.json({ ok: true, lead });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;