// ==========================================
// SERVICIO DE OAUTH DE META
// ==========================================
// Gestiona el flujo de conexión con Facebook/Instagram:
// - Generar URL de autorización (con config_id, NO scope)
// - Intercambiar código por token corto
// - Intercambiar token corto por token largo (60 días)
// - Obtener page access token vía /me/accounts
// - Desconectar y consultar estado

const crypto = require('crypto');
const metaConfig = require('../config/meta.config');
const SocialConfig = require('../../../src/models/SocialConfig');

// Genera un estado aleatorio anti-CSRF
const generarState = () => crypto.randomBytes(24).toString('hex');

// Construye la URL de autorización
const buildAuthUrl = (state) => {
  return metaConfig.getAuthUrl(state);
};

// Intercambia el código por un token corto y luego por uno largo
const intercambiarCodigo = async (code) => {
  // 1. Código → token corto
  const shortParams = new URLSearchParams({
    client_id: metaConfig.appId,
    client_secret: metaConfig.appSecret,
    redirect_uri: metaConfig.redirectUri,
    code,
  });

  const shortRes = await fetch(`${metaConfig.baseUrl}/oauth/access_token?${shortParams.toString()}`);
  const shortData = await shortRes.json();

  if (!shortRes.ok || shortData.error) {
    throw new Error(shortData.error?.message || 'Error intercambiando código por token');
  }

  const shortToken = shortData.access_token;

  // 2. Token corto → token largo (fb_exchange_token)
  const longParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: metaConfig.appId,
    client_secret: metaConfig.appSecret,
    fb_exchange_token: shortToken,
  });

  const longRes = await fetch(`${metaConfig.baseUrl}/oauth/access_token?${longParams.toString()}`);
  const longData = await longRes.json();

  if (!longRes.ok || longData.error) {
    throw new Error(longData.error?.message || 'Error extendiendo token');
  }

  return {
    accessToken: longData.access_token,
    expiresIn: longData.expires_in || 5183999,
  };
};

// Obtiene las páginas y la cuenta de Instagram asociadas al token del usuario
const obtenerCuentas = async (userAccessToken) => {
  const res = await fetch(
    `${metaConfig.baseUrl}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`
  );
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Error obteniendo cuentas de Facebook');
  }

  return data.data || [];
};

// Conecta la cuenta de Meta para un tenant (usuario)
const conectarTenant = async ({ tenantId, code, connectedBy }) => {
  // 1. Intercambiar código por token largo
  const { accessToken, expiresIn } = await intercambiarCodigo(code);

  // 2. Obtener páginas
  const cuentas = await obtenerCuentas(accessToken);

  // Buscar la página configurada
  const page = cuentas.find((c) => c.id === metaConfig.facebook.pageId);

  if (!page) {
    throw new Error('La página de Facebook configurada no está asociada a esta cuenta');
  }

  // 3. Guardar/actualizar configuración en BD
  let config = await SocialConfig.findOne({ tenantId });

  if (!config) {
    config = new SocialConfig({ tenantId });
  }

  config.isConnected = true;
  config.connectedAt = config.connectedAt || new Date();
  config.metaAppId = metaConfig.appId;
  config.userAccessToken = accessToken;
  config.userTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
  config.facebook.pageId = page.id;
  config.facebook.pageName = page.name;
  config.facebook.pageAccessToken = page.access_token;
  config.facebook.pageTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
  config.instagram.businessAccountId = page.instagram_business_account?.id || '';
  config.instagram.username = metaConfig.instagram.username;
  config.lastTokenRefresh = new Date();
  config.nextTokenRefresh = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000);
  config.refreshError = null;
  config.grantedScopes = metaConfig.scopes;
  config.connectedBy = connectedBy;

  await config.save();

  return config;
};

// Desconecta la cuenta de Meta de un tenant
const desconectarTenant = async (tenantId) => {
  const config = await SocialConfig.findOne({ tenantId });
  if (!config) return null;

  config.isConnected = false;
  config.userAccessToken = null;
  config.userTokenExpiresAt = null;
  config.facebook.pageAccessToken = null;
  config.facebook.pageTokenExpiresAt = null;
  config.refreshError = null;
  await config.save();

  return config;
};

// Consulta el estado de conexión de un tenant
const estadoTenant = async (tenantId) => {
  const config = await SocialConfig.findOne({ tenantId });
  if (!config || !config.isConnected) {
    return { connected: false };
  }

  return {
    connected: true,
    connectedAt: config.connectedAt,
    metaAppId: config.metaAppId,
    facebook: {
      pageId: config.facebook.pageId,
      pageName: config.facebook.pageName,
      tokenExpiresAt: config.facebook.pageTokenExpiresAt,
    },
    instagram: {
      businessAccountId: config.instagram.businessAccountId,
      username: config.instagram.username,
    },
    lastTokenRefresh: config.lastTokenRefresh,
    nextTokenRefresh: config.nextTokenRefresh,
    refreshError: config.refreshError,
    grantedScopes: config.grantedScopes,
  };
};

module.exports = {
  generarState,
  buildAuthUrl,
  intercambiarCodigo,
  obtenerCuentas,
  conectarTenant,
  desconectarTenant,
  estadoTenant,
};
