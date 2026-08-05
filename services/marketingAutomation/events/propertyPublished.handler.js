// ==========================================
// MANEJADOR DEL EVENTO "PROPIEDAD PUBLICADA"
// ==========================================
// Escucha el evento de nueva propiedad publicada y ejecuta
// la automatización de marketing correspondiente.
//
// Flujo:
// 1. Recibe el ID de la propiedad
// 2. Obtiene datos completos (property + user)
// 3. Evalúa condiciones (plan, status, fotos, visibilidad)
// 4. Determina la plataforma según la regla (renta→FB, venta→IG)
// 5. Genera contenido
// 6. Publica en la red social
// 7. Guarda respuesta y actualiza BD
// 8. Registra log de actividad

const Property = require('../../../src/models/Property');
const User = require('../../../src/models/User');
const SocialConfig = require('../../../src/models/SocialConfig');
const SocialActivityLog = require('../../../src/models/SocialActivityLog');
const { generarPublicacion } = require('../content/contentGenerator');
const facebookPublisher = require('../publishers/facebook.publisher');
const instagramPublisher = require('../publishers/instagram.publisher');
const metaConfig = require('../config/meta.config');

// Normaliza el objeto de la propiedad a los datos que espera el generador
const normalizarDatosPropiedad = (propiedad, propietario) => {
  const urlPublica = `${process.env.CLIENT_URL || 'https://somosvivemas.com'}/pages/propiedad.html?id=${propiedad._id}`;

  return {
    titulo: propiedad.titulo,
    descripcion: propiedad.descripcion,
    precio: propiedad.precio,
    tipoOperacion: propiedad.operacion, // 'renta' | 'venta'
    tipoInmueble: propiedad.tipo, // 'casa' | 'departamento' | etc.
    estado: propiedad.ubicacion?.estado || '',
    municipio: propiedad.ubicacion?.ciudad || '',
    ciudad: propiedad.ubicacion?.ciudad || '',
    colonia: propiedad.ubicacion?.colonia || '',
    codigoPostal: '',
    direccionPublica: propiedad.ubicacion?.direccion || '',
    recamaras: propiedad.caracteristicas?.recamaras || 0,
    banos: propiedad.caracteristicas?.banos || 0,
    estacionamientos: propiedad.caracteristicas?.estacionamientos || 0,
    superficieTerreno: 0,
    superficieConstruccion: propiedad.caracteristicas?.m2 || 0,
    amenities: [],
    nombreAsesor: propietario?.nombre || '',
    nombreInmobiliaria: 'Somos ViveMás',
    whatsapp: propietario?.telefono || '',
    telefono: propietario?.telefono || '',
    urlPublica,
    fotoPrincipal: propiedad.fotos?.[0] || '',
    galeriaFotografias: propiedad.fotos || [],
    fechaPublicacion: propiedad.createdAt,
    idInterno: propiedad._id.toString(),
    slug: propiedad._id.toString(),
  };
};

// Determina la plataforma según el tipo de operación
const getPlataforma = (operacion) => {
  switch (operacion) {
    case 'renta': return 'facebook';
    case 'venta': return 'instagram';
    default: return null;
  }
};

// Guarda el resultado en el campo socialMedia de la propiedad
const actualizarSocialMedia = async (propiedadId, plataforma, resultado) => {
  const campo = `socialMedia.${plataforma}`;
  const update = {};

  if (resultado.ok) {
    update[`${campo}.published`] = true;
    update[`${campo}.publishedAt`] = new Date();
    update[`${campo}.status`] = 'published';
    update[`${campo}.url`] = resultado.url || null;
    update[`${campo}.error`] = null;
    update[`${campo}.response`] = resultado.response || null;
    if (plataforma === 'facebook') {
      update['socialMedia.facebook.postId'] = resultado.postId || null;
      update['socialMedia.facebook.photoId'] = resultado.photoId || null;
    }
    if (plataforma === 'instagram') {
      update['socialMedia.instagram.mediaId'] = resultado.mediaId || null;
      update['socialMedia.instagram.containerId'] = resultado.containerId || null;
    }
  } else {
    update[`${campo}.published`] = false;
    update[`${campo}.status`] = 'failed';
    update[`${campo}.error`] = resultado.error || { message: 'Error de publicación' };
    update[`${campo}.response`] = resultado.error?.raw || null;
  }

  update[`${campo}.attempts`] = 1;
  update[`${campo}.lastAttemptAt`] = new Date();

  await Property.findByIdAndUpdate(propiedadId, { $set: update });
};

