const Lead = require('../models/Lead');
const Property = require('../models/Property');
const mongoose = require('mongoose');

// ==========================================
// OBTENER LEADS PARA EL TABLERO KANBAN (CRM) CON FILTROS
// ==========================================
const getMisLeadsCRM = async (req, res) => {
  try {
    const { search, estado, tipo, propiedadId } = req.query;
    const match = { atendidoPor: req.user.id };
    
    if (propiedadId) {
      match.propiedadInteres = mongoose.Types.ObjectId(propiedadId);
    }
    
    let pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'properties',
          localField: 'propiedadInteres',
          foreignField: '_id',
          as: 'propiedadInteres'
        }
      },
      { $unwind: { path: '$propiedadInteres', preserveNullAndEmptyArrays: true } }
    ];
    
    if (search) {
      pipeline.push({ $match: { 'nombre': { $regex: search, $options: 'i' } } });
    }
    if (estado) {
      pipeline.push({ $match: { 'propiedadInteres.ubicacion.estado': { $regex: estado, $options: 'i' } } });
    }
    if (tipo) {
      pipeline.push({ $match: { 'propiedadInteres.tipo': tipo } });
    }
    
    pipeline.push({ $sort: { createdAt: -1 } });
    
    const leads = await Lead.aggregate(pipeline);

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
// CREAR LEAD MANUALMENTE DESDE EL CRM
// ==========================================
const crearLeadManual = async (req, res) => {
  try {
    const { nombre, telefono, email, propiedadInteres } = req.body;
    
    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'El nombre y el teléfono son obligatorios' });
    }
    
    let propiedadValida = null;
    if (propiedadInteres) {
      const prop = await Property.findOne({ _id: propiedadInteres, propietario: req.user.id });
      if (prop) propiedadValida = prop._id;
    }

    const nuevoLead = await Lead.create({
      nombre,
      telefono,
      email: email || null,
      tipo: 'servicio',
      status: 'nuevo',
      atendidoPor: req.user.id,
      propiedadInteres: propiedadValida
    });
    
    res.status(201).json({ ok: true, mensaje: 'Lead agregado correctamente', lead: nuevoLead });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// MOVER LEAD DE ETAPA (KANBAN)
// ==========================================
const moverLeadEtapa = async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevaEtapa } = req.body;

    const leadActualizado = await Lead.findByIdAndUpdate(
      id,
      { status: nuevaEtapa },
      { new: true }
    );

    if (!leadActualizado) {
      return res.status(404).json({ ok: false, error: 'Lead no encontrado' });
    }

    res.json({ ok: true, lead: leadActualizado });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// ==========================================
// AGREGAR NOTA A UN LEAD (Ajustado a tu Schema)
// ==========================================
const agregarNotaLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;

    if (!texto) return res.status(400).json({ ok: false, error: 'El texto de la nota es obligatorio' });

    // Hacemos push usando la estructura exacta de tu Schema
    const leadActualizado = await Lead.findByIdAndUpdate(
      id,
      { $push: { notasInternas: { texto: texto, autor: req.user.id } } },
      { new: true }
    );

    if (!leadActualizado) return res.status(404).json({ ok: false, error: 'Lead no encontrado' });

    const notaAgregada = leadActualizado.notasInternas[leadActualizado.notasInternas.length - 1];
    res.status(201).json({ ok: true, nota: notaAgregada });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// ==========================================
// AGREGAR TAREA A UN LEAD (Ajustado a tu Schema)
// ==========================================
const agregarTareaLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { descripcion, fechaLimite } = req.body;

    // Validamos porque en tu Schema ambos campos son requeridos
    if (!descripcion || !fechaLimite) {
      return res.status(400).json({ ok: false, error: 'La descripción y la fecha límite son obligatorias' });
    }

    const leadActualizado = await Lead.findByIdAndUpdate(
      id,
      { $push: { tareas: { descripcion: descripcion, fechaLimite: fechaLimite } } },
      { new: true }
    );

    if (!leadActualizado) return res.status(404).json({ ok: false, error: 'Lead no encontrado' });

    const tareaAgregada = leadActualizado.tareas[leadActualizado.tareas.length - 1];
    res.status(201).json({ ok: true, tarea: tareaAgregada });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// ==========================================
// COMPLETAR TAREA DE UN LEAD
// ==========================================
const completarTareaLead = async (req, res) => {
  try {
    const { id, tareaId } = req.params;

    const leadActualizado = await Lead.findOneAndUpdate(
      { _id: id, "tareas._id": tareaId },
      { $set: { "tareas.$.completada": true } },
      { new: true }
    );

    if (!leadActualizado) return res.status(404).json({ ok: false, error: 'Lead o tarea no encontrada' });

    res.json({ ok: true, lead: leadActualizado });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = {
  getMisLeadsCRM,
  crearLeadManual,
  moverLeadEtapa,
  agregarNotaLead,
  agregarTareaLead,
  completarTareaLead
};