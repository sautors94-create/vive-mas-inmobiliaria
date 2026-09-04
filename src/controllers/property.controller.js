const { subirACloudinary } = require('../config/cloudinary');
const Property = require('../models/Property');
const Message = require('../models/Message');
const User = require('../models/User');
const { validarPropiedadBasico } = require('../utils/Agentevalidacion');
const { moderarPropiedadConIA } = require('../utils/Agentemoderacion');
const mongoose = require('mongoose');

// ==========================================
// FUNCIÓN DE PRIVACIDAD (COORDENADAS PÚBLICAS)
// ==========================================
function calcularCoordPublica(coordExacta, id, index = 1) {
  let hash = 0;
  const str = `${id}${index}`;

  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }

  // Normalizar a 0..199 para evitar resultados negativos del operador %
  const hashNormalizado = ((hash % 200) + 200) % 200;

  // Aproximadamente ±80-90 metros
  const offset = (hashNormalizado - 100) * 0.000008;

  return Number(coordExacta) + offset;
}

const LIMITE_POR_PLAN = {
  gratuito: 3,
  basico: 15,
  basico_plus: Infinity, // Asignado por admin, sin límite de props
  premium: Infinity
};

const crearPropiedad = async (req, res) => {
try {
    const { titulo, descripcion, precio, operacion, tipo, ubicacion, caracteristicas, creditosAceptados } = req.body;
    
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
      basico_plus: 3, // Plan Gratuito Ilimitado: prioridad máxima, por encima de Premium
      premium: 2 
    };
    
    // ✅ CORREGIDO: Cambiado 'plan' por 'planEfectivo'
    const pesoPlan = pesoMap[planEfectivo] || 0;

const propiedad = await Property.create({
      titulo, descripcion, precio, operacion, tipo, ubicacion, caracteristicas,
      creditosAceptados: operacion === 'venta' ? (creditosAceptados || []) : [],
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
      m2Min, m2Max, orden, credito,
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
    // Filtro por crédito aceptado (ej. 'infonavit', 'bancario', 'fovissste')
    if (credito) {
      const valores = aArray(credito);
      filtro.creditosAceptados = valores.length > 1 ? { $in: valores } : valores[0];
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
    // 1. Validar que el ID sea un ObjectId válido de MongoDB
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'ID de propiedad inválido' });
    }

    // 2. Obtener el documento y convertirlo a objeto plano JS (.lean())
    const propiedad = await Property.findById(req.params.id)
      .populate('propietario', 'nombre avatar')
      .lean();

    if (!propiedad) {
      return res.status(404).json({ ok: false, error: 'Propiedad no encontrada' });
    }

    // 3. AUTORIZACIÓN (Seguridad estrictamente en servidor)
    const propietarioId = propiedad.propietario?._id || propiedad.propietario;
    
    const esPropietario = 
      Boolean(req.user) && 
      String(propietarioId) === String(req.user.id);

    const esAdmin = 
      Boolean(req.user) && 
      req.user.role === 'admin';

    const puedeVerExactas = esPropietario || esAdmin;

    // Si NO es dueño/admin y no está aprobada, bloqueamos (lógica original mejorada)
    if (!puedeVerExactas && propiedad.status !== 'aprobada') {
      return res.status(403).json({ ok: false, error: 'Propiedad no disponible' });
    }

    // 4. PRIVACIDAD DE UBICACIÓN
    if (!puedeVerExactas && propiedad.ubicacion) {
      const lat = Number(propiedad.ubicacion.lat);
      const lng = Number(propiedad.ubicacion.lng);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        propiedad.ubicacion.latPublica = calcularCoordPublica(lat, propiedad._id, 1);
        propiedad.ubicacion.lngPublica = calcularCoordPublica(lng, propiedad._id, 2);
      }

      // Eliminalos ANTES de enviar al frontend
      delete propiedad.ubicacion.lat;
      delete propiedad.ubicacion.lng;
      delete propiedad.ubicacion.direccion;
    }

    // Contador de vistas real (no bloqueante, no afecta el tiempo de respuesta)
    Property.updateOne({ _id: propiedad._id }, { $inc: { vistas: 1 } }).catch(() => {});

    // 5. Respuesta limpia
    return res.json({ ok: true, propiedad });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
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
      { ...req.body, status: 'revision', motivo_rechazo: null },
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
    // Antes esto solo ponía status:'rechazada' — no borraba nada de verdad,
    // así que la propiedad seguía apareciendo en "Mis propiedades" (las
    // rechazadas se muestran ahí a propósito, para que el usuario las
    // pueda corregir). Ahora sí se elimina permanentemente, igual que
    // hace el admin.
    await Property.findByIdAndDelete(req.params.id);
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

    const ids = propiedades.map(p => p._id);
    const leadsAgg = await Message.aggregate([
      { $match: { propiedad: { $in: ids } } },
      { $group: { _id: { propiedad: '$propiedad', conversacionId: '$conversacionId' } } },
      { $group: { _id: '$_id.propiedad', leads: { $sum: 1 } } },
    ]);
    const leadsMap = {};
    leadsAgg.forEach(l => { leadsMap[l._id.toString()] = l.leads; });

    const propiedadesConDatos = propiedades.map(p => {
      const obj = p.toObject();
      obj.leadsCount = leadsMap[p._id.toString()] || 0;
      return obj;
    });

    res.json({ ok: true, total: propiedades.length, propiedades: propiedadesConDatos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const MIN_FOTOS_PARA_MODERAR = 2;

// Orquesta los 2 agentes (Validación + Moderación IA) y aplica la decisión final.
// Se ejecuta en segundo plano (fire-and-forget) tras subir fotos — nunca bloquea
// la respuesta al usuario ni tumba el flujo de subida si algo falla.
const ejecutarModeracionCompleta = async (propiedadId) => {
  try {
    const propiedad = await Property.findById(propiedadId);
    if (!propiedad || propiedad.status !== 'revision') return; // ya fue movida por un admin, no pisar su decisión
    if ((propiedad.fotos || []).length < MIN_FOTOS_PARA_MODERAR) return; // faltan fotos, esperar a que suba más

    // Agente 1 — Validación (reglas, instantáneo)
    const { issues: issuesAgente1, bloqueaAutomatico } = validarPropiedadBasico(propiedad);

    // Historial del propietario, para dar contexto al Agente 2
    const propietario = await User.findById(propiedad.propietario).select('createdAt');
    const [aprobadas, rechazadas, bloqueadas] = await Promise.all([
      Property.countDocuments({ propietario: propiedad.propietario, status: 'aprobada' }),
      Property.countDocuments({ propietario: propiedad.propietario, status: 'rechazada' }),
      Property.countDocuments({ propietario: propiedad.propietario, status: 'bloqueada' }),
    ]);
    const historialUsuario = {
      antiguedad_cuenta_dias: propietario?.createdAt ? Math.floor((Date.now() - new Date(propietario.createdAt).getTime()) / 86400000) : null,
      propiedades_aprobadas_previas: aprobadas,
      propiedades_rechazadas_previas: rechazadas,
      propiedades_bloqueadas_previas: bloqueadas,
    };

    // Agente 2 — Moderación IA (imágenes + decisión final)
    const resultadoIA = await moderarPropiedadConIA({ propiedad, issuesAgente1, historialUsuario });

    // El Agente 1 tiene poder de veto: si detectó algo determinista y grave
    // (teléfono/URL/email literal en el texto), no dejamos que la IA lo apruebe.
    const decisionFinal = bloqueaAutomatico ? 'BLOCKED_FOR_REVIEW' : resultadoIA.decision;

    const todosLosIssues = [...issuesAgente1, ...(resultadoIA.issues || [])];

    propiedad.moderacionIA = {
      decision: decisionFinal,
      confidence: resultadoIA.confidence ?? null,
      riskScore: resultadoIA.risk_score ?? null,
      riskLevel: resultadoIA.risk_level || (bloqueaAutomatico ? 'HIGH' : null),
      summary: resultadoIA.summary || null,
      issues: todosLosIssues,
      analizadoEn: new Date(),
      agentesEjecutados: ['validacion', 'moderacion'],
    };

    if (decisionFinal === 'APPROVED') {
      propiedad.status = 'aprobada';
    }
    // Si es BLOCKED_FOR_REVIEW, se queda en 'revision' — el admin la ve en su cola,
    // ahora con el análisis de la IA visible para entender por qué.

    await propiedad.save();
    console.log(`🤖 Moderación IA completada para "${propiedad.titulo}": ${decisionFinal}`);
  } catch (error) {
    console.error('❌ Error en ejecutarModeracionCompleta:', error.message);
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

    ejecutarModeracionCompleta(propiedad._id).catch(() => {});

    res.json({ ok: true, mensaje: `${urls.length} foto(s) subida(s)`, fotos: propiedad.fotos });
  } catch (error) {
    console.error('Error subirFotos:', error.message);
    res.status(500).json({ error: error.message });
  }
};
const eliminarFoto = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Falta la URL de la foto a eliminar' });

    propiedad.fotos = propiedad.fotos.filter(f => f !== url);
    await propiedad.save();

    res.json({ ok: true, mensaje: 'Foto eliminada', fotos: propiedad.fotos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const registrarBusqueda = async (req, res) => {
  try {
    const { estado, ciudad, operacion, tipo, precioMax } = req.body;
    // Evitar guardar búsquedas totalmente vacías (sin ningún criterio real)
    if (!estado && !ciudad && !operacion && !tipo && !precioMax) {
      return res.json({ ok: true, ignorada: true });
    }

    const nueva = { estado: estado || '', ciudad: ciudad || '', operacion: operacion || '', tipo: tipo || '', precioMax: precioMax || null, fecha: new Date() };

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Quitar una búsqueda previa idéntica (para no duplicar) y agregar la nueva al frente
    user.busquedasRecientes = (user.busquedasRecientes || []).filter(b =>
      !(b.estado === nueva.estado && b.ciudad === nueva.ciudad && b.operacion === nueva.operacion && b.tipo === nueva.tipo && b.precioMax === nueva.precioMax)
    );
    user.busquedasRecientes.unshift(nueva);
    user.busquedasRecientes = user.busquedasRecientes.slice(0, 5);
    await user.save();

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { crearPropiedad, listarPropiedades, detallePropiedad, editarPropiedad, eliminarPropiedad, eliminarFoto, pausarPropiedad, reactivarPropiedad, misPropiedades, subirFotos, registrarBusqueda, ejecutarModeracionCompleta };