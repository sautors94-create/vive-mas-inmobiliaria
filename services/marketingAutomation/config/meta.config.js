// ==========================================
// CONFIGURACIÓN DE META GRAPH API
// ==========================================
// Contiene las credenciales de la app, página de Facebook
// e Instagram Business. Los valores se cargan desde variables
// de entorno (.env) y se exponen de forma segura solo al backend.
//
// NOTA DE SEGURIDAD: los valores hardcodeados aquí son SOLO fallbacks de
// desarrollo. En producción SIEMPRE se cargan desde variables de entorno.
// Los tokens de prueba expiran y deben reemplazarse por tokens reales vía
// OAuth (ver auth/metaOAuth.service.js).

const metaConfig = {
  // ===== META APP =====
  appId: process.env.META_APP_ID || '1390074509739945',
  appSecret: process.env.META_APP_SECRET || '',
  configId: process.env.META_CONFIG_ID || '888317470626511',
  // v25.0 es la versión vigente de la Graph API. Meta retiró v19.0 en mayo 2026.
  apiVersion: process.env.META_API_VERSION || 'v25.0',
  redirectUri: process.env.META_REDIRECT_URI || 'https://somosvivemas.com/api/auth/meta/callback',
  scopes: (process.env.META_SCOPES || 'pages_show_list,pages_manage_posts,pages_read_engagement,business_management,instagram_basic,instagram_content_publish,public_profile')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // ===== FACEBOOK PAGE =====
  facebook: {
    pageId: process.env.META_PAGE_ID || '1188953474308974',
    pageName: process.env.META_PAGE_NAME || 'Somos ViveMás Inmobiliaria',
  },

  // ===== INSTAGRAM BUSINESS =====
  instagram: {
    businessAccountId: process.env.META_IG_BUSINESS_ACCOUNT_ID || '17841443899594266',
    username: process.env.META_IG_USERNAME || 'somos_vivemasinmobiliaria',
  },

  // ===== TOKENS DE PRUEBA (Graph API Explorer) =====
  // ⚠️ Solo para desarrollo. En producción se obtienen vía OAuth.
  testTokens: {
    userAccessToken: process.env.META_TEST_USER_TOKEN || '',
    pageAccessToken: process.env.META_TEST_PAGE_TOKEN || '',
  },
};

// URL base de la Graph API
metaConfig.baseUrl = `https://graph.facebook.com/${metaConfig.apiVersion}`;

// URL de autorización OAuth (Facebook Login for Business)
// NOTA: Se usa config_id en lugar de scope (requisito de la app)
metaConfig.getAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id: metaConfig.appId,
    config_id: metaConfig.configId,
    redirect_uri: metaConfig.redirectUri,
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/${metaConfig.apiVersion}/dialog/oauth?${params.toString()}`;
};

module.exports = metaConfig;