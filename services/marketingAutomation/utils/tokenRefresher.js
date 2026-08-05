// ==========================================
// REFRESCADOR DE TOKENS DE META
// ==========================================
// Cron job que renueva los tokens largos de la página de Facebook
// antes de que expiren (a los 50 días de 60).
//
// Flujo:
// 1. Busca conexiones Meta en SocialConfig donde el token expire pronto
// 2. Renueva el token largo de usuario vía fb_exchange_token
// 3. Obtiene el nuevo page_access_token vía /me/accounts
// 4. Actualiza la BD con los nuevos tokens y fechas de expiración

const metaConfig = require('../config/meta.config');
const SocialConfig = require('../../../src/models/SocialConfig');

// Renueva el token de un tenant específico
const renovarTokenTenant = async (socialConfig) => {
  try {
    // 1. Renovar token largo de usuario
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: metaConfig.appId,
      client_secret: metaConfig.appSecret,
      fb_exchange_token: socialConfig.userAccessToken,
    });

    const res = await fetch(`${metaConfig.baseUrl}/oauth/access_token?${params.toString()}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || 'Error renovando token de usuario');
    }

    const nuevoUserToken = data.access_token;
    const expiresIn = data.expires_in || 5183999; // 60 días por defecto

    // 2. Obtener nuevo page access token
    const accountsRes = await fetch(
      `${metaConfig.baseUrl}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${nuevoUserToken}`
    );
    const accountsData = await accountsRes.json();

    if (!accountsRes.ok || accountsData.error) {
      throw new Error(accountsData.error?.message || 'Error obteniendo page access token');
    }

    // Buscar la página configurada
    const page = (accountsData.data || []).find(
      (p) => p.id === (socialConfig.facebook?.pageId || metaConfig.facebook.pageId)
    );

    if (!page) {
      throw new Error('La página de Facebook no está asociada a esta cuenta');
    }

    // 3. Actualizar BD
    socialConfig.userAccessToken = nuevoUserToken;
    socialConfig.userTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    socialConfig.facebook.pageAccessToken = page.access_token;
    socialConfig.facebook.pageTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    socialConfig.instagram.businessAccountId = page.instagram_business_account?.id || socialConfig.instagram.businessAccountId;
    socialConfig.lastTokenRefresh = new Date();
    socialConfig.nextTokenRefresh = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000); // 50 días
    socialConfig.refreshError = null;
    await socialConfig.save();

    console.log(`🔄 Token de Meta renovado para página "${page.name}" (expira: ${socialConfig.facebook.pageTokenExpiresAt.toISOString()})`);
    return socialConfig;
  } catch (error) {
    socialConfig.refreshError = error.message;
    await socialConfig.save();
    throw error;
  }
};

// Renueva todos los tokens que expiran en menos de 10 días
const renovarTokensProximos = async () => {
  try {
    const limite = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 días
    const configs = await SocialConfig.find({
      isConnected: true,
      'facebook.pageTokenExpiresAt': { $lt: limite },
    });

    if (configs.length === 0) return 0;

    let renovados = 0;
    for (const config of configs) {
      try {
        await renovarTokenTenant(config);
        renovados++;
      } catch (e) {
        console.error(`❌ Error renovando token del tenant ${config.tenantId}:`, e.message);
      }
    }
    return renovados;
  } catch (error) {
    console.error('❌ Error en renovarTokensProximos:', error.message);
    return 0;
  }
};

// Arranca el cron job (cada 24h)
const iniciarTokenRefresher = () => {
  // Ejecutar una vez al arrancar (después de unos segundos)
  setTimeout(async () => {
    const renovados = await renovarTokensProximos();
    if (renovados > 0) console.log(`🔄 ${renovados} token(s) de Meta renovados al arranque.`);
  }, 10000);

  // Luego cada día
  setInterval(async () => {
    const renovados = await renovarTokensProximos();
    if (renovados > 0) console.log(`🔄 ${renovados} token(s) de Meta renovados.`);
  }, 24 * 60 * 60 * 1000);
};

module.exports = { renovarTokenTenant, renovarTokensProximos, iniciarTokenRefresher };