// Registra un log de actividad
const registrarLog = async ({ propiedadId, userId, plataforma, action, status, resultado, intento }) => {
  try {
    await SocialActivityLog.create({
      propertyId: propiedadId,
      userId: userId,
      platform: plataforma,
      action,
      status,
      requestData: {
        caption: resultado.requestData?.caption || '',
        imageUrl: resultado.requestData?.imageUrl || '',
        propertyUrl: resultado.requestData?.propertyUrl || '',
      },
      responseData: {
        postId: resultado.postId || null,
        mediaId: resultado.mediaId || null,
        postUrl: resultado.url || null,
        raw: resultado.response || resultado.error?.raw || null,
      },
      error: resultado.ok ? undefined : {
        code: resultado.error?.code,
        message: resultado.error?.message,
        type: resultado.error?.type,
        raw: resultado.error?.raw,
      },
      responseTime: resultado.responseTime,
      httpStatus: resultado.httpStatus,
      attempt: intento,
      maxAttempts: 3,
    });
  } catch (e) {
    console.error('❌ Error registrando log de actividad social:', e.message);
  }
};

// Verifica si ya existe una publicación para evitar duplicados
const yaPublicado = async (propiedadId, plataforma) => {
  const propiedad = await Property.findById(propiedadId).select(`socialMedia.${plataforma}`);
  if (!propiedad) return false;
  const data = propiedad.socialMedia?.[plataforma];
  return data?.published === true || data?.status === 'published';
};

