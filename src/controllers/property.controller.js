const { subirACloudinary } = require('../config/cloudinary');
const Property = require('../models/Property');
const Message = require('../models/Message');
const User = require('../models/User');
const { validarPropiedadBasico } = require('../utils/Agentevalidacion');
const { moderarPropiedadConIA } = require('../utils/Agentemoderacion');
const mongoose = require('mongoose');

// Importaciones para Meta Graph API
const SocialConfig = require('../models/SocialConfig');
// ✅ RUTA CORREGIDA: Subimos dos niveles (../../) desde src/controllers hasta la raíz, y luego entramos a services
const metaConfig = require('../../services/marketingAutomation/config/meta.config');

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

  const hashNormalizado = ((hash % 200) + 200) % 200;
  const offset = (hashNormalizado - 100) * 0.000008;

  return Number(coordExacta) + offset;
}

const LIMITE_POR_PLAN = {
  gratuito: 3,
  basico: 15,
  basico_plus: Infinity,
  premium: Infinity
};

// ==========================================
// FUNCIÓN REAL PARA META GRAPH API (USANDO BD)
// ==========================================
const publicarEnRedesYNotificar = async (propiedad) => {
  try {
    // PUNTO 1: Si ya había sido publicada antes (se está editando), NO volver a publicar
    if (propiedad.socialMedia && propiedad.socialMedia.facebook && propiedad.socialMedia.facebook.url) {
      console.log(`Propiedad "${propiedad.titulo}" ya tenía publicaciones. Omitiendo...`);
      return; 
    }

    // 1. OBTENER EL TOKEN DESDE LA BASE DE DATOS
    const tenantId = propiedad.propietario._id ? propiedad.propietario._id.toString() : propiedad.propietario.toString();
    const socialConfig = await SocialConfig.findOne({ tenantId });

    if (!socialConfig || !socialConfig.isConnected || !socialConfig.facebook.pageAccessToken) {
      console.warn('⚠️ El usuario no tiene Meta conectado. No se publicará en redes.');
      return;
    }

    const pageAccessToken = socialConfig.facebook.pageAccessToken;
    const pageId = socialConfig.facebook.pageId || metaConfig.facebook.pageId;
    const igBusinessId = socialConfig.instagram.businessAccountId || metaConfig.instagram.businessAccountId;
    const apiVersion = metaConfig.apiVersion;

    const linkVivemas = `https://somosvivemas.com/pages/propiedad.html?id=${propiedad._id}`;
    const mensaje = `🏠 ${propiedad.titulo}\n💰 $${propiedad.precio}\n📍 ${propiedad.ubicacion?.ciudad}, ${propiedad.ubicacion?.estado}\n\nVer detalles: ${linkVivemas}`;
    
    let fbUrl = null;
    let igUrl = null;

    // 2. PUBLICAR EN FACEBOOK
    try {
      const fbResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: mensaje,
          link: linkVivemas,
          access_token: pageAccessToken
        })
      });
      const fbData = await fbResponse.json();
      
      if (fbData.error) throw new Error(fbData.error.message);
      
      fbUrl = `https://facebook.com/${pageId}/posts/${fbData.id.split('_')[1]}`;
      console.log('✅ Publicado en Facebook');
    } catch (fbError) {
      console.error('❌ Error publicando en Facebook:', fbError.message);
    }

    // 3. PUBLICAR EN INSTAGRAM (Requiere una imagen)
    try {
      if (propiedad.fotos && propiedad.fotos.length > 0) {
        // Paso A: Crear el contenedor de medios en IG
        const igContainer = await fetch(`https://graph.facebook.com/${apiVersion}/${igBusinessId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: propiedad.fotos[0], 
            caption: mensaje,
            access_token: pageAccessToken
          })
        });
        const igContainerData = await igContainer.json();

        if (igContainerData.error) throw new Error(igContainerData.error.message);

        // Paso B: Publicar el contenedor en el feed de IG
        const igPublish = await fetch(`https://graph.facebook.com/${apiVersion}/${igBusinessId}/media_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: igContainerData.id,
            access_token: pageAccessToken
          })
        });
        const igPublishData = await igPublish.json();

        if (igPublishData.error) throw new Error(igPublishData.error.message);
        
        igUrl = `https://instagram.com/${metaConfig.instagram.username}`;
        console.log('✅ Publicado en Instagram');
      }
    } catch (igError) {
      console.error('❌ Error publicando en Instagram:', igError.message);
    }

    // 4. GUARDAR LINKS EN LA BASE DE DATOS
    propiedad.socialMedia = {
      facebook: { status: fbUrl ? 'published' : 'failed', url: fbUrl, publishedAt: new Date() },
      instagram: { status: igUrl ? 'published' : 'failed', url: igUrl, publishedAt: new Date() }
    };
    await propiedad.save();

    // 5. ENVIAR MENSAJE INTERNO SI AL MENOS UNA RED SE PUBLICÓ
    if (fbUrl || igUrl) {
      let textoMsg = `🎉 ¡Tu propiedad "${propiedad.titulo}" fue aprobada y publicada!\n\nCompártela en tus redes:\n🔗 ViveMás: ${linkVivemas}\n${fbUrl ? `📘 Facebook: ${fbUrl}\n` : ''}${igUrl ? `📸 Instagram: ${igUrl}` : ''}`;

      // ✅ NUEVO: Si el admin la editó, avisar al usuario
      if (propiedad.adminEdited) {
        textoMsg = `🎉 ¡Tu propiedad "${propiedad.titulo}" fue aprobada y publicada!\n\n⚠️ *Nota importante:* Un administrador ajustó algunos detalles o eliminó algunas de tus fotos durante la revisión para cumplir con nuestras políticas de publicación.\n\nPuedes ver tu publicación y compartirla en tus redes aquí:\n🔗 ViveMás: ${linkVivemas}\n${fbUrl ? `📘 Facebook: ${fbUrl}\n` : ''}${igUrl ? `📸 Instagram: ${igUrl}` : ''}`;
      }

      await Message.create({
        remitente: null, 
        destinatario: propiedad.propietario,
        propiedad: propiedad._id,
        mensaje: textoMsg,
        esSistema: true 
      });
      console.log(`✅ Notificación enviada al usuario para: ${propiedad.titulo}`);
    }

  } catch (error) {
    console.error('❌ Error general en publicarEnRedesYNotificar:', error.message);
    propiedad.socialMedia = propiedad.socialMedia || {};
    propiedad.socialMedia.facebook = { status: 'failed', error: error.message };
    await propiedad.save();
  }
};

