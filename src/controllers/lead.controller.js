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
    
    // Usamos aggregate para poder hacer lookup de la propiedad y filtrar por sus datos
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
    
    // Filtro por texto (nombre del lead)
    if (search) {
      pipeline.push({ $match: { 'nombre': { $regex: search, $options: 'i' } } });
    }
    // Filtro por estado de la propiedad
    if (estado) {
      pipeline.push({ $match: { 'propiedadInteres.ubicacion.estado': { $regex: estado, $options: 'i' } } });
    }
    // Filtro por tipo de propiedad
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
    
    // Verificar que la propiedad pertenezca al usuario si se proporcionó
    let propiedadValida = null;
    if (propiedadInteres) {
      const prop = await Property.findOne({ _id: propiedadInteres, propietario: req.user.id });
      if (prop) propiedadValida = prop._id;
    }

    const nuevoLead = await Lead.create({
      nombre,
      telefono,
      email: email || null,
      tipo: 'servicio', // Asumimos que es un cliente potencial
      status: 'nuevo',
      atendidoPor: req.user.id,
      propiedadInteres: propiedadValida
    });
    
    res.status(201).json({ ok: true, mensaje: 'Lead agregado correctamente', lead: nuevoLead });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// No olvides agregar crearLeadManual al module.exports al final del archivo:
module.exports = {
  getMisLeadsCRM,
  crearLeadManual, // <--- AGREGAR ESTO
  moverLeadEtapa,
  agregarNotaLead,
  agregarTareaLead,
  completarTareaLead
};