const { subirACloudinary } = require('../config/cloudinary');
const Property = require('../models/Property');

const LIMITE_POR_PLAN = {
  gratuito: 3,
  basico: 15,
  basico_plus: Infinity, // Asignado por admin, sin límite de props
  premium: Infinity
};

const crearPropiedad = async (req, res) => {
  try {
    const { titulo, descripcion, precio, operacion, tipo, ubicacion, caracteristicas } = req.body;
    
    // Permitir ilimitadas si el rol es basico_plus, sin importar el plan de pago
    const planEfectivo = req.user.role === 'basico_plus' ? 'basico_plus' : (req.user.plan || 'gratuito');
    const limite = LIMITE_POR_PLAN[planEfectivo] || 3;
    
    // Contar propiedades activas del usuario (no rechazadas/eliminadas)
    const count = await Property.countDocuments({
      propietario: req.user.id,
      status: { $ne: 'rechazada' }
    });
    
    if (count >= limite) {
      return res.status(403).json({
        // ✅ CORREGIDO: Cambiado ${plan} por ${planEfectivo}
        error: `Has alcanzado el límite de ${limite} propiedades para tu plan ${planEfectivo}. ¡Haz upgrade a premium para publicaciones ilimitadas!`
      });
    }
    
    // Definir peso según el plan del usuario
    const pesoMap = { 
      gratuito: 0, 
      basico: 1, 
      basico_plus: 1, // ✅ AGREGADO para que no dé undefined
      premium: 2 
    };
    
    // ✅ CORREGIDO: Cambiado 'plan' por 'planEfectivo'
    const pesoPlan = pesoMap[planEfectivo] || 0;

    const propiedad = await Property.create({
      titulo, descripcion, precio, operacion, tipo, ubicacion, caracteristicas,
      propietario: req.user.id,
      status: 'revision',
      planPeso: pesoPlan
    });
    
    res.status(201).json({ ok: true, mensaje: 'Propiedad enviada a revisión', propiedad });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listarPropiedades = async (req, res) => {
  try {
    const {
      operacion, tipo, estado, ciudad,
      precioMin, precioMax, recamaras, banos,
      m2Min, m2Max, orden,
      pagina = 1, limite = 15
    } = req.query;

    const filtro = { status: 'aprobada' };

    // Convierte "a,b,c" en ['a','b','c'], o un solo valor en [valor]
    const aArray = (valor) => valor.includes(',')
      ? valor.split(',').map(v => v.trim()).filter(Boolean)
      : [valor];

    if (operacion) {
      const valores = aArray(operacion);
      filtro.operacion = valores.length > 1 ? { $in: valores } : valores[0];
    }
    if (tipo) {
      const valores = aArray(tipo);
      filtro.tipo = valores.length > 1 ? { $in: valores } : valores[0];
    }
    if (estado) {
      const valores = aArray(estado);
      filtro['ubicacion.estado'] = valores.length > 1 ? { $in: valores } : valores[0];
    }
    if (ciudad) {
      const valores = aArray(ciudad);
      filtro['ubicacion.ciudad'] = valores.length > 1 ? { $in: valores } : valores[0];
    }
    if (precioMin || precioMax) {
      filtro.precio = {};
      if (precioMin) filtro.precio.$gte = Number(precioMin);
      if (precioMax) filtro.precio.$lte = Number(precioMax);
    }
    if (recamaras) filtro['caracteristicas.recamaras'] = { $gte: Number(recamaras) };
    if (banos) filtro['caracteristicas.banos'] = { $gte: Number(banos) };
    if (m2Min || m2Max) {
      filtro['caracteristicas.m2'] = {};
      if (m2Min) filtro['caracteristicas.m2'].$gte = Number(m2Min);
      if (m2Max) filtro['caracteristicas.m2'].$lte = Number(m2Max);
    }

    const ordenesPermitidos = { precio: { precio: 1 }, '-precio': { precio: -1 }, '-createdAt': { createdAt: -1 } };
    const ordenFinal = ordenesPermitidos[orden] || { createdAt: -1 };

    const skip = (Number(pagina) - 1) * Number(limite);
    const total = await Property.countDocuments(filtro);
    const propiedades = await Property.find(filtro)
      .populate('propietario', 'nombre avatar')
      .sort({ planPeso: -1, destacada: -1, ...ordenFinal }) // -1 significa de mayor a menor (Premium primero)
      .skip(skip)
      .limit(Number(limite));

    res.json({
      ok: true,
      total,
      paginas: Math.ceil(total / Number(limite)),
      paginaActual: Number(pagina),
      propiedades
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const detallePropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id)
      .populate('propietario', 'nombre avatar');
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.status !== 'aprobada') return res.status(403).json({ error: 'Propiedad no disponible' });
    // 'pausada' se oculta automáticamente porque solo se consultan propiedades con status 'aprobada'

    res.json({ ok: true, propiedad });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const editarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta propiedad' });
    }
    const actualizada = await Property.findByIdAndUpdate(
      req.params.id,
      { ...req.body, status: 'revision' },
      { new: true }
    );
    res.json({ ok: true, mensaje: 'Propiedad actualizada y enviada a revisión', propiedad: actualizada });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta propiedad' });
    }
    await Property.findByIdAndUpdate(req.params.id, { status: 'rechazada' });
    res.json({ ok: true, mensaje: 'Propiedad eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const pausarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para pausar esta propiedad' });
    }
    if (propiedad.status !== 'aprobada') {
      return res.status(400).json({ error: 'Solo puedes pausar una propiedad aprobada' });
    }
    const actualizada = await Property.findByIdAndUpdate(req.params.id, { status: 'pausada' }, { new: true });
    res.json({ ok: true, mensaje: 'Propiedad pausada. Ya no aparece en el catálogo público.', propiedad: actualizada });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reactivarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para reactivar esta propiedad' });
    }
    if (propiedad.status !== 'pausada') {
      return res.status(400).json({ error: 'Solo puedes reactivar una propiedad pausada' });
    }
    const actualizada = await Property.findByIdAndUpdate(
      req.params.id,
      { status: 'revision', motivo_rechazo: null },
      { new: true }
    );
    res.json({ ok: true, mensaje: 'Propiedad enviada a revisión para volver a publicarse.', propiedad: actualizada });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const misPropiedades = async (req, res) => {
  try {
    const propiedades = await Property.find({ propietario: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ ok: true, total: propiedades.length, propiedades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const subirFotos = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se subieron imágenes' });
    }
    const urls = await Promise.all(
      req.files.map(file => subirACloudinary(file.buffer, file.mimetype))
    );
    propiedad.fotos = [...propiedad.fotos, ...urls];
    await propiedad.save();
    res.json({ ok: true, mensaje: `${urls.length} foto(s) subida(s)`, fotos: propiedad.fotos });
  } catch (error) {
    console.error('Error subirFotos:', error.message);
    res.status(500).json({ error: error.message });
  }
};
module.exports = { crearPropiedad, listarPropiedades, detallePropiedad, editarPropiedad, eliminarPropiedad, pausarPropiedad, reactivarPropiedad, misPropiedades, subirFotos };