// ==========================================
// CONTROLADORES PRINCIPALES
// ==========================================

const crearPropiedad = async (req, res) => {
  try {
    const { titulo, descripcion, precio, operacion, tipo, ubicacion, caracteristicas, creditosAceptados } = req.body;
    
    const planEfectivo = req.user.role === 'basico_plus' ? 'basico_plus' : (req.user.plan || 'gratuito');
    const limite = LIMITE_POR_PLAN[planEfectivo] || 3;
    
    const count = await Property.countDocuments({
      propietario: req.user.id,
      status: { $ne: 'rechazada' }
    });
    
    if (count >= limite) {
      return res.status(403).json({
        error: `Has alcanzado el límite de ${limite} propiedades para tu plan ${planEfectivo}. ¡Haz upgrade a premium para publicaciones ilimitadas!`
      });
    }
    
    const pesoMap = { 
      gratuito: 0, 
      basico: 1, 
      basico_plus: 3, 
      premium: 2 
    };
    
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
      .sort({ planPeso: -1, destacada: -1, ...ordenFinal })
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'ID de propiedad inválido' });
    }

    const propiedad = await Property.findById(req.params.id)
      .populate('propietario', 'nombre avatar')
      .lean();

    if (!propiedad) {
      return res.status(404).json({ ok: false, error: 'Propiedad no encontrada' });
    }

    const propietarioId = propiedad.propietario?._id || propiedad.propietario;
    
    const esPropietario = Boolean(req.user) && String(propietarioId) === String(req.user.id);
    const esAdmin = Boolean(req.user) && req.user.role === 'admin';
    const puedeVerExactas = esPropietario || esAdmin;

    if (!puedeVerExactas && propiedad.status !== 'aprobada') {
      return res.status(403).json({ ok: false, error: 'Propiedad no disponible' });
    }

    if (!puedeVerExactas && propiedad.ubicacion) {
      const lat = Number(propiedad.ubicacion.lat);
      const lng = Number(propiedad.ubicacion.lng);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        propiedad.ubicacion.latPublica = calcularCoordPublica(lat, propiedad._id, 1);
        propiedad.ubicacion.lngPublica = calcularCoordPublica(lng, propiedad._id, 2);
      }

      delete propiedad.ubicacion.lat;
      delete propiedad.ubicacion.lng;
      delete propiedad.ubicacion.direccion;
    }

    Property.updateOne({ _id: propiedad._id }, { $inc: { vistas: 1 } }).catch(() => {});

    return res.json({ ok: true, propiedad });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

