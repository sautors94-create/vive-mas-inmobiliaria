const Lead = require('../models/Lead');
const Property = require('../models/Property');
const mongoose = require('mongoose');

// ==========================================
// OBTENER LEADS PARA EL TABLERO KANBAN (CRM)
// ==========================================
const getMisLeadsCRM = async (req, res) => {
  try {
    // Buscamos los leads que atiende el usuario logueado
    const leads = await Lead.find({ atendidoPor: req.user.id })
      .populate('propiedadInteres', 'titulo fotos precio ubicacion') // Traemos la info de la propiedad
      .populate('usuarioRegistrado', 'nombre avatar email')
      .sort({ createdAt: -1 });

    // Agrupamos los leads por su etapa (status) para armar las columnas del Kanban
    const embudo = {
      nuevo: [],
      contactado: [],
      visita_agendada: [],
      en_negociacion: [],
      ganado: [],
      perdido: []
    };

    leads.forEach(lead => {
      if (embudo[lead.status]) {
        embudo[lead.status].push(lead);
      }
    });

    res.json({ ok: true, total: leads.length, embudo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// MOVER LEAD DE ETAPA (DRAG & DROP)
// ==========================================
const moverLeadEtapa = async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevaEtapa } = req.body;

    // Validar que la etapa sea válida
    const etapasValidas = ['nuevo', 'contactado', 'visita_agendada', 'en_negociacion', 'ganado', 'perdido'];
    if (!etapasValidas.includes(nuevaEtapa)) {
      return res.status(400).json({ error: 'Etapa no válida' });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    // Seguridad: Solo el agente asignado o un admin pueden mover el lead
    if (lead.atendidoPor?.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para mover este lead' });
    }

    lead.status = nuevaEtapa;
    await lead.save();

    res.json({ ok: true, mensaje: 'Lead movido de etapa', lead });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// AGREGAR NOTA INTERNA A UN LEAD
// ==========================================
const agregarNotaLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;

    if (!texto || !texto.trim()) {
      return res.status(400).json({ error: 'La nota no puede estar vacía' });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    // Agregamos la nota al array
    lead.notasInternas.push({
      texto: texto.trim(),
      autor: req.user.id
    });

    await lead.save();

    // Volvemos a hacer populate para devolver el autor completo
    await lead.populate('notasInternas.autor', 'nombre avatar');

    res.status(201).json({ ok: true, mensaje: 'Nota agregada', nota: lead.notasInternas[lead.notasInternas.length - 1] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// AGREGAR TAREA / RECORDATORIO A UN LEAD
// ==========================================
const agregarTareaLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { descripcion, fechaLimite } = req.body;

    if (!descripcion || !fechaLimite) {
      return res.status(400).json({ error: 'Se requiere descripción y fecha límite' });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    lead.tareas.push({
      descripcion,
      fechaLimite: new Date(fechaLimite)
    });

    await lead.save();

    res.status(201).json({ ok: true, mensaje: 'Tarea agregada', tarea: lead.tareas[lead.tareas.length - 1] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// MARCAR TAREA COMO COMPLETADA
// ==========================================
const completarTareaLead = async (req, res) => {
  try {
    const { id, tareaId } = req.params;

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const tarea = lead.tareas.id(tareaId);
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    tarea.completada = !tarea.completada; // Toggle
    await lead.save();

    res.json({ ok: true, mensaje: 'Estado de tarea actualizado', tarea });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getMisLeadsCRM,
  moverLeadEtapa,
  agregarNotaLead,
  agregarTareaLead,
  completarTareaLead
};