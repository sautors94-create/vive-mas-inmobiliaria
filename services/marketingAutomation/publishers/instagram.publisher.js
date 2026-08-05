// ==========================================
// PUBLICADOR EN INSTAGRAM
// ==========================================
// Publica en el perfil profesional de Instagram usando la Graph API.
//
// Flujo (SIEMPRE 2 pasos):
// 1. POST /{ig-account-id}/media con image_url y caption → crea container
// 2. POST /{ig-account-id}/media_publish con creation_id → publica
// 3. GET /{media_id}?fields=permalink → obtiene URL pública
//
// NOTA: El container no es la publicación final. Se debe publicar
// después de crear el container.

const BasePublisher = require('./base.publisher');
const metaConfig = require('../config/meta.config');
const { validarImagen } = require('../utils/imageValidator');

class InstagramPublisher extends BasePublisher {
  constructor() {
    super('instagram');
  }

  async validate(data) {
    const errores = [];

    if (!data.imageUrl) {
      errores.push('La imagen principal es obligatoria para publicar en Instagram');
    } else {
      // Instagram: solo JPG/PNG, máx 8 MB
      const img = await validarImagen(data.imageUrl, 'instagram');
      if (!img.valida) errores.push(...img.errores);
    }

    if (!data.text) {
      errores.push('El texto de la publicación es obligatorio');
    }

    return { valida: errores.length === 0, errores };
  }

  async publish(data) {
    const igAccountId = data.igAccountId || metaConfig.instagram.businessAccountId;
    const accessToken = data.pageAccessToken || metaConfig.testTokens.pageAccessToken;

    if (!accessToken) {
      throw new Error('No se encontró un page access token válido. Conecta la cuenta de Meta primero.');
    }

    // ===== PASO 1: Crear container =====
    const containerBody = new URLSearchParams({
      image_url: data.imageUrl,
      caption: data.text,
      access_token: accessToken,
    });

    const startTime = Date.now();
    const containerRes = await fetch(`${metaConfig.baseUrl}/${igAccountId}/media`, {
      method: 'POST',
      body: containerBody,
    });
    const containerJson = await containerRes.json();

    if (!containerRes.ok || containerJson.error) {
      const err = containerJson.error || { message: 'Error creando container de Instagram' };
      return {
        ok: false,
        httpStatus: containerRes.status,
        responseTime: Date.now() - startTime,
        error: {
          code: err.code || containerRes.status,
          message: err.message || 'Error creando container de Instagram',
          type: err.type || 'MetaGraphError',
          raw: containerJson,
        },
      };
    }

    const creationId = containerJson.id;

    // ===== PASO 2: Publicar container =====
    const publishBody = new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    });

    const publishRes = await fetch(`${metaConfig.baseUrl}/${igAccountId}/media_publish`, {
      method: 'POST',
      body: publishBody,
    });
    const publishJson = await publishRes.json();
    const responseTime = Date.now() - startTime;

    if (!publishRes.ok || publishJson.error) {
      const err = publishJson.error || { message: 'Error publicando container de Instagram' };
      return {
        ok: false,
        httpStatus: publishRes.status,
        responseTime,
        error: {
          code: err.code || publishRes.status,
          message: err.message || 'Error publicando container de Instagram',
          type: err.type || 'MetaGraphError',
          raw: publishJson,
        },
        containerId: creationId,
      };
    }

    const mediaId = publishJson.id;

    // ===== PASO 3: Obtener URL pública =====
    let permalink = null;
    try {
      const urlRes = await fetch(
        `${metaConfig.baseUrl}/${mediaId}?fields=id,permalink,timestamp,caption&access_token=${accessToken}`
      );
      const urlJson = await urlRes.json();
      if (urlRes.ok && urlJson.permalink) {
        permalink = urlJson.permalink;
      }
    } catch (e) {
      console.error('⚠️ No se pudo obtener permalink de Instagram:', e.message);
    }

    return {
      ok: true,
      httpStatus: publishRes.status,
      responseTime,
      response: publishJson,
      mediaId,
      containerId: creationId,
      url: permalink,
    };
  }

  async getPostUrl(result) {
    return result.url || null;
  }
}

module.exports = new InstagramPublisher();