// ==========================================
// PUNTO 1 y 2: EDITAR PROPIEDAD (CON PERMISOS DE ADMIN)
// ==========================================
const editarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    
    // PUNTO 2: Permitir que el admin también edite
    const esPropietario = propiedad.propietario.toString() === req.user.id;
    const esAdmin = req.user.role === 'admin';
    if (!esPropietario && !esAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta propiedad' });
    }

    // PUNTO 1: Evitar que el frontend sobreescriba el estado de las redes sociales o el dueño
    const datosLimpios = { ...req.body };
    delete datosLimpios.socialMedia; 
    delete datosLimpios.propietario; 

    // ✅ NUEVO: Marcar que el admin la editó
    if (esAdmin) {
      datosLimpios.adminEdited = true;
    }

    const actualizada = await Property.findByIdAndUpdate(
      req.params.id,
      { ...datosLimpios, status: 'revision', motivo_rechazo: null },
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

const ejecutarModeracionCompleta = async (propiedadId) => {
  try {
    const propiedad = await Property.findById(propiedadId);
    if (!propiedad || propiedad.status !== 'revision') return;
    if ((propiedad.fotos || []).length < MIN_FOTOS_PARA_MODERAR) return;

    const { issues: issuesAgente1, bloqueaAutomatico } = validarPropiedadBasico(propiedad);

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

    const resultadoIA = await moderarPropiedadConIA({ propiedad, issuesAgente1, historialUsuario });

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
      // PUNTO 3: Disparar publicación en redes y mensaje automático
      await publicarEnRedesYNotificar(propiedad);
    }

    await propiedad.save();
    console.log(`🤖 Moderación IA completada para "${propiedad.titulo}": ${decisionFinal}`);
  } catch (error) {
    console.error('❌ Error en ejecutarModeracionCompleta:', error.message);
  }
};

// ==========================================
// PUNTO 2: SUBIR Y ELIMINAR FOTOS (CON PERMISOS DE ADMIN)
// ==========================================
const subirFotos = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    
    // PUNTO 2: Agregado permiso de admin
    if (propiedad.propietario.toString() !== req.user.id && req.user.role !== 'admin') {
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
    
    // PUNTO 2: Agregado permiso de admin
    if (propiedad.propietario.toString() !== req.user.id && req.user.role !== 'admin') {
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
    if (!estado && !ciudad && !operacion && !tipo && !precioMax) {
      return res.json({ ok: true, ignorada: true });
    }

    const nueva = { estado: estado || '', ciudad: ciudad || '', operacion: operacion || '', tipo: tipo || '', precioMax: precioMax || null, fecha: new Date() };

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

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

module.exports = { 
  crearPropiedad, 
  listarPropiedades, 
  detallePropiedad, 
  editarPropiedad, 
  eliminarPropiedad, 
  eliminarFoto, 
  pausarPropiedad, 
  reactivarPropiedad, 
  misPropiedades, 
  subirFotos, 
  registrarBusqueda, 
  ejecutarModeracionCompleta,
  publicarEnRedesYNotificar // Exportada por si la llamas desde el panel de admin
};