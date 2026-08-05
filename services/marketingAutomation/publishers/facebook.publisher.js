// ==========================================
// PUBLICADOR EN FACEBOOK
// ==========================================
// Publica en la página de Facebook usando la Graph API.
//
// Flujo:
// 1. POST /{page-id}/photos con url y message
// 2. Guarda post_id (formato page_id_post_id)
// 3. GET /{post_id}?fields=permalink_url
// 4. Devuelve la URL pública de la publicación

const BasePublisher = require('./base.publisher');
const metaConfig = require('../config/meta.config');
const { validarImagen } = require('../utils/imageValidator');

class FacebookPublisher extends BasePublisher {
  constructor() {
    super('facebook');
  }

  async validate(data) {
    const errores = [];

    if (!data.imageUrl) {
      errores.push('La imagen principal es obligatoria para publicar en Facebook');
    } else {
      // Validar accesibilidad y formato
      const img = await validarImagen(data.imageUrl, 'facebook');
      if (!img.valida) errores.push(...img.errores);
    }

    if (!data.text) {
      errores.push('El texto de la publicación es obligatorio');
    }

    return { valida: errores.length === 0, errores };
  }

  async publish(data) {
    const pageId = data.pageId || metaConfig.facebook.pageId;
    const accessToken = data.pageAccessToken || metaConfig.testTokens.pageAccessToken;

    if (!accessToken) {
      throw new Error('No se encontró un page access token válido. Conecta la cuenta de Meta primero.');
    }

    // 1. Publicar foto con mensaje
    const body = new URLSearchParams({
      url: data.imageUrl,
      message: data.text,
      access_token: accessToken,
    });

    const startTime = Date.now();
    const res = await fetch(`${metaConfig.baseUrl}/${pageId}/photos`, {
      method: 'POST',
      body,
    });
    const responseTime = Date.now() - startTime;
    const json = await res.json();

    if (!res.ok || json.error) {
      const err = json.error || { message: 'Error al publicar en Facebook' };
      return {
        ok: false,
        httpStatus: res.status,
        responseTime,
        error: {
          code: err.code || res.status,
          message: err.message || 'Error al publicar en Facebook',
          type: err.type || 'MetaGraphError',
          raw: json,
        },
      };
    }

    // 2. Obtener URL de la publicación usando post_id
    const postId = json.post_id || json.id;
    let permalinkUrl = null;

    try {
      const urlRes = await fetch(
        `${metaConfig.baseUrl}/${postId}?fields=id,permalink_url,message,created_time&access_token=${accessToken}`
      );
      const urlJson = await urlRes.json();
      if (urlRes.ok && urlJson.permalink_url) {
        permalinkUrl = urlJson.permalink_url;
      }
    } catch (e) {
      console.error('⚠️ No se pudo obtener permalink_url de Facebook:', e.message);
    }

    return {
      ok: true,
      httpStatus: res.status,
      responseTime,
      response: json,
      postId,
      photoId: json.id || null,
      url: permalinkUrl,
    };
  }

  async getPostUrl(result) {
    return result.url || null;
  }
}

module.exports = new FacebookPublisher();