// Función principal que procesa la publicación
const procesarPublicacion = async (propiedadId, { esReintento = false } = {}) => {
  try {
    // 1. Obtener propiedad con propietario
    const propiedad = await Property.findById(propiedadId).populate('propietario');
    if (!propiedad) {
      console.error('❌ Propiedad no encontrada para automatización:', propiedadId);
      return { ok: false, error: 'Propiedad no encontrada' };
    }

    const propietario = propiedad.propietario;

    // 2. Evalúa condiciones
    const planEfectivo = propietario?.role === 'basico_plus' ? 'basico_plus' : (propietario?.plan || 'gratuito');
    const condiciones = {
      statusCorrecto: propiedad.status === 'aprobada',
      planPago: planEfectivo !== 'gratuito',
      activa: propiedad.status === 'aprobada',
      tieneFotos: (propiedad.fotos || []).length >= 1,
      publica: propiedad.status === 'aprobada',
    };

    if (!condiciones.statusCorrecto || !condiciones.planPago || !condiciones.activa || !condiciones.tieneFotos || !condiciones.publica) {
      console.log(`⏭️ Automatización omitida para "${propiedad.titulo}": condiciones no cumplidas`, condiciones);
      return { ok: false, omitida: true, condiciones };
    }

    // 3. Determinar plataforma
    const plataforma = getPlataforma(propiedad.operacion);
    if (!plataforma) {
      console.log(`⏭️ Sin plataforma configurada para operación "${propiedad.operacion}"`);
      return { ok: false, error: 'Operación sin plataforma asignada' };
    }

    // 4. Evitar duplicados
    if (!esReintento && await yaPublicado(propiedad._id, plataforma)) {
      console.log(`⏭️ Ya existe publicación en ${plataforma} para "${propiedad.titulo}"`);
      return { ok: false, duplicado: true };
    }

    // 5. Obtener configuración de Meta
    const config = await SocialConfig.findOne({ isConnected: true });
    if (!config) {
      const errorMsg = 'No hay cuenta de Meta conectada. Conecta la página de Facebook para automatizar publicaciones.';
      console.error('❌ ' + errorMsg);
      await actualizarSocialMedia(propiedad._id, plataforma, {
        ok: false,
        error: { code: 0, message: errorMsg, type: 'NotConnected' },
      });
      return { ok: false, error: errorMsg };
    }

    const pageAccessToken = config.facebook.pageAccessToken || metaConfig.testTokens.pageAccessToken;

    // 6. Generar contenido
    const datos = normalizarDatosPropiedad(propiedad, propietario);
    const texto = generarPublicacion(datos);

    // 7. Seleccionar publisher
    const publisher = plataforma === 'facebook' ? facebookPublisher : instagramPublisher;

    // 8. Validar antes de publicar
    const validacion = await publisher.validate({
      imageUrl: datos.fotoPrincipal,
      text: texto,
    });

    if (!validacion.valida) {
      const errorMsg = validacion.errores.join('; ');
      await actualizarSocialMedia(propiedad._id, plataforma, {
        ok: false,
        error: { code: 400, message: errorMsg, type: 'ValidationError' },
      });
      await registrarLog({
        propiedadId: propiedad._id,
        userId: propietario?._id,
        plataforma,
        action: esReintento ? 'retry' : 'publish',
        status: 'failed',
        resultado: { ok: false, error: { code: 400, message: errorMsg }, requestData: { caption: texto, imageUrl: datos.fotoPrincipal, propertyUrl: datos.urlPublica } },
        intento: 1,
      });
      return { ok: false, error: errorMsg };
    }

    // 9. Publicar
    console.log(`🚀 Publicando "${propiedad.titulo}" en ${plataforma}...`);
    const resultado = await publisher.publish({
      imageUrl: datos.fotoPrincipal,
      text: texto,
      pageId: metaConfig.facebook.pageId,
      pageAccessToken,
      igAccountId: metaConfig.instagram.businessAccountId,
    });

    // 10. Guardar resultado en la propiedad
    await actualizarSocialMedia(propiedad._id, plataforma, resultado);

    // 11. Registrar log
    await registrarLog({
      propiedadId: propiedad._id,
      userId: propietario?._id,
      plataforma,
      action: esReintento ? 'retry' : 'publish',
      status: resultado.ok ? 'published' : 'failed',
      resultado: {
        ...resultado,
        requestData: { caption: texto, imageUrl: datos.fotoPrincipal, propertyUrl: datos.urlPublica },
      },
      intento: 1,
    });

    if (resultado.ok) {
      console.log(`✅ Publicado "${propiedad.titulo}" en ${plataforma}: ${resultado.url || 'sin URL'}`);
    } else {
      console.error(`❌ Error publicando "${propiedad.titulo}" en ${plataforma}:`, resultado.error?.message);
    }

    return resultado;
  } catch (error) {
    console.error('❌ Error en procesarPublicacion:', error.message);
    return { ok: false, error: error.message };
  }
};

// Escucha el evento
const iniciarListener = (eventEmitter) => {
  eventEmitter.on('property:published', async (propiedadId) => {
    console.log(`📡 Evento recibido: propiedad publicada (${propiedadId})`);
    procesarPublicacion(propiedadId).catch((e) => {
      console.error('❌ Error en listener de propiedad publicada:', e.message);
    });
  });
};

// Para reintentos manuales desde el panel
const reintentarPublicacion = async (propiedadId, plataforma) => {
  return procesarPublicacion(propiedadId, { esReintento: true });
};

module.exports = { iniciarListener, procesarPublicacion, reintentarPublicacion };
